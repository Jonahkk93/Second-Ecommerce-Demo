import { Body, BadGatewayException, BadRequestException, Controller, Inject, Injectable, Module, Param, Patch, Post, Get, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Type } from "class-transformer";
import { IsArray, IsInt, IsOptional, IsString, IsUUID, Max, Min, ValidateNested } from "class-validator";
import { createHash } from "crypto";
import { and, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import Redis from "ioredis";
import { AdminGuard, AuthGuard, AuthUser, CurrentUser } from "../common/auth";
import { DB, Database, REDIS } from "../database/database.module";
import { deliveryQuotes, deliveryRateRules, fulfillmentCenters, products, productVariants } from "../database/schema";

class QuoteItemDto { @IsUUID() productId!: string; @IsOptional() @IsUUID() variantId?: string; @IsInt() @Min(1) @Max(20) quantity!: number; }
class DestinationDto { @IsString() address!: string; @IsString() city!: string; @IsString() district!: string; @IsOptional() @IsString() placeId?: string; }
class CreateQuoteDto { @ValidateNested() @Type(() => DestinationDto) destination!: DestinationDto; @IsArray() @ValidateNested({ each: true }) @Type(() => QuoteItemDto) items!: QuoteItemDto[]; }
class UpdateRateDto { @IsOptional() @IsInt() @Min(0) smallFee?: number; @IsOptional() @IsInt() @Min(0) mediumFee?: number; @IsOptional() @IsInt() @Min(0) largeFee?: number; @IsOptional() @IsInt() @Min(1) minDays?: number; @IsOptional() @IsInt() @Min(1) maxDays?: number; }

type RouteResult = { distanceKm: number; durationMinutes: number; placeId?: string; partialMatch: boolean; latitude: number; longitude: number; normalizedAddress: string };

@Injectable()
export class DeliveryService {
  constructor(@Inject(DB) private db: Database, @Inject(REDIS) private redis: Redis, private config: ConfigService) {}

  private async route(origin: { latitude: string; longitude: string }, destination: DestinationDto): Promise<RouteResult> {
    const address = `${destination.address}, ${destination.city}, ${destination.district}, Uganda`;
    const key = `route:${createHash("sha256").update(`${origin.latitude},${origin.longitude}:${destination.placeId || address.toLowerCase()}`).digest("hex")}`;
    try { if (this.redis.status === "wait") await this.redis.connect(); const cached = await this.redis.get(key); if (cached) return JSON.parse(cached); } catch {}
    const geocodeUrl = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    if (destination.placeId) geocodeUrl.searchParams.set("place_id", destination.placeId); else { geocodeUrl.searchParams.set("address", address); geocodeUrl.searchParams.set("components", "country:UG"); }
    geocodeUrl.searchParams.set("region", "ug"); geocodeUrl.searchParams.set("key", this.config.getOrThrow("GOOGLE_MAPS_API_KEY"));
    const geocodeResponse = await fetch(geocodeUrl); const geocode: any = await geocodeResponse.json(); const match = geocode.results?.[0];
    const country = match?.address_components?.find((component: any) => component.types?.includes("country"))?.short_name;
    if (!geocodeResponse.ok || geocode.status !== "OK" || !match?.geometry?.location || country !== "UG") throw new BadRequestException("Choose a valid delivery address within Uganda");
    const latitude = Number(match.geometry.location.lat); const longitude = Number(match.geometry.location.lng);
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": this.config.getOrThrow("GOOGLE_MAPS_API_KEY"), "X-Goog-FieldMask": "routes.distanceMeters,routes.duration" },
      body: JSON.stringify({ origin: { location: { latLng: { latitude: Number(origin.latitude), longitude: Number(origin.longitude) } } }, destination: { location: { latLng: { latitude, longitude } } }, travelMode: "DRIVE", routingPreference: "TRAFFIC_UNAWARE", regionCode: "UG", units: "METRIC" })
    });
    const data: any = await response.json();
    if (!response.ok || !data.routes?.[0]?.distanceMeters) throw new BadGatewayException("Google could not calculate this delivery route");
    const result = { distanceKm: Math.round(data.routes[0].distanceMeters / 100) / 10, durationMinutes: Math.max(1, Math.round(parseFloat(data.routes[0].duration) / 60)), placeId: match.place_id, partialMatch: Boolean(match.partial_match), latitude, longitude, normalizedAddress: match.formatted_address };
    try { await this.redis.set(key, JSON.stringify(result), "EX", 86400); } catch {}
    return result;
  }

  async quote(userId: string, dto: CreateQuoteDto) {
    if (!dto.items.length) throw new BadRequestException("Cart is empty");
    const itemKeys = dto.items.map(item => `${item.productId}:${item.variantId || "base"}`);
    if (new Set(itemKeys).size !== itemKeys.length) throw new BadRequestException("Combine duplicate cart items before requesting a quote");
    const ids = [...new Set(dto.items.map(item => item.productId))];
    const catalogue = await this.db.select().from(products).where(and(inArray(products.id, ids), eq(products.active, true)));
    if (catalogue.length !== ids.length) throw new BadRequestException("One or more products are unavailable");
    const variantIds = dto.items.map(i => i.variantId).filter(Boolean) as string[];
    const variants = variantIds.length ? await this.db.select().from(productVariants).where(inArray(productVariants.id, variantIds)) : [];
    const productMap = new Map(catalogue.map(p => [p.id, p])); const variantMap = new Map(variants.map(v => [v.id, v]));
    let subtotal = 0; let orderClassRank = 0; const levels = ["small", "medium", "large"] as const;
    const pricedItems = dto.items.map(item => { const product = productMap.get(item.productId)!; const variant = item.variantId ? variantMap.get(item.variantId) : undefined; if (item.variantId && (!variant || variant.productId !== product.id || !variant.active)) throw new BadRequestException("Invalid product variant"); if (variant && variant.stock < item.quantity) throw new BadRequestException(`${product.title} does not have enough stock`); const unitPrice = variant?.price ?? product.price; subtotal += unitPrice * item.quantity; orderClassRank = Math.max(orderClassRank, levels.indexOf(product.class)); return { ...item, title: product.title, unitPrice, sku: variant?.sku, options: variant?.options || {} }; });
    const orderClass = levels[orderClassRank] || "small";
    const [origin] = await this.db.select().from(fulfillmentCenters).where(eq(fulfillmentCenters.active, true)).limit(1); if (!origin) throw new BadRequestException("No fulfillment centre configured");
    const route = await this.route(origin, dto.destination);
    const [rule] = await this.db.select().from(deliveryRateRules).where(and(eq(deliveryRateRules.active, true), lte(deliveryRateRules.minKm, String(route.distanceKm)), or(isNull(deliveryRateRules.maxKm), gt(deliveryRateRules.maxKm, String(route.distanceKm))))).limit(1);
    if (!rule) throw new BadRequestException("No delivery rate configured for this distance");
    const fee = orderClass === "large" ? rule.largeFee : orderClass === "medium" ? rule.mediumFee : rule.smallFee;
    const destination = { ...dto.destination, address: route.normalizedAddress, country: "Uganda", googlePlaceId: route.placeId, latitude: route.latitude, longitude: route.longitude, partialMatch: route.partialMatch, items: pricedItems };
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000);
    const [quote] = await this.db.insert(deliveryQuotes).values({ userId, fulfillmentCenterId: origin.id, destination, distanceKm: String(route.distanceKm), durationMinutes: route.durationMinutes, class: orderClass, subtotal, fee, total: subtotal + fee, pricingVersion: rule.version, expiresAt }).returning();
    return { quoteId: quote.id, origin: origin.name, distanceKm: route.distanceKm, durationMinutes: route.durationMinutes, shippingClass: orderClass, subtotal, deliveryFee: fee, total: subtotal + fee, eta: { minDays: rule.minDays, maxDays: rule.maxDays }, expiresAt, partialAddressMatch: route.partialMatch };
  }
}

@Controller("delivery")
class DeliveryController {
  constructor(private service: DeliveryService, @Inject(DB) private db: Database) {}
  @UseGuards(AuthGuard) @Post("quotes") quote(@CurrentUser() user: AuthUser, @Body() dto: CreateQuoteDto) { return this.service.quote(user.sub, dto); }
  @UseGuards(AdminGuard) @Get("admin/rates") rates() { return this.db.select().from(deliveryRateRules); }
  @UseGuards(AdminGuard) @Patch("admin/rates/:id") async updateRate(@Param("id") id: string, @Body() dto: UpdateRateDto) { const [rate] = await this.db.update(deliveryRateRules).set({ ...dto, updatedAt: new Date() }).where(eq(deliveryRateRules.id, id)).returning(); return rate; }
}
@Module({ controllers: [DeliveryController], providers: [DeliveryService], exports: [DeliveryService] })
export class DeliveryModule {}
