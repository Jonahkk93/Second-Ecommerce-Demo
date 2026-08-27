import { CanActivate, createParamDecorator, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

export type AuthUser = { sub: string; email: string; role: "customer" | "admin" };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly config: ConfigService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const header = String(request.headers.authorization || "");
    const token = header.startsWith("Bearer ") ? header.slice(7) : request.cookies?.mpwr_session;
    if (!token) throw new UnauthorizedException("Sign in required");
    try {
      request.user = await this.jwt.verifyAsync<AuthUser>(token, { secret: this.config.getOrThrow("JWT_SECRET") });
      return true;
    } catch { throw new UnauthorizedException("Session expired"); }
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly auth: AuthGuard) {}
  async canActivate(context: ExecutionContext) {
    await this.auth.canActivate(context);
    if (context.switchToHttp().getRequest().user?.role !== "admin") throw new UnauthorizedException("Admin access required");
    return true;
  }
}

export const CurrentUser = createParamDecorator((_data, context: ExecutionContext): AuthUser => context.switchToHttp().getRequest().user);
