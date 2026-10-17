import { BadRequestException, Body, Controller, Get, Inject, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import { randomUUID } from "crypto";
import { desc, eq } from "drizzle-orm";
import { AdminGuard, AuthGuard, AuthUser, CurrentUser } from "../common/auth";
import { DB, Database } from "../database/database.module";
import { siteFeedback, users } from "../database/schema";

const problems: Record<string, string[]> = {
  finding: ["Search results are not relevant", "Filters or sorting are difficult to use", "Cannot find a product or category", "Product recommendations", "Other"],
  details: ["Product information is unclear or missing", "Product images do not load", "Options or prices are confusing", "Reviews or ratings are difficult to use", "Other"],
  ordering: ["Cannot add an item to my bag", "My bag does not update correctly", "Checkout is difficult to use", "Payment options are unclear", "Other"],
  other: ["Account or profile", "Wishlist or browsing history", "Navigation or page layout", "Accessibility", "Other"],
  bug: ["A page will not load", "A button or link does not work", "The website is slow", "An error message appears", "Other"]
};
class FeedbackImageDto {
  @IsString() @MaxLength(300) key!: string;
  @IsString() @MaxLength(1500) url!: string;
  @IsIn(["image/jpeg", "image/png", "image/webp", "image/gif"]) contentType!: string;
  @IsInt() @Min(1) @Max(5 * 1024 * 1024) size!: number;
}
class FeedbackDto {
  @IsIn(Object.keys(problems)) category!: string;
  @IsString() @MaxLength(150) problem!: string;
  @IsString() @MinLength(1) @MaxLength(500) description!: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) rating?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @ValidateNested({ each: true }) @Type(() => FeedbackImageDto) images?: FeedbackImageDto[];
}
class FeedbackStatusDto { @IsIn(["new", "seen", "resolved"]) status!: string; }

@UseGuards(AuthGuard)
@Controller("feedback")
class FeedbackController {
  constructor(@Inject(DB) private db: Database, private config: ConfigService) {}
  @Post() async submit(@CurrentUser() user: AuthUser, @Body() dto: FeedbackDto) {
    if (!problems[dto.category]?.includes(dto.problem)) throw new BadRequestException("Choose a problem for your selected topic");
    const description = dto.description.trim();
    if (!description) throw new BadRequestException("Describe your suggestion before submitting");
    const base = this.config.get<string>("R2_PUBLIC_BASE_URL", "").replace(/\/$/, "");
    const images = (dto.images || []).map(image => {
      if (!base || !image.key.startsWith(`feedback/${user.sub}/`) || image.url !== `${base}/${image.key}`) throw new BadRequestException("Invalid feedback image");
      return { key: image.key, url: image.url, contentType: image.contentType, size: image.size };
    });
    const reference = `MPWR-FB-${randomUUID().toUpperCase()}`;
    const [saved] = await this.db.insert(siteFeedback).values({ userId: user.sub, reference, category: dto.category, problem: dto.problem, description, rating: dto.rating, images }).returning({ reference: siteFeedback.reference, createdAt: siteFeedback.createdAt });
    return saved;
  }
}
@UseGuards(AdminGuard)
@Controller("admin/feedback")
class AdminFeedbackController {
  constructor(@Inject(DB) private db: Database) {}
  @Get() list() {
    return this.db.select({ id: siteFeedback.id, reference: siteFeedback.reference, email: users.email, category: siteFeedback.category, problem: siteFeedback.problem, description: siteFeedback.description, rating: siteFeedback.rating, images: siteFeedback.images, status: siteFeedback.status, createdAt: siteFeedback.createdAt }).from(siteFeedback).innerJoin(users, eq(siteFeedback.userId, users.id)).orderBy(desc(siteFeedback.createdAt)).limit(500);
  }
  @Patch(":id") async status(@Param("id", ParseUUIDPipe) id: string, @Body() dto: FeedbackStatusDto) {
    const [updated] = await this.db.update(siteFeedback).set({ status: dto.status, updatedAt: new Date() }).where(eq(siteFeedback.id, id)).returning({ id: siteFeedback.id, status: siteFeedback.status });
    if (!updated) throw new NotFoundException("Feedback not found");
    return updated;
  }
}
@Module({ controllers: [FeedbackController, AdminFeedbackController] })
export class FeedbackModule {}
