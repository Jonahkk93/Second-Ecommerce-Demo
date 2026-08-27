import { BadRequestException, Body, Controller, Get, Inject, Injectable, Module, NotFoundException, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { IsArray, IsEmail, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { AdminGuard, AuthGuard, AuthUser, CurrentUser } from "../common/auth";
import { DB, Database } from "../database/database.module";
import { deliveryQuotes, orderItems, orders, products, users } from "../database/schema";

class CreateOrderDto { @IsUUID() quoteId!: string; @IsString() firstName!: string; @IsString() lastName!: string; @IsEmail() email!: string; @IsString() phone!: string; @IsOptional() @IsString() notes?: string; }
class UpdateStatusDto { @IsIn(["pending", "processing", "shipped", "delivered", "cancelled"]) status!: "pending" | "processing" | "shipped" | "delivered" | "cancelled"; }
class LegacyOrderDto { @IsArray() items!: unknown[]; @IsObject() customer!: Record<string, unknown>; @IsObject() delivery!: Record<string, unknown>; @IsOptional() @IsObject() payment?: Record<string, unknown>; @IsInt() @Min(0) deliveryFee!: number; }
type QuotedOrderItem = { productId: string; variantId?: string; title: string; sku?: string; quantity: number; unitPrice: number; options?: Record<string, unknown> };

@Injectable()
export class OrdersService {
  constructor(@Inject(DB) private db: Database) {}
  async create(userId: string, dto: CreateOrderDto) {
    return this.db.transaction(async tx => {
      const [quote] = await tx.select().from(deliveryQuotes).where(and(eq(deliveryQuotes.id, dto.quoteId), eq(deliveryQuotes.userId, userId), isNull(deliveryQuotes.consumedAt), gt(deliveryQuotes.expiresAt, new Date()))).limit(1);
      if (!quote) throw new BadRequestException("Delivery quote expired or already used");
      const [claimed] = await tx.update(deliveryQuotes).set({ consumedAt: new Date() }).where(and(eq(deliveryQuotes.id, quote.id), isNull(deliveryQuotes.consumedAt))).returning();
      if (!claimed) throw new BadRequestException("Delivery quote already used");
      const destination = quote.destination as { items?: QuotedOrderItem[]; [key: string]: unknown }; const { items: quotedItems = [], ...deliveryDestination } = destination;
      const [order] = await tx.insert(orders).values({ userId, quoteId: quote.id, subtotal: quote.subtotal, deliveryFee: quote.fee, total: quote.total, customer: { firstName: dto.firstName.trim(), lastName: dto.lastName.trim(), email: dto.email.toLowerCase(), phone: dto.phone.trim() }, delivery: { ...deliveryDestination, notes: dto.notes || "", distanceKm: quote.distanceKm, durationMinutes: quote.durationMinutes, shippingClass: quote.class, fee: quote.fee, pricingVersion: quote.pricingVersion } }).returning();
      await tx.insert(orderItems).values(quotedItems.map(item => ({ orderId: order.id, productId: item.productId, variantId: item.variantId || null, title: item.title, sku: item.sku || null, quantity: item.quantity, unitPrice: item.unitPrice, options: item.options || {} })));
      return order;
    });
  }
  async createLegacy(userId: string, dto: LegacyOrderDto) {
    const rawItems = dto.items as Array<Record<string, any>>; if (!rawItems.length) throw new BadRequestException("Cart is empty");
    const legacyIds = [...new Set(rawItems.map(item => String(item.id)))];
    const catalogue = await this.db.select().from(products).where(inArray(products.legacyId, legacyIds));
    if (catalogue.length !== legacyIds.length) throw new BadRequestException("One or more products are unavailable");
    const productMap = new Map(catalogue.map(product => [product.legacyId, product]));
    return this.db.transaction(async tx => {
      let subtotal = 0;
      const snapshots = rawItems.map(item => { const product = productMap.get(String(item.id))!; const quantity = Math.max(1, Math.min(20, Number(item.quantity) || 1)); const metadata = product.metadata as Record<string, any>; const selectedSize = item.selectedOptions?.length || item.selectedOptions?.size || item.size; const optionPrice = selectedSize ? Number(metadata.sizePrices?.[selectedSize]) : NaN; const unitPrice = Number.isFinite(optionPrice) ? optionPrice : product.price; subtotal += unitPrice * quantity; const selectedOptions = item.selectedOptions || { ...(item.color ? { color: item.color } : {}), ...(item.size ? { size: item.size } : {}) }; return { productId: product.id, title: product.title, quantity, unitPrice, options: { ...selectedOptions, legacySnapshot: item } }; });
      const [order] = await tx.insert(orders).values({ userId, subtotal, deliveryFee: dto.deliveryFee, total: subtotal + dto.deliveryFee, customer: dto.customer, delivery: { ...dto.delivery, payment: dto.payment || {} } }).returning();
      await tx.insert(orderItems).values(snapshots.map(item => ({ orderId: order.id, ...item })));
      return { ...order, items: snapshots };
    });
  }
  private async expand(order: typeof orders.$inferSelect) { const rows = await this.db.select({ item: orderItems, legacyId: products.legacyId, imageUrl: products.imageUrl }).from(orderItems).innerJoin(products, eq(orderItems.productId, products.id)).where(eq(orderItems.orderId, order.id)); const items = rows.map(({ item, legacyId, imageUrl }) => { const options = item.options as Record<string, any>; const legacy = options.legacySnapshot || {}; const { legacySnapshot: _snapshot, ...selectedOptions } = options; return { ...legacy, id: legacy.id || legacyId || item.productId, title: item.title, image: legacy.image || imageUrl, price: item.unitPrice, quantity: item.quantity, selectedOptions }; }); return { ...order, items }; }
  async list(userId: string) { const rows = await this.db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt)); return Promise.all(rows.map(order => this.expand(order))); }
  async adminList() { const rows = await this.db.select({ order: orders, firebaseUid: users.firebaseUid }).from(orders).innerJoin(users, eq(orders.userId, users.id)).orderBy(desc(orders.createdAt)); return Promise.all(rows.map(async row => ({ ...(await this.expand(row.order)), userId: row.firebaseUid || row.order.userId }))); }
  async one(userId: string, id: string) { const [order] = await this.db.select().from(orders).where(and(eq(orders.id, id), eq(orders.userId, userId))).limit(1); if (!order) throw new NotFoundException("Order not found"); const items = await this.db.select().from(orderItems).where(eq(orderItems.orderId, id)); return { ...order, items }; }
}

@Controller("orders")
class OrdersController {
  constructor(private service: OrdersService, @Inject(DB) private db: Database) {}
  @UseGuards(AuthGuard) @Post() create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) { return this.service.create(user.sub, dto); }
  @UseGuards(AuthGuard) @Post("legacy") createLegacy(@CurrentUser() user: AuthUser, @Body() dto: LegacyOrderDto) { return this.service.createLegacy(user.sub, dto); }
  @UseGuards(AuthGuard) @Get() list(@CurrentUser() user: AuthUser) { return this.service.list(user.sub); }
  @UseGuards(AdminGuard) @Get("admin/all") adminList() { return this.service.adminList(); }
  @UseGuards(AuthGuard) @Get(":id") one(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.service.one(user.sub, id); }
  @UseGuards(AdminGuard) @Patch(":id/status") async status(@Param("id") id: string, @Body() dto: UpdateStatusDto) { const [order] = await this.db.update(orders).set({ status: dto.status, updatedAt: new Date() }).where(eq(orders.id, id)).returning(); if (!order) throw new NotFoundException("Order not found"); return order; }
}
@Module({ controllers: [OrdersController], providers: [OrdersService], exports: [OrdersService] })
export class OrdersModule {}
