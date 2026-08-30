import { BadGatewayException, BadRequestException, Body, Controller, Get, Inject, Injectable, Module, NotFoundException, Param, Post, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IsIn } from "class-validator";
import { and, eq } from "drizzle-orm";
import { AuthGuard, AuthUser, CurrentUser } from "../common/auth";
import { DB, Database } from "../database/database.module";
import { orders, paymentEvents, payments } from "../database/schema";

type PaymentMethod = "card" | "mtn_momo" | "airtel_money";
type PesapalTokenResponse = { token?: string; expiryDate?: string; error?: unknown };
type PesapalOrderResponse = { order_tracking_id?: string; redirect_url?: string; error?: unknown };
type PesapalStatusResponse = {
  payment_status_description?: string;
  confirmation_code?: string;
  status_code?: number;
  merchant_reference?: string;
  amount?: number;
  currency?: string;
  error?: unknown;
  [key: string]: unknown;
};
type PesapalNotification = {
  OrderTrackingId?: string;
  OrderMerchantReference?: string;
  OrderNotificationType?: string;
  orderTrackingId?: string;
  orderMerchantReference?: string;
  orderNotificationType?: string;
};

class InitializePaymentDto {
  @IsIn(["card", "mtn_momo", "airtel_money"])
  method!: PaymentMethod;
}

@Injectable()
class PesapalGateway {
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private config: ConfigService) {}

  private baseUrl() {
    return this.config.get("PESAPAL_ENV", "sandbox") === "production"
      ? "https://pay.pesapal.com/v3"
      : "https://cybqa.pesapal.com/pesapalv3";
  }

  private async json<T>(response: Response): Promise<T> {
    const result = await response.json().catch(() => null) as T | null;
    if (!response.ok || !result) throw new BadGatewayException("The payment provider is temporarily unavailable");
    return result;
  }

  private async accessToken() {
    if (this.token && this.token.expiresAt > Date.now() + 30_000) return this.token.value;
    const response = await fetch(`${this.baseUrl()}/api/Auth/RequestToken`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        consumer_key: this.config.getOrThrow("PESAPAL_CONSUMER_KEY"),
        consumer_secret: this.config.getOrThrow("PESAPAL_CONSUMER_SECRET")
      })
    });
    const result = await this.json<PesapalTokenResponse>(response);
    if (!result.token || result.error) throw new BadGatewayException("Payment authentication failed");
    const providerExpiry = result.expiryDate ? Date.parse(result.expiryDate) : NaN;
    this.token = { value: result.token, expiresAt: Number.isFinite(providerExpiry) ? providerExpiry : Date.now() + 4 * 60_000 };
    return result.token;
  }

  private async headers() {
    return { Accept: "application/json", Authorization: `Bearer ${await this.accessToken()}`, "Content-Type": "application/json" };
  }

  async submitOrder(input: { reference: string; amount: number; currency: string; customer: Record<string, any>; delivery: Record<string, any> }) {
    const response = await fetch(`${this.baseUrl()}/api/Transactions/SubmitOrderRequest`, {
      method: "POST",
      headers: await this.headers(),
      body: JSON.stringify({
        id: input.reference,
        currency: input.currency,
        amount: input.amount,
        description: `Payment for ${input.reference}`,
        callback_url: this.config.getOrThrow("PESAPAL_CALLBACK_URL"),
        cancellation_url: this.config.get("PESAPAL_CANCELLATION_URL") || this.config.getOrThrow("PESAPAL_CALLBACK_URL"),
        notification_id: this.config.getOrThrow("PESAPAL_IPN_ID"),
        redirect_mode: "TOP_WINDOW",
        billing_address: {
          email_address: String(input.customer.email || ""),
          phone_number: String(input.customer.phone || ""),
          country_code: "UG",
          first_name: String(input.customer.firstName || ""),
          last_name: String(input.customer.lastName || ""),
          line_1: String(input.delivery.address || ""),
          city: String(input.delivery.city || input.delivery.district || ""),
          state: String(input.delivery.district || ""),
          postal_code: ""
        }
      })
    });
    const result = await this.json<PesapalOrderResponse>(response);
    if (!result.order_tracking_id || !result.redirect_url || result.error) throw new BadGatewayException("Payment could not be initialized");
    return result;
  }

  async transactionStatus(trackingId: string) {
    const response = await fetch(`${this.baseUrl()}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(trackingId)}`, {
      headers: await this.headers()
    });
    const result = await this.json<PesapalStatusResponse>(response);
    if (result.error) throw new BadGatewayException("Payment status could not be verified");
    return result;
  }
}

@Injectable()
class PaymentsService {
  constructor(@Inject(DB) private db: Database, private gateway: PesapalGateway) {}

