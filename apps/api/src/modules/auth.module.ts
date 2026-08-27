import { Body, ConflictException, Controller, Delete, Get, Inject, Injectable, Module, Patch, Post, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";
import { compare, hash } from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { FastifyReply } from "fastify";
import { AuthGuard, AuthUser, CurrentUser } from "../common/auth";
import { DB, Database } from "../database/database.module";
import { authTokens, users } from "../database/schema";

type CookieReply = FastifyReply & {
  setCookie(name: string, value: string, options: { httpOnly: boolean; secure: boolean; sameSite: "lax"; path: string; maxAge: number }): CookieReply;
  clearCookie(name: string, options: { path: string }): CookieReply;
};

class RegisterDto { @IsEmail() email!: string; @MinLength(8) password!: string; @IsString() firstName!: string; @IsString() lastName!: string; @IsOptional() @IsString() phone?: string; }
class LoginDto { @IsEmail() email!: string; @IsString() password!: string; }
class AccountDto { @IsOptional() @IsEmail() email?: string; @IsOptional() @IsString() firstName?: string; @IsOptional() @IsString() lastName?: string; @IsOptional() @IsString() profileImage?: string; }
class EmailDto { @IsEmail() email!: string; }
class TokenDto { @IsString() token!: string; }
class ResetPasswordDto extends TokenDto { @MinLength(8) password!: string; }

@Injectable()
class AuthService {
  constructor(@Inject(DB) private db: Database, private jwt: JwtService, private config: ConfigService) {}
  private publicUser(user: typeof users.$inferSelect) {
    return { id: user.id, uid: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, displayName: `${user.firstName} ${user.lastName}`.trim(), profileImage: user.profileImage, photoURL: user.profileImage, emailVerified: user.emailVerified, role: user.role };
  }
  async session(user: typeof users.$inferSelect) {
    const token = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role }, { secret: this.config.getOrThrow("JWT_SECRET"), expiresIn: "7d" });
    return { token, user: this.publicUser(user) };
  }
  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    if ((await this.db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1))[0]) throw new ConflictException("Email already registered");
    const [user] = await this.db.insert(users).values({ email, passwordHash: await hash(dto.password, 12), firstName: dto.firstName.trim(), lastName: dto.lastName.trim(), phone: dto.phone?.trim() }).returning();
    return { ...(await this.session(user)), verification: await this.issueToken(user, "verify_email", "verify-email.html", "Verify your MPWR email", "Verify your email address") };
  }
  async login(dto: LoginDto) {
    const [user] = await this.db.select().from(users).where(eq(users.email, dto.email.trim().toLowerCase())).limit(1);
    if (!user) throw new UnauthorizedException("Invalid email or password");
    if (user.localPasswordSet) {
      if (!(await compare(dto.password, user.passwordHash))) throw new UnauthorizedException("Invalid email or password");
      return this.session(user);
    }

    throw new UnauthorizedException("Reset your password once to finish moving your account to MPWR");
  }
  async me(id: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) throw new UnauthorizedException("Account no longer exists");
    return this.publicUser(user);
  }
  async updateAccount(id: string, dto: AccountDto) {
    const updates: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
    if (dto.email !== undefined) { updates.email = dto.email.trim().toLowerCase(); updates.emailVerified = false; }
    if (dto.firstName !== undefined) updates.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) updates.lastName = dto.lastName.trim();
    if (dto.profileImage !== undefined) updates.profileImage = dto.profileImage;
    try {
      const [user] = await this.db.update(users).set(updates).where(eq(users.id, id)).returning();
      if (!user) throw new UnauthorizedException("Account no longer exists");
      return this.session(user);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new ConflictException("Email already registered");
      throw error;
    }
  }
  async deleteAccount(id: string) { await this.db.delete(users).where(eq(users.id, id)); return { ok: true }; }
  private tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
  private async issueToken(user: typeof users.$inferSelect, purpose: "password_reset" | "verify_email", page: string, subject: string, action: string) {
    const token = randomBytes(32).toString("base64url");
    await this.db.insert(authTokens).values({ userId: user.id, purpose, tokenHash: this.tokenHash(token), expiresAt: new Date(Date.now() + (purpose === "password_reset" ? 60 : 24 * 60) * 60_000) });
    const url = `${this.config.get("WEB_ORIGIN", "http://127.0.0.1:5501")}/${page}?token=${encodeURIComponent(token)}`;
    const apiKey = this.config.get<string>("RESEND_API_KEY");
    if (!apiKey) return process.env.NODE_ENV === "production" ? {} : { previewUrl: url };
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: this.config.get("AUTH_EMAIL_FROM", "MPWR <accounts@example.com>"), to: [user.email], subject, html: `<p>${action} by opening the secure link below.</p><p><a href="${url}">${action}</a></p><p>This link expires automatically.</p>` }) });
    if (!response.ok) throw new Error("Authentication email could not be sent");
    return { sent: true };
  }
  async requestPasswordReset(email: string) {
    const [user] = await this.db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
    const delivery = user ? await this.issueToken(user, "password_reset", "reset-password.html", "Reset your MPWR password", "Reset your password") : {};
    return { ok: true, message: "If an account exists, a reset link has been sent.", ...delivery };
  }
  async resetPassword(dto: ResetPasswordDto) {
    const [record] = await this.db.select().from(authTokens).where(and(eq(authTokens.tokenHash, this.tokenHash(dto.token)), eq(authTokens.purpose, "password_reset"), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date()))).limit(1);
    if (!record) throw new UnauthorizedException("Reset link is invalid or expired");
    await this.db.update(users).set({ passwordHash: await hash(dto.password, 12), localPasswordSet: true, updatedAt: new Date() }).where(eq(users.id, record.userId));
    await this.db.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, record.id));
    return { ok: true };
  }
  async sendVerification(id: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) throw new UnauthorizedException("Account no longer exists");
    if (user.emailVerified) return { ok: true, alreadyVerified: true };
    return { ok: true, ...(await this.issueToken(user, "verify_email", "verify-email.html", "Verify your MPWR email", "Verify your email address")) };
  }
  async verifyEmail(token: string) {
    const [record] = await this.db.select().from(authTokens).where(and(eq(authTokens.tokenHash, this.tokenHash(token)), eq(authTokens.purpose, "verify_email"), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date()))).limit(1);
    if (!record) throw new UnauthorizedException("Verification link is invalid or expired");
    await this.db.update(users).set({ emailVerified: true, updatedAt: new Date() }).where(eq(users.id, record.userId));
    await this.db.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, record.id));
    return { ok: true };
  }
}

