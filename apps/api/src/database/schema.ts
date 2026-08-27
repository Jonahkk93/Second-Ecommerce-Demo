import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["customer", "admin"]);
export const shippingClass = pgEnum("shipping_class", ["small", "medium", "large"]);
export const orderStatus = pgEnum("order_status", ["pending", "processing", "shipped", "delivered", "cancelled"]);
export const paymentStatus = pgEnum("payment_status", ["pending", "successful", "failed", "refunded"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
};

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(), email: text("email").notNull(), passwordHash: text("password_hash").notNull(),
  firebaseUid: text("firebase_uid"), localPasswordSet: boolean("local_password_set").default(true).notNull(), firstName: text("first_name").notNull(), lastName: text("last_name").notNull(), phone: text("phone"), profileImage: text("profile_image"), emailVerified: boolean("email_verified").default(false).notNull(), paymentMethods: jsonb("payment_methods").default([]).notNull(), legacyData: jsonb("legacy_data").default({}).notNull(), role: userRole("role").default("customer").notNull(), ...timestamps
}, t => [uniqueIndex("users_email_unique").on(t.email), uniqueIndex("users_firebase_uid_unique").on(t.firebaseUid)]);

export const authTokens = pgTable("auth_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  purpose: text("purpose").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, t => [uniqueIndex("auth_tokens_hash_unique").on(t.tokenHash), index("auth_tokens_user_purpose_idx").on(t.userId, t.purpose)]);

export const addresses = pgTable("addresses", {
  id: uuid("id").defaultRandom().primaryKey(), userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  label: text("label"), address: text("address").notNull(), city: text("city").notNull(), district: text("district").notNull(), country: text("country").default("Uganda").notNull(),
  googlePlaceId: text("google_place_id"), latitude: numeric("latitude", { precision: 10, scale: 7 }), longitude: numeric("longitude", { precision: 10, scale: 7 }), isDefault: boolean("is_default").default(false).notNull(), ...timestamps
}, t => [index("addresses_user_idx").on(t.userId), uniqueIndex("addresses_one_default_per_user").on(t.userId).where(sql`${t.isDefault} = true`)]);

export const fulfillmentCenters = pgTable("fulfillment_centers", {
  id: uuid("id").defaultRandom().primaryKey(), name: text("name").notNull(), address: text("address").notNull(), latitude: numeric("latitude", { precision: 10, scale: 7 }).notNull(), longitude: numeric("longitude", { precision: 10, scale: 7 }).notNull(), active: boolean("active").default(true).notNull(), ...timestamps
});

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(), legacyId: text("legacy_id"), title: text("title").notNull(), slug: text("slug").notNull(), description: text("description"), price: integer("price").notNull(), currency: text("currency").default("UGX").notNull(), imageUrl: text("image_url"), class: shippingClass("shipping_class").default("small").notNull(), weightGrams: integer("weight_grams"), active: boolean("active").default(true).notNull(), metadata: jsonb("metadata").default({}).notNull(), ...timestamps
}, t => [uniqueIndex("products_slug_unique").on(t.slug), uniqueIndex("products_legacy_unique").on(t.legacyId)]);

export const productVariants = pgTable("product_variants", {
  id: uuid("id").defaultRandom().primaryKey(), productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(), sku: text("sku").notNull(), name: text("name").notNull(), price: integer("price"), stock: integer("stock").default(0).notNull(), options: jsonb("options").default({}).notNull(), active: boolean("active").default(true).notNull(), ...timestamps
}, t => [uniqueIndex("variants_sku_unique").on(t.sku), index("variants_product_idx").on(t.productId)]);

export const deliveryRateRules = pgTable("delivery_rate_rules", {
  id: uuid("id").defaultRandom().primaryKey(), version: text("version").notNull(), minKm: numeric("min_km", { precision: 8, scale: 1 }).notNull(), maxKm: numeric("max_km", { precision: 8, scale: 1 }),
  smallFee: integer("small_fee").notNull(), mediumFee: integer("medium_fee").notNull(), largeFee: integer("large_fee").notNull(), minDays: integer("min_days").notNull(), maxDays: integer("max_days").notNull(), active: boolean("active").default(true).notNull(), ...timestamps
}, t => [index("delivery_rules_distance_idx").on(t.minKm, t.maxKm), uniqueIndex("delivery_rules_version_min_unique").on(t.version, t.minKm)]);

