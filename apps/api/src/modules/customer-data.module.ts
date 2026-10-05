import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Inject, Module, NotFoundException, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { and, desc, eq, gte, inArray, isNotNull, ne, not, or, sql } from "drizzle-orm";
import { AdminGuard, AuthGuard, AuthUser, CurrentUser } from "../common/auth";
import { normalizePhone } from "../common/phone";
import { DB, Database } from "../database/database.module";
import { carts, favorites, orderItems, orders, products, reviews, searchDailyAnalytics, searchEvents, storefrontSettings, users } from "../database/schema";

class ItemsDto { @IsArray() items!: unknown[]; }
class ProfileDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() profileImage?: string;
  @IsOptional() @IsArray() shippingAddresses?: unknown[];
  @IsOptional() @IsArray() paymentMethods?: unknown[];
}
class ReviewDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsString() text!: string;
  @IsOptional() @IsString() customerName?: string;
  @IsOptional() @IsObject() purchasedOptions?: Record<string, unknown>;
  @IsOptional() @IsObject() attachment?: Record<string, unknown>;
}
class ReviewAttachmentDto { @IsObject() attachment!: Record<string, unknown>; }
class ReviewReplyDto { @IsString() @MaxLength(1200) reply!: string; }
class ReviewSeenDto { @IsBoolean() seen!: boolean; }
class SettingDto { @IsObject() value!: Record<string, unknown>; }
class SearchEventDto {
  @IsString() @MaxLength(80) anonymousId!: string;
  @IsString() @MaxLength(120) query!: string;
  @IsString() kind!: "search" | "click" | "purchase";
  @IsOptional() @IsInt() @Min(0) resultCount?: number;
  @IsOptional() @IsString() @MaxLength(100) productId?: string;
  @IsOptional() @IsString() @MaxLength(120) correctedQuery?: string;
  @IsOptional() @IsInt() @Min(0) revenue?: number;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}
class UserBlockDto { @IsBoolean() blocked!: boolean; @IsOptional() @IsString() @MaxLength(500) reason?: string; }
type StoredReviewAttachment =
  | { key: string; url: string; type: string; name: string }
  | { items: StoredReviewAttachment[] };

function settingText(value: unknown, name: string, maxLength: number) {
  if (typeof value !== "string") throw new BadRequestException(`${name} must be text`);
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned || cleaned.length > maxLength) throw new BadRequestException(`${name} must contain 1 to ${maxLength} characters`);
  return cleaned;
}

function safeStorefrontLink(value: unknown) {
  const link = settingText(value, "Hero button link", 140);
  if (/^(?:#|\/|\.\/|\.\.\/)/.test(link)) return link;
  try {
    const parsed = new URL(link, "https://mpwr.local/");
    if (["http:", "https:"].includes(parsed.protocol)) return link;
  } catch {}
  throw new BadRequestException("Hero button link must be a page, section, HTTP, or HTTPS URL");
}

function normalizeHomepageHeroSetting(value: Record<string, unknown>, publicMediaBase: string) {
  const allowed = new Set(["enabled", "eyebrow", "heading", "body", "buttonLabel", "buttonLink", "image", "imageKey", "images"]);
  if (Object.keys(value).some(key => !allowed.has(key))) throw new BadRequestException("Homepage hero contains unsupported fields");
  if (typeof value.enabled !== "boolean") throw new BadRequestException("Hero visibility must be true or false");
  if (!Array.isArray(value.images) || value.images.length > 10) throw new BadRequestException("Add no more than 10 hero images");
  const slots = new Set<number>();
  const images = value.images.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new BadRequestException("Invalid hero image");
    const item = entry as Record<string, unknown>;
    if (Object.keys(item).some(key => !["url", "key", "source", "slot"].includes(key))) throw new BadRequestException("Hero image contains unsupported fields");
    const url = settingText(item.url, "Hero image URL", 500);
    const key = typeof item.key === "string" ? item.key.trim() : "";
    const slot = Number(item.slot ?? index + 1);
    if (!Number.isInteger(slot) || slot < 1 || slot > 10 || slots.has(slot)) throw new BadRequestException("Hero image slots must be unique numbers from 1 to 10");
    slots.add(slot);
    const isBundledImage = /^(?:\/)?images\//i.test(url);
    if (key) {
      if (!/^banner\/[0-9a-f-]{36}\/[0-9a-f-]+\.(?:jpe?g|png|webp|gif)$/i.test(key) || !publicMediaBase || url !== `${publicMediaBase}/${key}`) throw new BadRequestException("Invalid stored hero image");
    } else if (!isBundledImage) {
      throw new BadRequestException("External hero images must be imported into MPWR storage before saving");
    }
    return { url, key, source: key ? "upload" : "", slot };
  }).sort((a, b) => a.slot - b.slot);
  return {
    enabled: value.enabled,
    eyebrow: settingText(value.eyebrow, "Hero small label", 40),
    heading: settingText(value.heading, "Hero heading", 80),
    body: settingText(value.body, "Hero description", 180),
    buttonLabel: settingText(value.buttonLabel, "Hero button text", 32),
    buttonLink: safeStorefrontLink(value.buttonLink),
    image: images[0]?.url || "",
    imageKey: images[0]?.key || "",
    images
  };
}

