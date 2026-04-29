import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import { BrevoService } from '../../common/services/brevo.service';
import { paginate, pageParams } from '../../common/dto/pagination.dto';
import {
  CreateInvoiceDto,
  ListInvoicesDto,
  AdminListInvoicesDto,
} from './dto/invoices.dto';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brevoService: BrevoService,
  ) {}

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  private async generateInvoiceNumber(): Promise<string> {
    const now = new Date();
    const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    const lastInvoice = await this.prisma.invoice.findFirst({
      where: { invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: 'desc' },
    });

    let seq = 1;
    if (lastInvoice) {
      const parts = lastInvoice.invoiceNumber.split('-');
      const lastSeq = parseInt(parts[2], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}-${String(seq).padStart(4, '0')}`;
  }

  private readonly includeUsers = {
    issuer: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatar: true,
      },
    },
    recipient: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatar: true,
      },
    },
  };

  /* ------------------------------------------------------------------ */
  /*  Create invoice manually                                           */
  /* ------------------------------------------------------------------ */

  async create(issuerId: string, dto: CreateInvoiceDto) {
    const recipient = await this.prisma.user.findUnique({
      where: { id: dto.recipientId },
    });
    if (!recipient) throw new NotFoundException('Recipient not found');

    const invoiceNumber = await this.generateInvoiceNumber();
    const tax = dto.includeTax ? dto.amount * 0.16 : (dto.tax ?? 0);
    const total = dto.amount + tax;

    const lineItems =
      dto.lineItems && dto.lineItems.length > 0
        ? dto.lineItems
        : [
            {
              description: dto.description || 'Service',
              qty: 1,
              unitPrice: dto.amount,
              total: dto.amount,
            },
          ];

    return this.prisma.invoice.create({
      data: {
        invoiceNumber,
        issuerId,
        recipientId: dto.recipientId,
        bookingId: dto.bookingId,
        courseId: dto.courseId,
        subscriptionId: dto.subscriptionId,
        amount: dto.amount,
        tax,
        total,
        currency: dto.currency || 'KES',
        status: 'DRAFT',
        description: dto.description,
        lineItems: lineItems as unknown as Prisma.InputJsonValue,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
      include: this.includeUsers,
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Auto-generate from a booking                                      */
  /* ------------------------------------------------------------------ */

  async autoGenerateFromBooking(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        trainer: { select: { id: true, firstName: true, lastName: true } },
        client: { select: { id: true, firstName: true, lastName: true } },
        escrow: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    // Only the trainer or admin can auto-generate
    if (booking.trainerId !== userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (!['ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN'].includes(user?.role || '')) {
        throw new ForbiddenException('Only the trainer or admin can generate this invoice');
      }
    }

    // Check if an invoice already exists for this booking
    const existing = await this.prisma.invoice.findFirst({
      where: { bookingId },
    });
    if (existing) throw new BadRequestException('Invoice already exists for this booking');

    const amount = Number(booking.amount);
    const tax = 0; // Default no VAT — set to amount * 0.16 if VAT enabled
    const total = amount + tax;

    const lineItems = [
      {
        description: `Training Session - ${booking.sessionType}`,
        qty: 1,
        unitPrice: amount,
        total: amount,
      },
    ];

    const invoiceNumber = await this.generateInvoiceNumber();

    // If booking is COMPLETED and escrow is RELEASED, auto-mark as PAID
    const isAutoPaid =
      booking.status === 'COMPLETED' &&
      booking.escrow?.status === 'RELEASED';

    return this.prisma.invoice.create({
      data: {
        invoiceNumber,
        issuerId: booking.trainerId,
        recipientId: booking.clientId,
        bookingId,
        amount,
        tax,
        total,
        currency: booking.currency,
        status: isAutoPaid ? 'PAID' : 'DRAFT',
        description: `Training session with ${booking.trainer.firstName} ${booking.trainer.lastName}`,
        lineItems: lineItems as unknown as Prisma.InputJsonValue,
        issuedAt: isAutoPaid ? new Date() : null,
        paidAt: isAutoPaid ? new Date() : null,
      },
      include: this.includeUsers,
    });
  }

  /* ------------------------------------------------------------------ */
  /*  List invoices (my sent + received)                                */
  /* ------------------------------------------------------------------ */

  async findAll(userId: string, dto: ListInvoicesDto) {
    const { page, limit, skip } = pageParams(dto);

    const where: Prisma.InvoiceWhereInput = {
      OR: [{ issuerId: userId }, { recipientId: userId }],
    };

    if (dto.status) where.status = dto.status as any;
    if (dto.dateFrom || dto.dateTo) {
      where.createdAt = {};
      if (dto.dateFrom) (where.createdAt as any).gte = new Date(dto.dateFrom);
      if (dto.dateTo) (where.createdAt as any).lte = new Date(dto.dateTo);
    }
    if (dto.search) {
      where.AND = [
        {
          OR: [
            { invoiceNumber: { contains: dto.search, mode: 'insensitive' } },
            { description: { contains: dto.search, mode: 'insensitive' } },
            {
              issuer: {
                firstName: { contains: dto.search, mode: 'insensitive' },
              },
            },
            {
              recipient: {
                firstName: { contains: dto.search, mode: 'insensitive' },
              },
            },
          ],
        },
      ];
    }

    const orderBy: any =
      dto.sortBy === 'amount'
        ? { total: dto.sortOrder || 'desc' }
        : dto.sortBy === 'dueDate'
          ? { dueDate: dto.sortOrder || 'desc' }
          : { createdAt: dto.sortOrder || 'desc' };

    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: this.includeUsers,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return paginate(items, total, page, limit);
  }

  /* ------------------------------------------------------------------ */
  /*  Single invoice                                                    */
  /* ------------------------------------------------------------------ */

  async findOne(id: string, userId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: this.includeUsers,
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    // Check access: issuer, recipient, or admin
    if (invoice.issuerId !== userId && invoice.recipientId !== userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (!['ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN'].includes(user?.role || '')) {
        throw new ForbiddenException('Not authorized to view this invoice');
      }
    }

    return invoice;
  }

  /* ------------------------------------------------------------------ */
  /*  Status transitions                                                */
  /* ------------------------------------------------------------------ */

  async send(id: string, userId: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.issuerId !== userId)
      throw new ForbiddenException('Only the issuer can send this invoice');
    if (invoice.status !== 'DRAFT')
      throw new BadRequestException(`Cannot send invoice with status ${invoice.status}`);

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: 'SENT', issuedAt: new Date() },
      include: this.includeUsers,
    });

    // Send email notification to the recipient (best effort)
    const recipient = await this.prisma.user.findUnique({ where: { id: invoice.recipientId } });
    const issuer = await this.prisma.user.findUnique({ where: { id: invoice.issuerId } });
    if (recipient?.email) {
      const issuerName = issuer ? `${issuer.firstName} ${issuer.lastName}`.trim() : 'Uteo';
      const totalFormatted = `KES ${Number(invoice.total).toLocaleString('en-KE')}`;
      const dueDateFormatted = invoice.dueDate
        ? new Date(invoice.dueDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'On receipt';

      this.brevoService.sendEmail({
        to: [{ email: recipient.email, name: recipient.firstName || undefined }],
        subject: `Invoice ${invoice.invoiceNumber} from ${issuerName}`,
        htmlContent: `
          <div style="font-family: 'Segoe UI', system-ui, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
            <div style="background: #1E3A5F; padding: 24px 32px; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 20px;">Uteo</h1>
              <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0; font-size: 12px;">LEARN, GROW, SUCCEED</p>
            </div>
            <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; margin-bottom: 16px;">Hi ${recipient.firstName},</p>
              <p style="font-size: 14px; color: #475569; margin-bottom: 24px;">
                You have received a new invoice from <strong>${issuerName}</strong>.
              </p>
              <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Invoice #</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 600;">${invoice.invoiceNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Amount</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 700; font-size: 18px; color: #1E3A5F;">${totalFormatted}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Due Date</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 600;">${dueDateFormatted}</td>
                  </tr>
                </table>
              </div>
              <p style="font-size: 14px; color: #475569; margin-bottom: 24px;">
                Log in to your Uteo account to view the full invoice and make a payment.
              </p>
              <p style="font-size: 13px; color: #94a3b8; margin-top: 32px;">
                Best regards,<br/>The Uteo Team
              </p>
            </div>
          </div>`,
      }).catch(() => {}); // Best effort — don't fail the send if email fails
    }

    return updated;
  }

  async markPaid(id: string, userId: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    // Issuer or admin can mark as paid
    if (invoice.issuerId !== userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (!['ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN'].includes(user?.role || '')) {
        throw new ForbiddenException('Not authorized');
      }
    }

    if (!['SENT', 'OVERDUE', 'DRAFT'].includes(invoice.status))
      throw new BadRequestException(`Cannot mark as paid from status ${invoice.status}`);

    return this.prisma.invoice.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
      include: this.includeUsers,
    });
  }

  async void(id: string, userId: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.issuerId !== userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (!['ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN'].includes(user?.role || '')) {
        throw new ForbiddenException('Not authorized');
      }
    }
    if (invoice.status === 'PAID')
      throw new BadRequestException('Cannot void a paid invoice');

    return this.prisma.invoice.update({
      where: { id },
      data: { status: 'VOID' },
      include: this.includeUsers,
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Admin: list all invoices                                          */
  /* ------------------------------------------------------------------ */

  async adminFindAll(dto: AdminListInvoicesDto) {
    const { page, limit, skip } = pageParams(dto);

    const where: Prisma.InvoiceWhereInput = {};
    if (dto.status) where.status = dto.status as any;
    if (dto.issuerId) where.issuerId = dto.issuerId;
    if (dto.recipientId) where.recipientId = dto.recipientId;
    if (dto.dateFrom || dto.dateTo) {
      where.createdAt = {};
      if (dto.dateFrom) (where.createdAt as any).gte = new Date(dto.dateFrom);
      if (dto.dateTo) (where.createdAt as any).lte = new Date(dto.dateTo);
    }
    if (dto.search) {
      where.OR = [
        { invoiceNumber: { contains: dto.search, mode: 'insensitive' } },
        { description: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: this.includeUsers,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return paginate(items, total, page, limit);
  }

  /* ------------------------------------------------------------------ */
  /*  My stats                                                          */
  /* ------------------------------------------------------------------ */

  async getStats(userId: string) {
    const [issued, paid, outstanding] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { issuerId: userId },
        _count: true,
        _sum: { total: true },
      }),
      this.prisma.invoice.aggregate({
        where: { issuerId: userId, status: 'PAID' },
        _count: true,
        _sum: { total: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          issuerId: userId,
          status: { in: ['SENT', 'OVERDUE'] },
        },
        _count: true,
        _sum: { total: true },
      }),
    ]);

    return {
      totalIssued: issued._count,
      totalIssuedAmount: Number(issued._sum.total || 0),
      totalPaid: paid._count,
      totalPaidAmount: Number(paid._sum.total || 0),
      outstandingCount: outstanding._count,
      outstandingAmount: Number(outstanding._sum.total || 0),
    };
  }
}