  async initialize(user: AuthUser, orderId: string, method: PaymentMethod) {
    const [order] = await this.db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, user.sub))).limit(1);
    if (!order) throw new BadRequestException("Order not found");
    if (order.status === "cancelled") throw new BadRequestException("A cancelled order cannot be paid");
    const [existing] = await this.db.select().from(payments).where(eq(payments.orderId, order.id)).limit(1);
    if (existing?.status === "successful") throw new BadRequestException("Order is already paid");
    if (existing?.provider === "pesapal" && existing.status === "pending" && existing.checkoutUrl) return { paymentId: existing.id, checkoutUrl: existing.checkoutUrl };

    const previousMetadata = (existing?.metadata || {}) as Record<string, unknown>;
    const attempt = Math.max(1, Number(previousMetadata.attempt || 0) + 1);
    const reference = `MPWR-${order.id}-${attempt}`;
    const result = await this.gateway.submitOrder({
      reference,
      amount: order.total,
      currency: order.currency,
      customer: order.customer as Record<string, any>,
      delivery: order.delivery as Record<string, any>
    });
    const [payment] = await this.db.insert(payments).values({
      orderId: order.id,
      provider: "pesapal",
      providerReference: reference,
      transactionId: result.order_tracking_id,
      amount: order.total,
      currency: order.currency,
      checkoutUrl: result.redirect_url,
      metadata: { preferredMethod: method, attempt }
    }).onConflictDoUpdate({
      target: payments.orderId,
      set: { provider: "pesapal", providerReference: reference, transactionId: result.order_tracking_id, status: "pending", checkoutUrl: result.redirect_url, metadata: { preferredMethod: method, attempt }, updatedAt: new Date() }
    }).returning();
    return { paymentId: payment.id, checkoutUrl: result.redirect_url };
  }

  async synchronize(payment: typeof payments.$inferSelect) {
    if (!payment.transactionId) return payment;
    const status = await this.gateway.transactionStatus(payment.transactionId);
    const description = String(status.payment_status_description || "").toUpperCase();
    const completed = status.status_code === 1 || description === "COMPLETED";
    const failed = [2, 3].includes(Number(status.status_code)) || ["FAILED", "INVALID", "REVERSED"].includes(description);
    const valid = completed && status.merchant_reference === payment.providerReference && Number(status.amount) === payment.amount && status.currency === payment.currency;
    const eventId = `pesapal:${payment.transactionId}:${status.status_code ?? "unknown"}:${status.confirmation_code || "none"}`;

    try {
      await this.db.insert(paymentEvents).values({ providerEventId: eventId, paymentId: payment.id, eventType: description || "unknown", payload: status });
    } catch (error) {
      const databaseError = error as { code?: string; cause?: { code?: string } };
      if (databaseError.code !== "23505" && databaseError.cause?.code !== "23505") throw error;
    }

    if (valid && payment.status !== "successful") {
      await this.db.transaction(async tx => {
        await tx.update(payments).set({ status: "successful", metadata: status, updatedAt: new Date() }).where(eq(payments.id, payment.id));
        await tx.update(orders).set({ status: "processing", updatedAt: new Date() }).where(and(eq(orders.id, payment.orderId), eq(orders.status, "pending")));
      });
      return { ...payment, status: "successful" as const, metadata: status };
    }
    if (failed && payment.status === "pending") {
      await this.db.update(payments).set({ status: "failed", metadata: status, updatedAt: new Date() }).where(eq(payments.id, payment.id));
      return { ...payment, status: "failed" as const, metadata: status };
    }
    return payment;
  }

  async notification(payload: PesapalNotification) {
    const trackingId = String(payload.OrderTrackingId || payload.orderTrackingId || "");
    const reference = String(payload.OrderMerchantReference || payload.orderMerchantReference || "");
    if (!trackingId || !reference) throw new BadRequestException("Invalid payment notification");
    const [payment] = await this.db.select().from(payments).where(and(eq(payments.providerReference, reference), eq(payments.transactionId, trackingId))).limit(1);
    if (payment) await this.synchronize(payment);
    return {
      orderNotificationType: String(payload.OrderNotificationType || payload.orderNotificationType || "IPNCHANGE"),
      orderTrackingId: trackingId,
      orderMerchantReference: reference,
      status: 200
    };
  }
}

@Controller("payments")
class PaymentsController {
  constructor(private service: PaymentsService, @Inject(DB) private db: Database) {}

  @UseGuards(AuthGuard)
  @Post("initialize/:orderId")
  initialize(@CurrentUser() user: AuthUser, @Param("orderId") orderId: string, @Body() dto: InitializePaymentDto) {
    return this.service.initialize(user, orderId, dto.method);
  }

  @UseGuards(AuthGuard)
  @Get(":orderId")
  async status(@CurrentUser() user: AuthUser, @Param("orderId") orderId: string) {
    const [row] = await this.db.select({ payment: payments }).from(payments).innerJoin(orders, eq(payments.orderId, orders.id)).where(and(eq(payments.orderId, orderId), eq(orders.userId, user.sub))).limit(1);
    if (!row) throw new NotFoundException("Payment not found");
    const current = row.payment.status === "pending" ? await this.service.synchronize(row.payment) : row.payment;
    return { id: current.id, status: current.status, amount: current.amount, currency: current.currency };
  }

  @Post("webhooks/pesapal")
  notification(@Body() payload: PesapalNotification) {
    return this.service.notification(payload);
  }
}

@Module({ controllers: [PaymentsController], providers: [PaymentsService, PesapalGateway] })
export class PaymentsModule {}