function normalizeSearchAnalyticsQuery(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 120);
}

function searchAnalyticsDay(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

async function recordSearchAnalytics(
  db: Database,
  event: {
    anonymousId: string;
    query: string;
    kind: "search" | "click" | "purchase";
    resultCount?: number | null;
    productId?: string | null;
    correctedQuery?: string | null;
    revenue?: number;
    metadata?: Record<string, unknown>;
  }
) {
  const query = normalizeSearchAnalyticsQuery(event.query);
  if (!query) return;
  const normalizedQuery = query.toLowerCase();
  const day = searchAnalyticsDay();
  const resultCount = Math.max(0, Number(event.resultCount) || 0);
  const revenue = Math.max(0, Number(event.revenue) || 0);
  const productId = event.productId?.trim().slice(0, 100) || "";
  const productJson = productId ? { [productId]: 1 } : {};
  await db.insert(searchEvents).values({
    anonymousId: event.anonymousId.trim().slice(0, 80) || "anonymous",
    query,
    kind: event.kind,
    resultCount: event.kind === "search" ? resultCount : null,
    productId: ["click", "purchase"].includes(event.kind) ? productId || null : null,
    correctedQuery: event.correctedQuery?.trim().slice(0, 120) || null,
    revenue: event.kind === "purchase" ? revenue : 0,
    metadata: event.metadata || {}
  });
  await db.insert(searchDailyAnalytics).values({
    day,
    query,
    normalizedQuery,
    searches: event.kind === "search" ? 1 : 0,
    clicks: event.kind === "click" ? 1 : 0,
    purchases: event.kind === "purchase" ? 1 : 0,
    revenue: event.kind === "purchase" ? revenue : 0,
    zeroResults: event.kind === "search" && resultCount === 0 ? 1 : 0,
    resultImpressions: event.kind === "search" ? resultCount : 0,
    clickedProducts: event.kind === "click" ? productJson : {},
    purchasedProducts: event.kind === "purchase" ? productJson : {}
  }).onConflictDoUpdate({
    target: [searchDailyAnalytics.day, searchDailyAnalytics.normalizedQuery],
    set: {
      query,
      searches: sql`${searchDailyAnalytics.searches} + ${event.kind === "search" ? 1 : 0}`,
      clicks: sql`${searchDailyAnalytics.clicks} + ${event.kind === "click" ? 1 : 0}`,
      purchases: sql`${searchDailyAnalytics.purchases} + ${event.kind === "purchase" ? 1 : 0}`,
      revenue: sql`${searchDailyAnalytics.revenue} + ${event.kind === "purchase" ? revenue : 0}`,
      zeroResults: sql`${searchDailyAnalytics.zeroResults} + ${event.kind === "search" && resultCount === 0 ? 1 : 0}`,
      resultImpressions: sql`${searchDailyAnalytics.resultImpressions} + ${event.kind === "search" ? resultCount : 0}`,
      clickedProducts: productId && event.kind === "click"
        ? sql`${searchDailyAnalytics.clickedProducts} || jsonb_build_object(${productId}, (coalesce((${searchDailyAnalytics.clickedProducts}->>${productId})::int, 0) + 1))`
        : sql`${searchDailyAnalytics.clickedProducts}`,
      purchasedProducts: productId && event.kind === "purchase"
        ? sql`${searchDailyAnalytics.purchasedProducts} || jsonb_build_object(${productId}, (coalesce((${searchDailyAnalytics.purchasedProducts}->>${productId})::int, 0) + 1))`
        : sql`${searchDailyAnalytics.purchasedProducts}`,
      updatedAt: new Date()
    }
  });
}

async function resolveProduct(db: Database, identifier: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
  const [product] = await db.select().from(products).where(isUuid ? or(eq(products.id, identifier), eq(products.legacyId, identifier)) : eq(products.legacyId, identifier)).limit(1);
  if (!product) throw new NotFoundException("Product not found");
  return product;
}

@UseGuards(AuthGuard)
@Controller("profile")
class ProfileController {
  constructor(@Inject(DB) private db: Database) {}
  @Get() async get(@CurrentUser() auth: AuthUser) { const [user] = await this.db.select().from(users).where(eq(users.id, auth.sub)).limit(1); if (!user) throw new NotFoundException("Profile not found"); const legacy = user.legacyData as Record<string, unknown>; return { id: user.id, firebaseUid: user.firebaseUid, email: user.email, firstName: user.firstName, lastName: user.lastName, phone: user.phone, profileImage: user.profileImage, role: user.role, paymentMethods: user.paymentMethods, ...legacy }; }
  @Patch() async update(@CurrentUser() auth: AuthUser, @Body() dto: ProfileDto) { const [current] = await this.db.select().from(users).where(eq(users.id, auth.sub)).limit(1); if (!current) throw new NotFoundException("Profile not found"); const normalizedPhone = normalizePhone(dto.phone); if (normalizedPhone) { const blockedPhones = await this.db.select({ phone: users.phone }).from(users).where(and(eq(users.role, "customer"), not(eq(users.id, auth.sub)), isNotNull(users.blockedAt))); if (blockedPhones.some(account => normalizePhone(account.phone) === normalizedPhone)) throw new ForbiddenException("This mobile number has been blocked. Contact MPWR support if you think this is a mistake."); } const { shippingAddresses, paymentMethods, ...fields } = dto; const legacyData = { ...(current.legacyData as Record<string, unknown>), ...(shippingAddresses ? { shippingAddresses } : {}) }; const [user] = await this.db.update(users).set({ ...fields, ...(paymentMethods ? { paymentMethods } : {}), legacyData, updatedAt: new Date() }).where(eq(users.id, auth.sub)).returning(); return user; }
}

@UseGuards(AuthGuard)
@Controller("cart")
class CartController {
  constructor(@Inject(DB) private db: Database) {}
  @Get() async get(@CurrentUser() user: AuthUser) { const [cart] = await this.db.select().from(carts).where(eq(carts.userId, user.sub)).limit(1); return cart || { userId: user.sub, items: [] }; }
  @Put() async put(@CurrentUser() user: AuthUser, @Body() dto: ItemsDto) { const [cart] = await this.db.insert(carts).values({ userId: user.sub, items: dto.items }).onConflictDoUpdate({ target: carts.userId, set: { items: dto.items, updatedAt: new Date() } }).returning(); return cart; }
}

@UseGuards(AuthGuard)
@Controller("favorites")
class FavoritesController {
  constructor(@Inject(DB) private db: Database) {}
  @Get() async get(@CurrentUser() user: AuthUser) { const [list] = await this.db.select().from(favorites).where(eq(favorites.userId, user.sub)).limit(1); return list || { userId: user.sub, items: [] }; }
  @Put() async put(@CurrentUser() user: AuthUser, @Body() dto: ItemsDto) { const [list] = await this.db.insert(favorites).values({ userId: user.sub, items: dto.items }).onConflictDoUpdate({ target: favorites.userId, set: { items: dto.items, updatedAt: new Date() } }).returning(); return list; }
}

@Controller("reviews")
class ReviewsController {
  constructor(@Inject(DB) private db: Database, private config: ConfigService) {}
  private reviewAttachment(user: AuthUser, attachment: Record<string, unknown>): StoredReviewAttachment {
    if (Array.isArray(attachment.items)) {
      if (attachment.items.length > 5) throw new BadRequestException("Add up to 5 review images");
      if (!attachment.items.length) return { items: [] };
      return { items: attachment.items.map(item => {
        if (!item || typeof item !== "object" || Array.isArray(item)) throw new BadRequestException("Invalid review image");
        return this.reviewAttachment(user, item as Record<string, unknown>);
      }) };
    }
    const key = String(attachment.key || "");
    const url = String(attachment.url || "");
    const type = String(attachment.type || "");
    const name = String(attachment.name || "Review photo").slice(0, 255);
    const baseUrl = String(this.config.get("R2_PUBLIC_BASE_URL", "")).replace(/\/$/, "");
    if (!key.startsWith(`review/${user.sub}/`) || !baseUrl || url !== `${baseUrl}/${key}`) throw new BadRequestException("Invalid review image");
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(type)) throw new BadRequestException("Use a JPEG, PNG, WebP, or GIF image");
    return { key, url, type, name };
  }
  private selection = { id: reviews.id, userId: reviews.userId, productId: products.legacyId, productTitle: products.title, customerName: reviews.customerName, rating: reviews.rating, text: reviews.text, purchasedOptions: reviews.purchasedOptions, attachment: reviews.attachment, verifiedPurchase: reviews.verifiedPurchase, adminReply: reviews.adminReply, adminRepliedAt: reviews.adminRepliedAt, createdAt: reviews.createdAt, updatedAt: reviews.updatedAt };
  @Get() async list(@Query("productId") productId: string) { const product = await resolveProduct(this.db, productId); return this.db.select(this.selection).from(reviews).innerJoin(products, eq(reviews.productId, products.id)).where(eq(reviews.productId, product.id)).orderBy(desc(reviews.createdAt)); }
  @UseGuards(AuthGuard) @Get("mine") listMine(@CurrentUser() user: AuthUser) { return this.db.select(this.selection).from(reviews).innerJoin(products, eq(reviews.productId, products.id)).where(eq(reviews.userId, user.sub)).orderBy(desc(reviews.createdAt)); }
  @UseGuards(AuthGuard) @Get("mine/:productId") async mine(@CurrentUser() user: AuthUser, @Param("productId") productId: string) { const product = await resolveProduct(this.db, productId); const [review] = await this.db.select().from(reviews).where(and(eq(reviews.userId, user.sub), eq(reviews.productId, product.id))).limit(1); return review || null; }
  @UseGuards(AuthGuard) @Put(":productId") async save(@CurrentUser() user: AuthUser, @Param("productId") productId: string, @Body() dto: ReviewDto) { const product = await resolveProduct(this.db, productId); const [purchase] = await this.db.select({ id: orderItems.id }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).where(and(eq(orders.userId, user.sub), eq(orderItems.productId, product.id), not(inArray(orders.status, ["cancelled", "returned"])))).limit(1); if (!purchase) throw new ForbiddenException("Only customers who purchased this product can review it"); const [account] = await this.db.select().from(users).where(eq(users.id, user.sub)).limit(1); const values = { userId: user.sub, productId: product.id, customerName: dto.customerName || `${account.firstName} ${account.lastName}`.trim(), rating: dto.rating, text: dto.text, purchasedOptions: dto.purchasedOptions || {}, ...(dto.attachment ? { attachment: this.reviewAttachment(user, dto.attachment) } : {}), verifiedPurchase: true }; const [review] = await this.db.insert(reviews).values(values).onConflictDoUpdate({ target: [reviews.userId, reviews.productId], set: { ...values, updatedAt: new Date() } }).returning(); return review; }
  @UseGuards(AuthGuard) @Patch(":productId/attachment") async attachment(@CurrentUser() user: AuthUser, @Param("productId") productId: string, @Body() dto: ReviewAttachmentDto) { const product = await resolveProduct(this.db, productId); const [review] = await this.db.update(reviews).set({ attachment: this.reviewAttachment(user, dto.attachment), updatedAt: new Date() }).where(and(eq(reviews.userId, user.sub), eq(reviews.productId, product.id))).returning(); if (!review) throw new NotFoundException("Review not found"); return review; }
  @UseGuards(AuthGuard) @Delete(":productId") async remove(@CurrentUser() user: AuthUser, @Param("productId") productId: string) { const product = await resolveProduct(this.db, productId); const [review] = await this.db.delete(reviews).where(and(eq(reviews.userId, user.sub), eq(reviews.productId, product.id))).returning({ attachment: reviews.attachment }); if (!review) throw new NotFoundException("Review not found"); return review; }
}

