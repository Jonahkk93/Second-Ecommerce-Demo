import { Body, Controller, ForbiddenException, Get, Inject, Module, NotFoundException, Param, Patch, Put, Query, UseGuards } from "@nestjs/common";
import { IsArray, IsInt, IsObject, IsOptional, IsString, Max, Min } from "class-validator";
import { and, desc, eq, ne, or } from "drizzle-orm";
import { AdminGuard, AuthGuard, AuthUser, CurrentUser } from "../common/auth";
import { DB, Database } from "../database/database.module";
import { carts, favorites, orderItems, orders, products, reviews, storefrontSettings, users } from "../database/schema";

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
class SettingDto { @IsObject() value!: Record<string, unknown>; }

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
  @Patch() async update(@CurrentUser() auth: AuthUser, @Body() dto: ProfileDto) { const [current] = await this.db.select().from(users).where(eq(users.id, auth.sub)).limit(1); if (!current) throw new NotFoundException("Profile not found"); const { shippingAddresses, paymentMethods, ...fields } = dto; const legacyData = { ...(current.legacyData as Record<string, unknown>), ...(shippingAddresses ? { shippingAddresses } : {}) }; const [user] = await this.db.update(users).set({ ...fields, ...(paymentMethods ? { paymentMethods } : {}), legacyData, updatedAt: new Date() }).where(eq(users.id, auth.sub)).returning(); return user; }
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
  constructor(@Inject(DB) private db: Database) {}
  private selection = { id: reviews.id, userId: reviews.userId, productId: products.legacyId, productTitle: products.title, customerName: reviews.customerName, rating: reviews.rating, text: reviews.text, purchasedOptions: reviews.purchasedOptions, attachment: reviews.attachment, verifiedPurchase: reviews.verifiedPurchase, createdAt: reviews.createdAt, updatedAt: reviews.updatedAt };
  @Get() async list(@Query("productId") productId: string) { const product = await resolveProduct(this.db, productId); return this.db.select(this.selection).from(reviews).innerJoin(products, eq(reviews.productId, products.id)).where(eq(reviews.productId, product.id)).orderBy(desc(reviews.createdAt)); }
  @UseGuards(AuthGuard) @Get("mine") listMine(@CurrentUser() user: AuthUser) { return this.db.select(this.selection).from(reviews).innerJoin(products, eq(reviews.productId, products.id)).where(eq(reviews.userId, user.sub)).orderBy(desc(reviews.createdAt)); }
  @UseGuards(AuthGuard) @Get("mine/:productId") async mine(@CurrentUser() user: AuthUser, @Param("productId") productId: string) { const product = await resolveProduct(this.db, productId); const [review] = await this.db.select().from(reviews).where(and(eq(reviews.userId, user.sub), eq(reviews.productId, product.id))).limit(1); return review || null; }
  @UseGuards(AuthGuard) @Put(":productId") async save(@CurrentUser() user: AuthUser, @Param("productId") productId: string, @Body() dto: ReviewDto) { const product = await resolveProduct(this.db, productId); const [purchase] = await this.db.select({ id: orderItems.id }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).where(and(eq(orders.userId, user.sub), eq(orderItems.productId, product.id), ne(orders.status, "cancelled"))).limit(1); if (!purchase) throw new ForbiddenException("Only customers who purchased this product can review it"); const [account] = await this.db.select().from(users).where(eq(users.id, user.sub)).limit(1); const values = { userId: user.sub, productId: product.id, customerName: dto.customerName || `${account.firstName} ${account.lastName}`.trim(), rating: dto.rating, text: dto.text, purchasedOptions: dto.purchasedOptions || {}, attachment: dto.attachment, verifiedPurchase: true }; const [review] = await this.db.insert(reviews).values(values).onConflictDoUpdate({ target: [reviews.userId, reviews.productId], set: { ...values, updatedAt: new Date() } }).returning(); return review; }
  @UseGuards(AuthGuard) @Patch(":productId/attachment") async attachment(@CurrentUser() user: AuthUser, @Param("productId") productId: string, @Body() dto: ReviewAttachmentDto) { const product = await resolveProduct(this.db, productId); const [review] = await this.db.update(reviews).set({ attachment: dto.attachment, updatedAt: new Date() }).where(and(eq(reviews.userId, user.sub), eq(reviews.productId, product.id))).returning(); if (!review) throw new NotFoundException("Review not found"); return review; }
}

@Controller("storefront")
class StorefrontController {
  constructor(@Inject(DB) private db: Database) {}
  @Get(":key") async get(@Param("key") key: string) { const [setting] = await this.db.select().from(storefrontSettings).where(eq(storefrontSettings.key, key)).limit(1); return setting?.value || {}; }
  @UseGuards(AdminGuard) @Put(":key") async put(@Param("key") key: string, @Body() dto: SettingDto) { const [setting] = await this.db.insert(storefrontSettings).values({ key, value: dto.value }).onConflictDoUpdate({ target: storefrontSettings.key, set: { value: dto.value, updatedAt: new Date() } }).returning(); return setting.value; }
}

@UseGuards(AdminGuard)
@Controller("admin/users")
class AdminUsersController {
  constructor(@Inject(DB) private db: Database) {}
  @Get(":identifier") async one(@Param("identifier") identifier: string) { const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier); const [user] = await this.db.select().from(users).where(isUuid ? or(eq(users.id, identifier), eq(users.firebaseUid, identifier)) : eq(users.firebaseUid, identifier)).limit(1); if (!user) throw new NotFoundException("User not found"); return user; }
}

@Module({ controllers: [ProfileController, CartController, FavoritesController, ReviewsController, StorefrontController, AdminUsersController] })
export class CustomerDataModule {}
