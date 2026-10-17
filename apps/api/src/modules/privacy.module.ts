import { BadRequestException, Body, Controller, Get, Inject, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { randomUUID } from "crypto";
import { and, desc, eq, ne } from "drizzle-orm";
import { AdminGuard, AuthGuard, AuthUser, CurrentUser } from "../common/auth";
import { DB, Database } from "../database/database.module";
import { privacyRequests, users } from "../database/schema";

class PrivacyRequestDto {
  @IsIn(["access", "correction", "deletion", "objection"]) kind!: string;
  @IsOptional() @IsString() @MaxLength(2000) details?: string;
}
class PrivacyReviewDto {
  @IsIn(["new", "in_review", "closed"]) status!: string;
  @IsString() @MaxLength(4000) response!: string;
}
@Injectable()
export class PrivacyService {
  constructor(@Inject(DB) private db: Database) {}
  async submit(userId: string, dto: PrivacyRequestDto) {
    const existing = await this.db.select().from(privacyRequests).where(and(eq(privacyRequests.userId, userId), eq(privacyRequests.kind, dto.kind), ne(privacyRequests.status, "closed"))).limit(1);
    if (existing[0]) return existing[0];
    const [row] = await this.db.insert(privacyRequests).values({ userId, kind: dto.kind, details: dto.details?.trim() || "", reference: `MPWR-PR-${randomUUID().toUpperCase()}` }).onConflictDoNothing().returning();
    if (row) return row;
    // A concurrent double tap must return the original receipt.
    return (await this.db.select().from(privacyRequests).where(and(eq(privacyRequests.userId, userId), eq(privacyRequests.kind, dto.kind), ne(privacyRequests.status, "closed"))).limit(1))[0];
  }
}
@UseGuards(AuthGuard)
@Controller("privacy-requests")
class PrivacyController {
  constructor(private service: PrivacyService, @Inject(DB) private db: Database) {}
  @Post() submit(@CurrentUser() user: AuthUser, @Body() dto: PrivacyRequestDto) { return this.service.submit(user.sub, dto); }
  @Get() list(@CurrentUser() user: AuthUser) {
    return this.db.select({ reference: privacyRequests.reference, kind: privacyRequests.kind, details: privacyRequests.details, status: privacyRequests.status, response: privacyRequests.response, createdAt: privacyRequests.createdAt, updatedAt: privacyRequests.updatedAt }).from(privacyRequests).where(eq(privacyRequests.userId, user.sub)).orderBy(desc(privacyRequests.createdAt));
  }
}
@UseGuards(AdminGuard)
@Controller("admin/privacy-requests")
class AdminPrivacyController {
  constructor(@Inject(DB) private db: Database) {}
  @Get() list() {
    return this.db.select({ request: privacyRequests, email: users.email }).from(privacyRequests).innerJoin(users, eq(privacyRequests.userId, users.id)).orderBy(desc(privacyRequests.createdAt));
  }
  @Patch(":id") async review(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: PrivacyReviewDto) {
    const response = dto.response.trim();
    if (dto.status === "closed" && !response) throw new BadRequestException("Record the outcome and any retention reasons before closing a request");
    const [row] = await this.db.update(privacyRequests).set({ status: dto.status, response, reviewedBy: user.sub, updatedAt: new Date() }).where(eq(privacyRequests.id, id)).returning();
    if (!row) throw new NotFoundException("Privacy request not found");
    return row;
  }
}
@Module({ controllers: [PrivacyController, AdminPrivacyController], providers: [PrivacyService], exports: [PrivacyService] })
export class PrivacyModule {}