@UseGuards(AdminGuard)
@Controller("admin/reviews")
class AdminReviewsController {
  constructor(@Inject(DB) private db: Database) {}
  private selection = { id: reviews.id, userId: reviews.userId, customerEmail: users.email, productId: products.legacyId, productTitle: products.title, productImage: products.imageUrl, customerName: reviews.customerName, rating: reviews.rating, text: reviews.text, purchasedOptions: reviews.purchasedOptions, attachment: reviews.attachment, verifiedPurchase: reviews.verifiedPurchase, adminReply: reviews.adminReply, adminRepliedAt: reviews.adminRepliedAt, adminSeenAt: reviews.adminSeenAt, createdAt: reviews.createdAt, updatedAt: reviews.updatedAt };

  @Get() list() {
    return this.db.select(this.selection).from(reviews).innerJoin(products, eq(reviews.productId, products.id)).innerJoin(users, eq(reviews.userId, users.id)).orderBy(desc(reviews.createdAt));
  }

  @Patch(":id/reply") async reply(@CurrentUser() admin: AuthUser, @Param("id") id: string, @Body() dto: ReviewReplyDto) {
    const reply = dto.reply.trim();
    const [review] = await this.db.update(reviews).set({ adminReply: reply || null, adminRepliedAt: reply ? new Date() : null, adminRepliedBy: reply ? admin.sub : null, updatedAt: new Date() }).where(eq(reviews.id, id)).returning();
    if (!review) throw new NotFoundException("Review not found");
    return review;
  }

