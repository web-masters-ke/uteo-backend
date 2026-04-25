import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../services/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Missing authentication token');

    try {
      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET || 'ptak-dev-secret-change-me',
      ) as { sub: string; email: string; role: string };

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, status: true, phone: true, avatar: true,
          emailVerified: true, phoneVerified: true,
          // Include team membership to determine org role
          teamMembership: { where: { isActive: true }, select: { role: true, firmId: true, title: true }, take: 1 },
          firmMembers: { where: { isActive: true }, select: { id: true }, take: 1 },
        },
      });

      if (!user) throw new UnauthorizedException('User not found');
      if (user.status !== 'ACTIVE') throw new UnauthorizedException('Account is not active');

      // Determine team role: OWNER if they have firm members under them, or their teamMembership role
      const teamMembership = (user as any).teamMembership?.[0];
      const hasFirmMembers = (user as any).firmMembers?.length > 0;
      const teamRole = hasFirmMembers ? 'OWNER' : teamMembership?.role || null;
      const firmId = hasFirmMembers ? user.id : teamMembership?.firmId || null;

      const { teamMembership: _tm, firmMembers: _fm, ...cleanUser } = user as any;
      request.user = { ...cleanUser, sub: user.id, teamRole, firmId, isOrgOwner: teamRole === 'OWNER' || teamRole === 'ADMIN' };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(request: any): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) return null;
    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : null;
  }
}
