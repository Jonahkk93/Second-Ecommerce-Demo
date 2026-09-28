import { BadRequestException, Body, Controller, Get, Inject, Injectable, Logger, Module, NotFoundException, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";
import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { AuthGuard, AuthUser, CurrentUser, OrdersGuard } from "../common/auth";
import { DB, Database } from "../database/database.module";
import { deliveryQuotes, orderItems, orders, paymentEvents, payments, products, storefrontSettings, users } from "../database/schema";

class CreateOrderDto { @IsUUID() quoteId!: string; @IsString() firstName!: string; @IsString() lastName!: string; @IsEmail() email!: string; @IsString() phone!: string; @IsOptional() @IsString() notes?: string; }
class UpdateStatusDto { @IsIn(["pending", "processing", "shipped", "delivered", "cancelled"]) status!: "pending" | "processing" | "shipped" | "delivered" | "cancelled"; }
class UpdateTrackingDto {
  @IsString() @MaxLength(120) trackingNumber!: string;
  @IsOptional() @IsString() @MaxLength(120) shippingCarrier?: string;
  @IsOptional() @IsString() @MaxLength(1000) trackingUrl?: string;
}
class UpdateCancellationSeenDto { @IsBoolean() seen!: boolean; }
class UpdateRefundDto { @IsIn(["pending", "initiated", "processing", "refunded", "failed"]) status!: "pending" | "initiated" | "processing" | "refunded" | "failed"; @IsOptional() @IsString() reference?: string; @IsOptional() @IsString() note?: string; }
class LegacyOrderDto { @IsArray() items!: unknown[]; @IsObject() customer!: Record<string, unknown>; @IsObject() delivery!: Record<string, unknown>; @IsOptional() @IsObject() payment?: Record<string, unknown>; @IsInt() @Min(0) deliveryFee!: number; }
type QuotedOrderItem = { productId: string; variantId?: string; title: string; sku?: string; quantity: number; unitPrice: number; options?: Record<string, unknown> };

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  constructor(@Inject(DB) private db: Database) {}

  private addBusinessDays(value: Date, days: number) {
    const date = new Date(value);
    let remaining = days;
    while (remaining > 0) {
      date.setUTCDate(date.getUTCDate() + 1);
      if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) remaining--;
    }
    return date;
  }

  private async refundForCancellation(existing: typeof orders.$inferSelect, source: "customer" | "staff") {
    const delivery = { ...((existing.delivery || {}) as Record<string, any>) };
    if (delivery.refund) return delivery.refund;
    const [payment] = await this.db.select().from(payments).where(eq(payments.orderId, existing.id)).limit(1);
    if (!payment || payment.status !== "successful") return null;
    const metadata = (payment.metadata || {}) as Record<string, any>;
    const recordedPayment = (delivery.payment || {}) as Record<string, any>;
    const method = String(metadata.preferredMethod || metadata.payment_method || recordedPayment.method || "card").toLowerCase();
    const mobile = method.includes("momo") || method.includes("mobile") || method.includes("airtel");
    const phone = String(recordedPayment.number || (existing.customer as Record<string, any>)?.phone || "").replace(/\D/g, "");
    const now = new Date();
    return {
      status: "pending",
      amount: payment.amount,
      currency: payment.currency,
      method: mobile ? (method.includes("airtel") ? "airtel_money" : "mtn_momo") : "card",
      destination: mobile && phone ? `•••• ${phone.slice(-4)}` : "Original card",
      reason: source === "staff" ? "Order cancelled by MPWR" : "Order cancelled by customer",
      requestedAt: now.toISOString(),
      initiationDueAt: this.addBusinessDays(now, 1).toISOString(),
      expectedBy: null,
      completedAt: null,
      paymentId: payment.id,
      reference: payment.providerReference || null
    };
  }

  async refreshBestsellers() {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await this.db.select({ id: products.legacyId, quantity: orderItems.quantity })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(and(eq(orders.status, "delivered"), gt(orders.createdAt, cutoff), eq(products.active, true)));
    const totals = new Map<string, number>();
    rows.forEach(row => {
      if (!row.id) return;
      totals.set(row.id, (totals.get(row.id) || 0) + Math.max(1, Number(row.quantity) || 1));
    });
    const rankedProducts = [...totals.entries()]
      .map(([id, unitsSold]) => ({ id, unitsSold }))
      .sort((a, b) => b.unitsSold - a.unitsSold || a.id.localeCompare(b.id))
      .slice(0, 10);
    await this.db.insert(storefrontSettings).values({ key: "bestsellers", value: { products: rankedProducts, windowDays: 30 } })
      .onConflictDoUpdate({ target: storefrontSettings.key, set: { value: { products: rankedProducts, windowDays: 30 }, updatedAt: new Date() } });
  }

  async updateStatus(id: string, status: UpdateStatusDto["status"]) {
    const [existing] = await this.db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!existing) throw new NotFoundException("Order not found");
    const delivery = { ...((existing.delivery || {}) as Record<string, unknown>) };
    if (existing.status === "cancelled" && delivery.cancellationSource === "customer") {
      throw new BadRequestException("Customer-cancelled orders have a locked status");
    }
    if (existing.status === "cancelled" && delivery.refund && status !== "cancelled") {
      throw new BadRequestException("Orders with an active refund cannot be reopened");
    }
    if (status === "cancelled") {
      delivery.cancellationSource = "staff";
      delivery.cancelledAt = new Date().toISOString();
      delivery.refund = await this.refundForCancellation(existing, "staff");
    } else {
      delete delivery.cancellationSource;
      delete delivery.cancelledAt;
    }
    const now = new Date();
    const lifecycle = status === "shipped" && !existing.shippedAt
      ? { shippedAt: now }
      : status === "delivered" && !existing.deliveredAt
        ? { shippedAt: existing.shippedAt || now, deliveredAt: now }
        : {};
    const [order] = await this.db.update(orders).set({ status, delivery, ...lifecycle, updatedAt: now }).where(eq(orders.id, id)).returning();
    if (!order) throw new NotFoundException("Order not found");
    try {
      await this.refreshBestsellers();
    } catch (error) {
      this.logger.error("Could not refresh bestseller rankings", error instanceof Error ? error.stack : String(error));
    }
    return order;
  }
  async updateTracking(id: string, dto: UpdateTrackingDto) {
    const [existing] = await this.db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!existing) throw new NotFoundException("Order not found");
    if (existing.status === "cancelled") throw new BadRequestException("Tracking cannot be added to a cancelled order");
    const trackingNumber = dto.trackingNumber.trim();
    if (!trackingNumber) throw new BadRequestException("Tracking number is required");
    const trackingUrl = dto.trackingUrl?.trim() || null;
    if (trackingUrl && !/^https?:\/\/[^\s]+$/i.test(trackingUrl)) throw new BadRequestException("Tracking link must be a valid HTTP or HTTPS URL");
    const [order] = await this.db.update(orders).set({
      trackingNumber,
      shippingCarrier: dto.shippingCarrier?.trim() || null,
      trackingUrl,
      updatedAt: new Date()
    }).where(eq(orders.id, id)).returning();
    return order;
  }
  async cancelByCustomer(userId: string, id: string) {
    const [existing] = await this.db.select().from(orders).where(and(eq(orders.id, id), eq(orders.userId, userId))).limit(1);
    if (!existing) throw new NotFoundException("Order not found");
    if (existing.status !== "pending") throw new BadRequestException("Only pending orders can be cancelled");
    const delivery = {
      ...((existing.delivery || {}) as Record<string, unknown>),
      cancellationSource: "customer",
      cancelledAt: new Date().toISOString(),
      refund: await this.refundForCancellation(existing, "customer")
    };
    const [order] = await this.db.update(orders).set({ status: "cancelled", delivery, updatedAt: new Date() }).where(and(eq(orders.id, id), eq(orders.userId, userId), eq(orders.status, "pending"))).returning();
    if (!order) throw new BadRequestException("This order can no longer be cancelled");
    return order;
  }
  async markCustomerCancellationSeen(id: string, seen: boolean) {
    const [existing] = await this.db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!existing) throw new NotFoundException("Order not found");
    const delivery = { ...((existing.delivery || {}) as Record<string, unknown>) };
    if (existing.status !== "cancelled" || delivery.cancellationSource !== "customer") {
      throw new BadRequestException("Only customer-cancelled orders can be marked as seen");
    }
    if (seen) delivery.cancellationSeenAt = new Date().toISOString();
    else delete delivery.cancellationSeenAt;
    const [order] = await this.db.update(orders).set({ delivery, updatedAt: new Date() }).where(eq(orders.id, id)).returning();
    return order;
  }
  async updateRefund(id: string, dto: UpdateRefundDto) {
    const [existing] = await this.db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!existing) throw new NotFoundException("Order not found");
    const delivery = { ...((existing.delivery || {}) as Record<string, any>) };
    const current = delivery.refund as Record<string, any> | undefined;
    if (existing.status !== "cancelled" || !current) throw new BadRequestException("This order does not have a refund case");
    if (current.status === "refunded") throw new BadRequestException("This refund is already complete");
    const transitions: Record<string, string[]> = {
      pending: ["initiated", "failed"],
      initiated: ["processing", "refunded", "failed"],
      processing: ["refunded", "failed"],
      failed: ["pending", "initiated"]
    };
    if (!transitions[String(current.status)]?.includes(dto.status)) throw new BadRequestException("Invalid refund status change");
    const now = new Date();
    const next: Record<string, any> = { ...current, status: dto.status, updatedAt: now.toISOString() };
    if (dto.reference?.trim()) next.reference = dto.reference.trim();
    if (dto.note?.trim()) next.note = dto.note.trim();
    if (dto.status === "pending") {
      next.initiationDueAt = this.addBusinessDays(now, 1).toISOString();
      next.expectedBy = null;
      next.completedAt = null;
    }
    if (dto.status === "initiated") {
      next.initiatedAt = now.toISOString();
      next.expectedBy = this.addBusinessDays(now, next.method === "card" ? 10 : 3).toISOString();
    }
    if (dto.status === "processing" && !next.initiatedAt) next.initiatedAt = now.toISOString();
    if (dto.status === "refunded") next.completedAt = now.toISOString();
    if (dto.status === "failed") next.failedAt = now.toISOString();
    delivery.refund = next;
    return this.db.transaction(async tx => {
      const [order] = await tx.update(orders).set({ delivery, updatedAt: now }).where(eq(orders.id, id)).returning();
      if (dto.status === "refunded") await tx.update(payments).set({ status: "refunded", updatedAt: now }).where(eq(payments.orderId, id));
      if (current.paymentId) await tx.insert(paymentEvents).values({
        providerEventId: `refund:${current.paymentId}:${dto.status}:${now.getTime()}`,
        paymentId: current.paymentId,
        eventType: `refund_${dto.status}`,
        payload: { orderId: id, status: dto.status, reference: next.reference || null, note: next.note || null }
      });
      return order;
    });
  }
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
    const [discountSetting] = await this.db.select().from(storefrontSettings).where(eq(storefrontSettings.key, "discounts")).limit(1);
    const discountMap = new Map(((discountSetting?.value as any)?.products || []).map((item: any) => [String(item.id), Math.min(95, Math.max(1, Math.round(Number(item.percent) || 15)))]));
    return this.db.transaction(async tx => {
      let subtotal = 0;
      const snapshots = rawItems.map(item => { const product = productMap.get(String(item.id))!; const quantity = Math.max(1, Math.min(20, Number(item.quantity) || 1)); const metadata = product.metadata as Record<string, any>; const selectedSize = item.selectedOptions?.length || item.selectedOptions?.size || item.size; const optionPrice = selectedSize ? Number(metadata.sizePrices?.[selectedSize]) : NaN; const regularPrice = Number.isFinite(optionPrice) ? optionPrice : product.price; const discount = discountMap.get(String(product.legacyId)) as number | undefined; const unitPrice = discount ? Math.round(regularPrice * (1 - discount / 100)) : regularPrice; subtotal += unitPrice * quantity; const selectedOptions = item.selectedOptions || { ...(item.color ? { color: item.color } : {}), ...(item.size ? { size: item.size } : {}) }; return { productId: product.id, title: product.title, quantity, unitPrice, options: { ...selectedOptions, legacySnapshot: item } }; });
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
  @UseGuards(OrdersGuard) @Get("admin/all") adminList() { return this.service.adminList(); }
  @UseGuards(AuthGuard) @Get(":id") one(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.service.one(user.sub, id); }
  @UseGuards(AuthGuard) @Patch(":id/cancel") cancel(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.service.cancelByCustomer(user.sub, id); }
  @UseGuards(OrdersGuard) @Patch(":id/cancellation-seen") cancellationSeen(@Param("id") id: string, @Body() dto: UpdateCancellationSeenDto) { return this.service.markCustomerCancellationSeen(id, dto.seen); }
  @UseGuards(OrdersGuard) @Patch(":id/refund") refund(@Param("id") id: string, @Body() dto: UpdateRefundDto) { return this.service.updateRefund(id, dto); }
  @UseGuards(OrdersGuard) @Patch(":id/tracking") tracking(@Param("id") id: string, @Body() dto: UpdateTrackingDto) { return this.service.updateTracking(id, dto); }
  @UseGuards(OrdersGuard) @Patch(":id/status") status(@Param("id") id: string, @Body() dto: UpdateStatusDto) { return this.service.updateStatus(id, dto.status); }
}
@Module({ controllers: [OrdersController], providers: [OrdersService], exports: [OrdersService] })
export class OrdersModule {}
