import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtUser {
  sub: string;
  id: string;
  email: string;
  role: string;
}

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    // Normalise: user.id is canonical; sub is jwt alias
    if (user && !user.sub) user.sub = user.id;
    if (user && !user.id) user.id = user.sub;
    return data ? user?.[data] : user;
  },
);