  @Patch(":id/seen") async seen(@CurrentUser() admin: AuthUser, @Param("id") id: string, @Body() dto: ReviewSeenDto) {
    const [review] = await this.db.update(reviews).set({ adminSeenAt: dto.seen ? new Date() : null, adminSeenBy: dto.seen ? admin.sub : null, updatedAt: new Date() }).where(eq(reviews.id, id)).returning();
    if (!review) throw new NotFoundException("Review not found");
    return review;
  }
}

@Controller("storefront")
class StorefrontController {
  constructor(@Inject(DB) private db: Database, private config: ConfigService) {}
  @Get(":key") async get(@Param("key") key: string) { const [setting] = await this.db.select().from(storefrontSettings).where(eq(storefrontSettings.key, key)).limit(1); return setting?.value || {}; }
  @UseGuards(AdminGuard) @Put(":key") async put(@Param("key") key: string, @Body() dto: SettingDto) {
    const publicMediaBase = String(this.config.get("R2_PUBLIC_BASE_URL", "")).replace(/\/$/, "");
    const value = key === "homepageHero" ? normalizeHomepageHeroSetting(dto.value, publicMediaBase) : dto.value;
    const [setting] = await this.db.insert(storefrontSettings).values({ key, value }).onConflictDoUpdate({ target: storefrontSettings.key, set: { value, updatedAt: new Date() } }).returning();
    return setting.value;
  }
}

