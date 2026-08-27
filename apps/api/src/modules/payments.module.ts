import { BadGatewayException, BadRequestException, Body, Controller, Get, Headers, Inject, Injectable, Module, NotFoundException, Param, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { and, eq } from "drizzle-orm";
import { AuthGuard, AuthUser, CurrentUser } from "../common/auth";
import { DB, Database } from "../database/database.module";
import { orders, paymentEvents, payments } from "../database/schema";

@Injectable()
class PaymentsService {
  constructor(@Inject(DB) private db: Database, private config: ConfigService) {}
  private headers() { return { Authorization: `Bearer ${this.config.getOrThrow("FLW_SECRET_KEY")}`, "Content-Type": "application/json" }; }
  async initialize(user: AuthUser, orderId: string) {
    const [order] = await this.db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, user.sub))).limit(1); if (!order) throw new BadRequestException("Order not found");
    if (order.status === "cancelled") throw new BadRequestException("A cancelled order cannot be paid");
    const [existing] = await this.db.select().from(payments).where(eq(payments.orderId, order.id)).limit(1);
    if (existing?.status === "successful") throw new BadRequestException("Order is already paid");
    if (existing?.status === "pending" && existing.checkoutUrl) return { paymentId: existing.id, checkoutUrl: existing.checkoutUrl };
    const reference = `MPWR-${order.id}-${Date.now()}`; const customer = order.customer as any;
    const response = await fetch("https://api.flutterwave.com/v3/payments", { method: "POST", headers: this.headers(), body: JSON.stringify({ tx_ref: reference, amount: order.total, currency: order.currency, redirect_url: this.config.getOrThrow("FLW_REDIRECT_URL"), customer: { email: customer.email, phonenumber: customer.phone, name: `${customer.firstName} ${customer.lastName}` }, customizations: { title: "MPWR", description: `Order ${order.id}` }, meta: { orderId: order.id, userId: user.sub } }) });
    const result: any = await response.json(); if (!response.ok || !result.data?.link) throw new BadGatewayException("Payment could not be initialized");
    const [payment] = await this.db.insert(payments).values({ orderId: order.id, providerReference: reference, amount: order.total, currency: order.currency, checkoutUrl: result.data.link }).onConflictDoUpdate({ target: payments.orderId, set: { providerReference: reference, checkoutUrl: result.data.link, updatedAt: new Date() } }).returning();
    return { paymentId: payment.id, checkoutUrl: result.data.link };
  }
  verifySignature(rawBody: string, signature?: string) { if (!signature) return false; const expected = createHmac("sha256", this.config.getOrThrow("FLW_SECRET_HASH")).update(rawBody).digest("base64"); const a = Buffer.from(expected); const b = Buffer.from(signature); return a.length === b.length && timingSafeEqual(a, b); }
  async webhook(payload: any) {
    const eventId = String(payload.id || randomUUID());
    try { await this.db.insert(paymentEvents).values({ providerEventId: eventId, eventType: String(payload.type || "unknown"), payload }); } catch (error) { const databaseError = error as { code?: string; cause?: { code?: string } }; if (databaseError.code === "23505" || databaseError.cause?.code === "23505") return { received: true, duplicate: true }; throw error; }
    const reference = String(payload.data?.tx_ref || payload.data?.reference || ""); if (!reference) return { received: true };
    const [payment] = await this.db.select().from(payments).where(eq(payments.providerReference, reference)).limit(1); if (!payment) return { received: true };
    const transactionId = String(payload.data?.id || "");
    if (payload.type === "charge.completed" && ["successful", "succeeded"].includes(String(payload.data?.status))) {
      const verify = await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`, { headers: this.headers() }); const result: any = await verify.json();
      if (verify.ok && result.data?.status === "successful" && Number(result.data.amount) >= payment.amount && result.data.currency === payment.currency) {
        await this.db.transaction(async tx => {
          await tx.update(payments).set({ status: "successful", transactionId, metadata: result.data, updatedAt: new Date() }).where(eq(payments.id, payment.id));
          await tx.update(orders).set({ status: "processing", updatedAt: new Date() }).where(and(eq(orders.id, payment.orderId), eq(orders.status, "pending")));
          await tx.update(paymentEvents).set({ paymentId: payment.id }).where(eq(paymentEvents.providerEventId, eventId));
        });
      }
    }
    return { received: true };
  }
}

@Controller("payments")
class PaymentsController {
  constructor(private service: PaymentsService, @Inject(DB) private db: Database) {}
  @UseGuards(AuthGuard) @Post("flutterwave/:orderId") initialize(@CurrentUser() user: AuthUser, @Param("orderId") orderId: string) { return this.service.initialize(user, orderId); }
  @UseGuards(AuthGuard) @Get(":orderId") async status(@CurrentUser() user: AuthUser, @Param("orderId") orderId: string) { const [payment] = await this.db.select({ id: payments.id, status: payments.status, amount: payments.amount, currency: payments.currency }).from(payments).innerJoin(orders, eq(payments.orderId, orders.id)).where(and(eq(payments.orderId, orderId), eq(orders.userId, user.sub))).limit(1); if (!payment) throw new NotFoundException("Payment not found"); return payment; }
  @Post("webhooks/flutterwave") async webhook(@Req() request: any, @Headers("flutterwave-signature") signature: string, @Body() payload: any) { const rawBody = request.rawBody?.toString() || JSON.stringify(payload); if (!this.service.verifySignature(rawBody, signature)) throw new UnauthorizedException("Invalid webhook signature"); return this.service.webhook(payload); }
}
@Module({ controllers: [PaymentsController], providers: [PaymentsService] })
export class PaymentsModule {}
