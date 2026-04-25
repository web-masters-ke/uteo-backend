import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../services/prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = req.method;

    // Only log write operations
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) return next.handle();

    // Skip noisy endpoints
    const path = req.url?.replace(/\?.*/, '') || '';
    if (path.includes('/auth/refresh') || path.includes('/health')) return next.handle();

    const user = req.user;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          // Determine action from method + path
          const action = this.getAction(method, path);
          const resource = this.getResource(path);
          const resourceId = this.getResourceId(path);
          const severity = method === 'DELETE' ? 'WARN' : 'INFO';

          this.prisma.auditLog.create({
            data: {
              userId: user?.id || null,
              action,
              resource,
              resourceId,
              severity: severity as any,
              ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
              userAgent: req.headers['user-agent'] || null,
              metadata: {
                method,
                path,
                statusCode: 200,
                duration: Date.now() - startTime,
                body: this.sanitizeBody(req.body),
              },
            },
          }).catch(() => {}); // Fire and forget — never block the response
        },
        error: (err) => {
          const action = this.getAction(method, path);
          const resource = this.getResource(path);

          this.prisma.auditLog.create({
            data: {
              userId: user?.id || null,
              action: `${action}_FAILED`,
              resource,
              severity: 'WARN',
              ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
              userAgent: req.headers['user-agent'] || null,
              metadata: {
                method,
                path,
                statusCode: err.status || 500,
                error: err.message || 'Unknown error',
                duration: Date.now() - startTime,
              },
            },
          }).catch(() => {});
        },
      }),
    );
  }

  private getAction(method: string, path: string): string {
    const p = path.replace(/\/api\/v1\//, '').replace(/\/[a-f0-9-]{36}/g, '/:id');

    if (p.includes('auth/login')) return 'USER_LOGIN';
    if (p.includes('auth/register')) return 'USER_REGISTER';
    if (p.includes('auth/logout')) return 'USER_LOGOUT';

    if (method === 'POST' && p.includes('bookings')) return 'BOOKING_CREATED';
    if (method === 'PATCH' && p.includes('bookings') && p.includes('status')) return 'BOOKING_STATUS_CHANGED';
    if (method === 'PATCH' && p.includes('bookings') && p.includes('reschedule')) return 'BOOKING_RESCHEDULED';

    if (p.includes('wallet/deposit')) return 'WALLET_DEPOSIT';
    if (p.includes('wallet/withdraw')) return 'WALLET_WITHDRAW';
    if (p.includes('wallet/transfer')) return 'WALLET_TRANSFER';
    if (p.includes('wallet/admin/fund')) return 'WALLET_ADMIN_FUND';

    if (p.includes('escrow') && p.includes('release')) return 'ESCROW_RELEASED';
    if (p.includes('escrow') && p.includes('refund')) return 'ESCROW_REFUNDED';
    if (p.includes('escrow') && p.includes('freeze')) return 'ESCROW_FROZEN';

    if (method === 'POST' && p.includes('disputes')) return 'DISPUTE_CREATED';
    if (p.includes('disputes') && p.includes('resolve')) return 'DISPUTE_RESOLVED';
    if (p.includes('disputes') && p.includes('escalate')) return 'DISPUTE_ESCALATED';

    if (method === 'POST' && p.includes('reviews')) return 'REVIEW_CREATED';
    if (method === 'PATCH' && p.includes('reviews')) return 'REVIEW_UPDATED';
    if (method === 'DELETE' && p.includes('reviews')) return 'REVIEW_DELETED';

    if (p.includes('verification') && p.includes('approve')) return 'VERIFICATION_APPROVED';
    if (p.includes('verification') && p.includes('reject')) return 'VERIFICATION_REJECTED';
    if (p.includes('verification') && p.includes('review')) return 'CREDENTIAL_REVIEWED';

    if (method === 'POST' && p.includes('invoices')) return 'INVOICE_CREATED';
    if (p.includes('invoices') && p.includes('send')) return 'INVOICE_SENT';
    if (p.includes('invoices') && p.includes('paid')) return 'INVOICE_PAID';
    if (p.includes('invoices') && p.includes('void')) return 'INVOICE_VOIDED';

    if (method === 'POST' && p.includes('payouts')) return 'PAYOUT_REQUESTED';
    if (p.includes('payouts') && p.includes('approve')) return 'PAYOUT_APPROVED';
    if (p.includes('payouts') && p.includes('complete')) return 'PAYOUT_COMPLETED';
    if (p.includes('payouts') && p.includes('reject')) return 'PAYOUT_REJECTED';

    if (method === 'POST' && p.includes('courses')) return 'COURSE_CREATED';
    if (p.includes('courses') && p.includes('publish')) return 'COURSE_PUBLISHED';
    if (p.includes('courses') && p.includes('enroll')) return 'COURSE_ENROLLED';

    if (method === 'POST' && p.includes('subscriptions/subscribe')) return 'SUBSCRIPTION_CREATED';
    if (p.includes('subscriptions') && p.includes('cancel')) return 'SUBSCRIPTION_CANCELLED';

    if (p.includes('notifications/send')) return 'NOTIFICATION_SENT';
    if (p.includes('commissions') && p.includes('override')) return 'COMMISSION_OVERRIDE';

    if (method === 'POST' && p.includes('team/invite')) return 'TEAM_INVITE_SENT';

    // Generic fallback
    const resource = this.getResource(path);
    const actionMap: Record<string, string> = { POST: 'CREATED', PATCH: 'UPDATED', PUT: 'UPDATED', DELETE: 'DELETED' };
    return `${resource.toUpperCase()}_${actionMap[method] || method}`;
  }

  private getResource(path: string): string {
    const segments = path.replace(/\/api\/v1\//, '').split('/').filter(s => !s.match(/^[a-f0-9-]{36}$/));
    return segments[0] || 'unknown';
  }

  private getResourceId(path: string): string | null {
    const match = path.match(/\/([a-f0-9-]{36})/);
    return match ? match[1] : null;
  }

  private sanitizeBody(body: any): any {
    if (!body) return null;
    const sanitized = { ...body };
    // Remove sensitive fields
    delete sanitized.password;
    delete sanitized.passwordHash;
    delete sanitized.refreshToken;
    delete sanitized.accessToken;
    delete sanitized.token;
    // Truncate large fields
    for (const key of Object.keys(sanitized)) {
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 200) {
        sanitized[key] = sanitized[key].substring(0, 200) + '...';
      }
    }
    return sanitized;
  }
}
