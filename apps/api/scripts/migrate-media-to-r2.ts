import "dotenv/config";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../src/database/schema";
import { carts, favorites, orders, products, reviews, storefrontSettings, users } from "../src/database/schema";

const required = ["DATABASE_URL", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_BASE_URL"] as const;
for (const key of required) if (!process.env[key]) throw new Error(`${key} is required`);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
const client = new S3Client({ region: "auto", endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! } });
const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL!.replace(/\/$/, "");
const migrated = new Map<string, string>();
let uploadCount = 0;

function isFirebaseMedia(value: string) { return /(?:firebasestorage\.googleapis\.com|storage\.googleapis\.com\/mpwr5432|firebasestorage\.app)/i.test(value); }
function extension(contentType: string) { return ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" } as Record<string, string>)[contentType]; }

async function migrateUrl(url: string) {
  if (!isFirebaseMedia(url)) return url;
  if (migrated.has(url)) return migrated.get(url)!;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not download Firebase media (${response.status})`);
  const contentType = String(response.headers.get("content-type") || "").split(";")[0].toLowerCase();
  const suffix = extension(contentType);
  if (!suffix) throw new Error(`Unsupported Firebase media type: ${contentType || "unknown"}`);
  const key = `migration/${createHash("sha256").update(url).digest("hex").slice(0, 32)}.${suffix}`;
  const body = Buffer.from(await response.arrayBuffer());
  await client.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key, Body: body, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }));
  const next = `${publicBaseUrl}/${key}`;
  migrated.set(url, next);
  uploadCount += 1;
  return next;
}

async function transform(value: unknown): Promise<unknown> {
  if (typeof value === "string") return migrateUrl(value);
  if (Array.isArray(value)) return Promise.all(value.map(transform));
  if (!value || typeof value !== "object") return value;
  const entries = await Promise.all(Object.entries(value).map(async ([key, entry]) => [key, await transform(entry)] as const));
  return Object.fromEntries(entries);
}
function changed(before: unknown, after: unknown) { return JSON.stringify(before) !== JSON.stringify(after); }

async function main() {
  for (const row of await db.select().from(users)) { const profileImage = await transform(row.profileImage) as string | null; const legacyData = await transform(row.legacyData); const paymentMethods = await transform(row.paymentMethods); if ([changed(row.profileImage, profileImage), changed(row.legacyData, legacyData), changed(row.paymentMethods, paymentMethods)].some(Boolean)) await db.update(users).set({ profileImage, legacyData, paymentMethods, updatedAt: new Date() }).where(eq(users.id, row.id)); }
  for (const row of await db.select().from(products)) { const imageUrl = await transform(row.imageUrl) as string | null; const metadata = await transform(row.metadata); if (changed(row.imageUrl, imageUrl) || changed(row.metadata, metadata)) await db.update(products).set({ imageUrl, metadata, updatedAt: new Date() }).where(eq(products.id, row.id)); }
  for (const row of await db.select().from(reviews)) { const attachment = await transform(row.attachment); if (changed(row.attachment, attachment)) await db.update(reviews).set({ attachment, updatedAt: new Date() }).where(eq(reviews.id, row.id)); }
  for (const row of await db.select().from(carts)) { const items = await transform(row.items); if (changed(row.items, items)) await db.update(carts).set({ items, updatedAt: new Date() }).where(eq(carts.userId, row.userId)); }
  for (const row of await db.select().from(favorites)) { const items = await transform(row.items); if (changed(row.items, items)) await db.update(favorites).set({ items, updatedAt: new Date() }).where(eq(favorites.userId, row.userId)); }
  for (const row of await db.select().from(orders)) { const customer = await transform(row.customer); const delivery = await transform(row.delivery); if (changed(row.customer, customer) || changed(row.delivery, delivery)) await db.update(orders).set({ customer, delivery, updatedAt: new Date() }).where(eq(orders.id, row.id)); }
  for (const row of await db.select().from(storefrontSettings)) { const value = await transform(row.value); if (changed(row.value, value)) await db.update(storefrontSettings).set({ value, updatedAt: new Date() }).where(eq(storefrontSettings.key, row.key)); }
  console.log(`R2 media migration completed: ${uploadCount} unique Firebase image(s) uploaded`);
}

void main().finally(() => pool.end()).catch(error => { console.error(error); process.exitCode = 1; });