@Controller("auth")
class AuthController {
  constructor(private service: AuthService) {}
  private setCookie(reply: CookieReply, token: string) { reply.setCookie("mpwr_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 604800 }); }
  @Post("register") async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) reply: CookieReply) { const result = await this.service.register(dto); this.setCookie(reply, result.token); return result; }
  @Post("login") async login(@Body() dto: LoginDto, @Res({ passthrough: true }) reply: CookieReply) { const result = await this.service.login(dto); this.setCookie(reply, result.token); return result; }
  @Post("logout") logout(@Res({ passthrough: true }) reply: CookieReply) { reply.clearCookie("mpwr_session", { path: "/" }); return { ok: true }; }
  @Post("password-reset/request") requestPasswordReset(@Body() dto: EmailDto) { return this.service.requestPasswordReset(dto.email); }
  @Post("password-reset/confirm") resetPassword(@Body() dto: ResetPasswordDto) { return this.service.resetPassword(dto); }
  @UseGuards(AuthGuard) @Post("email-verification/send") sendVerification(@CurrentUser() user: AuthUser) { return this.service.sendVerification(user.sub); }
  @Post("email-verification/confirm") verifyEmail(@Body() dto: TokenDto) { return this.service.verifyEmail(dto.token); }
  @UseGuards(AuthGuard) @Get("me") me(@CurrentUser() user: AuthUser) { return this.service.me(user.sub); }
  @UseGuards(AuthGuard) @Patch("account") async updateAccount(@CurrentUser() user: AuthUser, @Body() dto: AccountDto, @Res({ passthrough: true }) reply: CookieReply) { const result = await this.service.updateAccount(user.sub, dto); this.setCookie(reply, result.token); return result; }
  @UseGuards(AuthGuard) @Delete("account") async deleteAccount(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) reply: CookieReply) { const result = await this.service.deleteAccount(user.sub); reply.clearCookie("mpwr_session", { path: "/" }); return result; }
}

@Module({ controllers: [AuthController], providers: [AuthService] })
export class AuthModule {}
