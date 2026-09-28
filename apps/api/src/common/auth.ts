import { CanActivate, createParamDecorator, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { eq } from "drizzle-orm";
import { DB, Database } from "../database/database.module";
import { users } from "../database/schema";

export type AuthUser = { sub: string; email: string; role: "customer" | "orders" | "admin" };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly config: ConfigService, @Inject(DB) private readonly db: Database) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const header = String(request.headers.authorization || "");
    const token = header.startsWith("Bearer ") ? header.slice(7) : request.cookies?.mpwr_session;
    if (!token) throw new UnauthorizedException("Sign in required");
    let session: AuthUser;
    try { session = await this.jwt.verifyAsync<AuthUser>(token, { secret: this.config.getOrThrow("JWT_SECRET") }); }
    catch { throw new UnauthorizedException("Session expired"); }
    const [account] = await this.db.select({ id: users.id, email: users.email, role: users.role, blockedAt: users.blockedAt }).from(users).where(eq(users.id, session.sub)).limit(1);
    if (!account) throw new UnauthorizedException("Account no longer exists");
    if (account.blockedAt && account.role === "customer") throw new ForbiddenException("This account has been blocked. Contact MPWR support if you think this is a mistake.");
    request.user = { sub: account.id, email: account.email, role: account.role };
    return true;
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

@Injectable()
export class OrdersGuard implements CanActivate {
  constructor(private readonly auth: AuthGuard) {}
  async canActivate(context: ExecutionContext) {
    await this.auth.canActivate(context);
    const role = context.switchToHttp().getRequest().user?.role;
    if (role !== "admin" && role !== "orders") throw new ForbiddenException("Orders access required");
    return true;
  }
}

export const CurrentUser = createParamDecorator((_data, context: ExecutionContext): AuthUser => context.switchToHttp().getRequest().user);
