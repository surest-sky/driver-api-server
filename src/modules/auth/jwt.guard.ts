import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly jwt: JwtService) { super(); }

  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const header = req.headers['authorization'] as string | undefined;
    if (!header || !header.startsWith('Bearer ')) throw new UnauthorizedException();
    const token = header.substring(7);
    try {
      const payload = this.jwt.verify(token, { secret: process.env.JWT_SECRET || 'change_me_secret' });
      req.user = payload;
      return true;
    } catch (e) {
      throw new UnauthorizedException();
    }
  }
}

