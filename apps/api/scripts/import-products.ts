import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import vm from "node:vm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { products } from "../src/database/schema";

type LegacyProduct = {
  id: string | number;
  title: string;
  price: string | number;
  image?: string;
  description?: string;
  shippingClass?: "small" | "medium" | "large";
  [key: string]: unknown;
};

const slugify = (title: string, id: string | number) => `${title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${id}`;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const input = resolve(process.cwd(), process.argv[2] || "../../js/products.js");
  const source = await readFile(input, "utf8");
  const window = { location: { href: "http://localhost/" } } as Record<string, any>;
  vm.runInNewContext(source, { window, URL, console }, { filename: input });
  const catalogue = window.products as LegacyProduct[];
  if (!Array.isArray(catalogue)) throw new Error("The input file did not expose window.products");
  const pool = new Pool({ connectionString });
  const db = drizzle(pool);
  try {
    for (const item of catalogue) {
      const { id, title, price, image, description, shippingClass, ...metadata } = item;
      await db.insert(products).values({ legacyId: String(id), title, slug: slugify(title, id), description, price: Number(price), imageUrl: image, class: shippingClass || "small", metadata }).onConflictDoUpdate({ target: products.legacyId, set: { title, description, price: Number(price), imageUrl: image, class: shippingClass || "small", metadata, updatedAt: new Date() } });
    }
    console.log(`Imported ${catalogue.length} products`);
  } finally {
    await pool.end();
  }
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