@Controller("storefront/search-events")
class SearchEventsController {
  constructor(@Inject(DB) private db: Database) {}
  @Post() async create(@Body() dto: SearchEventDto) {
    const query = normalizeSearchAnalyticsQuery(dto.query);
    if (!query || !["search", "click", "purchase"].includes(dto.kind)) throw new BadRequestException("Invalid search event");
    await recordSearchAnalytics(this.db, {
      anonymousId: dto.anonymousId,
      query,
      kind: dto.kind,
      resultCount: dto.resultCount,
      productId: dto.productId,
      correctedQuery: dto.correctedQuery,
      revenue: dto.revenue,
      metadata: dto.metadata
    });
    return { recorded: true };
  }
}

@UseGuards(AdminGuard)
@Controller("admin/search-insights")
class AdminSearchInsightsController {
  constructor(@Inject(DB) private db: Database) {}
  @Get() async report() {
    const now = Date.now();
    const rangeDays = 30;
    const periodMs = rangeDays * 24 * 60 * 60 * 1000;
    const sinceDay = searchAnalyticsDay(new Date(now - periodMs));
    const previousSinceDay = searchAnalyticsDay(new Date(now - (periodMs * 2)));
    const [rows, productRows] = await Promise.all([
      this.db.select().from(searchDailyAnalytics).where(gte(searchDailyAnalytics.day, previousSinceDay)).orderBy(desc(searchDailyAnalytics.day)).limit(20000),
      this.db.select().from(products).where(ne(products.visibility, "draft"))
    ]);
    const productLookup = new Map<string, typeof productRows[number]>();
    productRows.forEach(product => {
      productLookup.set(String(product.id), product);
      if (product.legacyId) productLookup.set(String(product.legacyId), product);
    });
    const currentRows = rows.filter(row => String(row.day) >= sinceDay);
    const previousRows = rows.filter(row => String(row.day) < sinceDay);
    const grouped = new Map<string, { query: string; searches: number; previousSearches: number; clicks: number; purchases: number; revenue: number; zeroResults: number; resultImpressions: number; clickedProducts: Map<string, number>; purchasedProducts: Map<string, number> }>();
    const ensure = (query: string) => {
      const key = query.toLowerCase();
      const item = grouped.get(key) || { query, searches: 0, previousSearches: 0, clicks: 0, purchases: 0, revenue: 0, zeroResults: 0, resultImpressions: 0, clickedProducts: new Map<string, number>(), purchasedProducts: new Map<string, number>() };
      grouped.set(key, item);
      return item;
    };
    const mergeProducts = (target: Map<string, number>, value: unknown) => {
      Object.entries((value || {}) as Record<string, unknown>).forEach(([id, count]) => {
        target.set(id, (target.get(id) || 0) + Math.max(0, Number(count) || 0));
      });
    };
    currentRows.forEach(row => {
      const item = ensure(row.query);
      item.searches += Number(row.searches) || 0;
      item.clicks += Number(row.clicks) || 0;
      item.purchases += Number(row.purchases) || 0;
      item.revenue += Number(row.revenue) || 0;
      item.zeroResults += Number(row.zeroResults) || 0;
      item.resultImpressions += Number(row.resultImpressions) || 0;
      mergeProducts(item.clickedProducts, row.clickedProducts);
      mergeProducts(item.purchasedProducts, row.purchasedProducts);
    });
    previousRows.forEach(row => { ensure(row.query).previousSearches += Number(row.searches) || 0; });
    const categoryLabel = (slug: string) => ({ "press-ons": "Press-On Nails", wigs: "Wigs", lashes: "Lashes", products: "Products" })[slug] || slug.replace(/-/g, " ").replace(/\b\w/g, letter => letter.toUpperCase()) || "Products";
    const queries = [...grouped.values()].map(item => {
      const trendPercent = item.previousSearches
        ? Number((((item.searches - item.previousSearches) / item.previousSearches) * 100).toFixed(1))
        : item.searches ? null : 0;
      const topClickedProductId = [...item.clickedProducts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
      const topPurchasedProductId = [...item.purchasedProducts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
      const product = topPurchasedProductId ? productLookup.get(topPurchasedProductId) : topClickedProductId ? productLookup.get(topClickedProductId) : undefined;
      const metadata = (product?.metadata || {}) as Record<string, unknown>;
      const category = typeof metadata.category === "string" ? metadata.category : "products";
      const clickRate = item.searches ? Number(((item.clicks / item.searches) * 100).toFixed(1)) : 0;
      const purchaseRate = item.searches ? Number(((item.purchases / item.searches) * 100).toFixed(1)) : 0;
      const zeroResultRate = item.searches ? Number(((item.zeroResults / item.searches) * 100).toFixed(1)) : 0;
      return {
        query: item.query,
        searches: item.searches,
        previousSearches: item.previousSearches,
        clicks: item.clicks,
        clickRate,
        purchases: item.purchases,
        purchaseRate,
        revenue: item.revenue,
        zeroResults: item.zeroResults,
        zeroResultRate,
        resultImpressions: item.resultImpressions,
        trendPercent,
        suggestedLink: product ? { type: "category", id: category, label: categoryLabel(category), source: topPurchasedProductId ? "purchases" : "clicks", productId: product.id } : null
      };
    });
    return {
      rangeDays,
      totalSearches: currentRows.reduce((sum, row) => sum + (Number(row.searches) || 0), 0),
      zeroResultSearches: currentRows.reduce((sum, row) => sum + (Number(row.zeroResults) || 0), 0),
      clickRate: currentRows.reduce((sum, row) => sum + (Number(row.searches) || 0), 0) ? Number(((currentRows.reduce((sum, row) => sum + (Number(row.clicks) || 0), 0) / currentRows.reduce((sum, row) => sum + (Number(row.searches) || 0), 0)) * 100).toFixed(1)) : 0,
      totalPurchases: currentRows.reduce((sum, row) => sum + (Number(row.purchases) || 0), 0),
      attributedRevenue: currentRows.reduce((sum, row) => sum + (Number(row.revenue) || 0), 0),
      uniqueQueries: grouped.size,
      queries: queries.sort((a, b) => b.searches - a.searches || b.clicks - a.clicks),
      topQueries: queries.filter(item => item.searches).sort((a, b) => b.searches - a.searches || b.clicks - a.clicks).slice(0, 20),
      zeroResultQueries: queries.filter(item => item.zeroResults).sort((a, b) => b.zeroResults - a.zeroResults).slice(0, 8)
    };
  }
}

@UseGuards(AdminGuard)
@Controller("admin/users")
class AdminUsersController {
  constructor(@Inject(DB) private db: Database) {}
  private publicUser = { id: users.id, uid: users.id, firebaseUid: users.firebaseUid, email: users.email, firstName: users.firstName, lastName: users.lastName, phone: users.phone, role: users.role, blockedAt: users.blockedAt, blockedBy: users.blockedBy, blockReason: users.blockReason, createdAt: users.createdAt, updatedAt: users.updatedAt };
  private identifierWhere(identifier: string) { const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier); return isUuid ? or(eq(users.id, identifier), eq(users.firebaseUid, identifier)) : eq(users.firebaseUid, identifier); }
  @Get() list() { return this.db.select(this.publicUser).from(users).orderBy(desc(users.createdAt)); }
  @Get(":identifier") async one(@Param("identifier") identifier: string) { const [user] = await this.db.select(this.publicUser).from(users).where(this.identifierWhere(identifier)).limit(1); if (!user) throw new NotFoundException("User not found"); return user; }
  @Patch(":identifier/block") async block(@CurrentUser() admin: AuthUser, @Param("identifier") identifier: string, @Body() dto: UserBlockDto) {
    const [target] = await this.db.select({ id: users.id, role: users.role, phone: users.phone }).from(users).where(this.identifierWhere(identifier)).limit(1);
    if (!target) throw new NotFoundException("User not found");
    if (target.role === "admin") throw new ForbiddenException("Admin accounts cannot be blocked here");
    const reason = dto.reason?.trim() || null;
    const phone = normalizePhone(target.phone);
    const customerAccounts = phone ? await this.db.select({ id: users.id, phone: users.phone }).from(users).where(eq(users.role, "customer")) : [];
    const accountIds = phone ? customerAccounts.filter(account => normalizePhone(account.phone) === phone).map(account => account.id) : [target.id];
    const updated = await this.db.update(users).set({ blockedAt: dto.blocked ? new Date() : null, blockedBy: dto.blocked ? admin.sub : null, blockReason: dto.blocked ? reason : null, updatedAt: new Date() }).where(inArray(users.id, accountIds)).returning(this.publicUser);
    return updated.find(user => user.id === target.id);
  }
}

@Module({ controllers: [ProfileController, CartController, FavoritesController, ReviewsController, AdminReviewsController, SearchEventsController, AdminSearchInsightsController, StorefrontController, AdminUsersController] })
export class CustomerDataModule {}
