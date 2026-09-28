import { BadRequestException, Body, Controller, ForbiddenException, Get, Inject, Injectable, Module, NotFoundException, Param, Patch, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { IsArray, IsEmail, IsIn, IsOptional, IsString, Length, MaxLength, MinLength } from "class-validator";
import { createHash, randomInt, randomUUID } from "crypto";
import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { AdminGuard, AuthUser, CurrentUser } from "../common/auth";
import { normalizePhone } from "../common/phone";
import { DB, Database } from "../database/database.module";
import { accountAppeals, authTokens, users } from "../database/schema";
import { MediaModule, MediaService, MultipartRequest } from "./media.module";

class EmailDto { @IsEmail() email!: string; }
class VerifyDto extends EmailDto { @IsString() @Length(6, 6) code!: string; }
class AppealDto { @IsString() @MinLength(20) @MaxLength(3000) explanation!: string; @IsOptional() @IsArray() evidence?: Array<{ key: string; url: string; contentType?: string; size?: number }>; }
class DecisionDto { @IsIn(["approved", "rejected", "more_information_required"]) status!: string; @IsString() @MinLength(3) @MaxLength(1200) response!: string; }
type AppealSession = { sub: string; email: string; purpose: "account_appeal" };

@Injectable()
class AccountAppealsService {
  constructor(@Inject(DB) private db: Database, private jwt: JwtService, private config: ConfigService, private media: MediaService) {}
  private hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
  private async account(email: string) { return (await this.db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1))[0]; }
  async requestCode(emailInput: string) {
    const email = emailInput.trim().toLowerCase();
    const user = await this.account(email);
    if (!user?.blockedAt || user.role !== "customer") return { ok: true, message: "If a blocked account matches that email, a verification code has been sent." };
    const code = String(randomInt(100000, 1000000));
    await this.db.insert(authTokens).values({ userId: user.id, purpose: "account_appeal", tokenHash: this.hash(code), expiresAt: new Date(Date.now() + 15 * 60_000) });
    const apiKey = this.config.get<string>("RESEND_API_KEY");
    if (apiKey) await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: this.config.get("AUTH_EMAIL_FROM", "MPWR <accounts@example.com>"), to: [email], subject: "Your MPWR appeal verification code", html: `<p>Your verification code is <strong>${code}</strong>.</p><p>It expires in 15 minutes.</p>` }) });
    return { ok: true, message: "If a blocked account matches that email, a verification code has been sent.", ...(process.env.NODE_ENV === "production" ? {} : { previewCode: code }) };
  }
  async verify(emailInput: string, code: string) {
    const email = emailInput.trim().toLowerCase();
    const user = await this.account(email);
    if (!user?.blockedAt) throw new UnauthorizedException("The code is invalid or expired");
    const [token] = await this.db.select().from(authTokens).where(and(eq(authTokens.userId, user.id), eq(authTokens.purpose, "account_appeal"), eq(authTokens.tokenHash, this.hash(code)), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date()))).orderBy(desc(authTokens.createdAt)).limit(1);
    if (!token) throw new UnauthorizedException("The code is invalid or expired");
    await this.db.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, token.id));
    const appealToken = await this.jwt.signAsync({ sub: user.id, email, purpose: "account_appeal" }, { secret: this.config.getOrThrow("JWT_SECRET"), expiresIn: "30m" });
    return { token: appealToken, account: { email, blockedAt: user.blockedAt, reason: user.blockReason || "Your account activity requires review before access can be restored." } };
  }
  async session(request: any): Promise<AppealSession> {
    const token = String(request.headers["x-appeal-token"] || "");
    try { const session = await this.jwt.verifyAsync<AppealSession>(token, { secret: this.config.getOrThrow("JWT_SECRET") }); if (session.purpose !== "account_appeal") throw new Error(); return session; }
    catch { throw new UnauthorizedException("Your appeal session expired. Verify your email again."); }
  }
  async upload(request: MultipartRequest) { const session = await this.session(request); return this.media.uploadAppeal(session.sub, request); }
  async submit(request: any, dto: AppealDto) {
    const session = await this.session(request);
    const [user] = await this.db.select().from(users).where(eq(users.id, session.sub)).limit(1);
    if (!user?.blockedAt) throw new BadRequestException("This account is not currently blocked");
    const [existing] = await this.db.select().from(accountAppeals).where(and(eq(accountAppeals.userId, user.id), eq(accountAppeals.status, "submitted"))).limit(1);
    if (existing) throw new BadRequestException(`An appeal is already under review (${existing.reference})`);
    const reference = `MPWR-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const evidence = (dto.evidence || []).slice(0, 3).filter(item => item.key?.startsWith(`appeal/${user.id}/`));
    const [appeal] = await this.db.insert(accountAppeals).values({ reference, userId: user.id, email: user.email, blockReason: user.blockReason, explanation: dto.explanation.trim(), evidence }).returning();
    return { reference: appeal.reference, status: appeal.status, createdAt: appeal.createdAt };
  }
  list() { return this.db.select().from(accountAppeals).orderBy(desc(accountAppeals.createdAt)); }
  async decide(admin: AuthUser, id: string, dto: DecisionDto) {
    const [appeal] = await this.db.select().from(accountAppeals).where(eq(accountAppeals.id, id)).limit(1);
    if (!appeal) throw new NotFoundException("Appeal not found");
    if (dto.status === "approved") {
      const [account] = await this.db.select({ phone: users.phone }).from(users).where(eq(users.id, appeal.userId)).limit(1);
      const phone = normalizePhone(account?.phone);
      const related = phone ? (await this.db.select({ id: users.id, phone: users.phone }).from(users).where(eq(users.role, "customer"))).filter(user => normalizePhone(user.phone) === phone).map(user => user.id) : [appeal.userId];
      await this.db.update(users).set({ blockedAt: null, blockedBy: null, blockReason: null, updatedAt: new Date() }).where(inArray(users.id, related));
    }
    const [updated] = await this.db.update(accountAppeals).set({ status: dto.status, adminResponse: dto.response.trim(), reviewedBy: admin.sub, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(accountAppeals.id, id)).returning();
    return updated;
  }
}

@Controller("account-appeals")
class AccountAppealsController {
  constructor(private service: AccountAppealsService) {}
  @Post("request-code") request(@Body() dto: EmailDto) { return this.service.requestCode(dto.email); }
  @Post("verify") verify(@Body() dto: VerifyDto) { return this.service.verify(dto.email, dto.code); }
  @Post("evidence") evidence(@Req() request: MultipartRequest) { return this.service.upload(request); }
  @Post() submit(@Req() request: any, @Body() dto: AppealDto) { return this.service.submit(request, dto); }
}

@UseGuards(AdminGuard)
@Controller("admin/account-appeals")
class AdminAccountAppealsController {
  constructor(private service: AccountAppealsService) {}
  @Get() list() { return this.service.list(); }
  @Patch(":id") decide(@CurrentUser() admin: AuthUser, @Param("id") id: string, @Body() dto: DecisionDto) { return this.service.decide(admin, id, dto); }
}

@Module({ imports: [MediaModule], controllers: [AccountAppealsController, AdminAccountAppealsController], providers: [AccountAppealsService] })
export class AccountAppealsModule {}