export const deliveryQuotes = pgTable("delivery_quotes", {
  id: uuid("id").defaultRandom().primaryKey(), userId: uuid("user_id").references(() => users.id).notNull(), fulfillmentCenterId: uuid("fulfillment_center_id").references(() => fulfillmentCenters.id).notNull(),
  destination: jsonb("destination").notNull(), distanceKm: numeric("distance_km", { precision: 8, scale: 1 }).notNull(), durationMinutes: integer("duration_minutes").notNull(), class: shippingClass("shipping_class").notNull(), subtotal: integer("subtotal").notNull(), fee: integer("fee").notNull(), total: integer("total").notNull(), pricingVersion: text("pricing_version").notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), consumedAt: timestamp("consumed_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, t => [index("delivery_quotes_user_idx").on(t.userId), index("delivery_quotes_expiry_idx").on(t.expiresAt)]);

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(), legacyId: text("legacy_id"), userId: uuid("user_id").references(() => users.id).notNull(), quoteId: uuid("quote_id").references(() => deliveryQuotes.id), status: orderStatus("status").default("pending").notNull(), subtotal: integer("subtotal").notNull(), deliveryFee: integer("delivery_fee").notNull(), total: integer("total").notNull(), currency: text("currency").default("UGX").notNull(), customer: jsonb("customer").notNull(), delivery: jsonb("delivery").notNull(), ...timestamps
}, t => [index("orders_user_idx").on(t.userId), uniqueIndex("orders_legacy_unique").on(t.legacyId)]);

export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(), orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(), productId: uuid("product_id").references(() => products.id).notNull(), variantId: uuid("variant_id").references(() => productVariants.id), title: text("title").notNull(), sku: text("sku"), quantity: integer("quantity").notNull(), unitPrice: integer("unit_price").notNull(), options: jsonb("options").default({}).notNull()
}, t => [index("order_items_order_idx").on(t.orderId)]);

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(), orderId: uuid("order_id").references(() => orders.id).notNull(), provider: text("provider").default("flutterwave").notNull(), providerReference: text("provider_reference"), transactionId: text("transaction_id"), status: paymentStatus("status").default("pending").notNull(), amount: integer("amount").notNull(), currency: text("currency").default("UGX").notNull(), checkoutUrl: text("checkout_url"), metadata: jsonb("metadata").default({}).notNull(), ...timestamps
}, t => [uniqueIndex("payments_order_unique").on(t.orderId), uniqueIndex("payments_reference_unique").on(t.providerReference)]);

export const paymentEvents = pgTable("payment_events", {
  id: uuid("id").defaultRandom().primaryKey(), providerEventId: text("provider_event_id").notNull(), paymentId: uuid("payment_id").references(() => payments.id), eventType: text("event_type").notNull(), payload: jsonb("payload").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, t => [uniqueIndex("payment_events_provider_unique").on(t.providerEventId)]);

export const carts = pgTable("carts", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }), items: jsonb("items").default([]).notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const favorites = pgTable("favorites", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }), items: jsonb("items").default([]).notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const reviews = pgTable("reviews", {
  id: uuid("id").defaultRandom().primaryKey(), legacyId: text("legacy_id"), userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(), productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(), customerName: text("customer_name").notNull(), rating: integer("rating").notNull(), text: text("text").notNull(), purchasedOptions: jsonb("purchased_options").default({}).notNull(), attachment: jsonb("attachment"), verifiedPurchase: boolean("verified_purchase").default(false).notNull(), ...timestamps
}, t => [uniqueIndex("reviews_user_product_unique").on(t.userId, t.productId), uniqueIndex("reviews_legacy_unique").on(t.legacyId), index("reviews_product_idx").on(t.productId)]);

export const storefrontSettings = pgTable("storefront_settings", {
  key: text("key").primaryKey(), value: jsonb("value").default({}).notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
