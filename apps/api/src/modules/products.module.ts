import { Body, Controller, Delete, Get, Inject, Injectable, Module, NotFoundException, OnModuleDestroy, OnModuleInit, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Min } from "class-validator";
import { and, eq, ilike, or } from "drizzle-orm";
import { AdminGuard } from "../common/auth";
import { DB, Database } from "../database/database.module";
import { orderItems, products, productVariants } from "../database/schema";

const PRODUCT_TRASH_DAYS = 60;

type ProductMetadata = Record<string, unknown> & {
  _trash?: { deletedAt?: string; deleteAfter?: string; wasActive?: boolean };
  _purged?: boolean;
};

@Injectable()
class ProductTrashService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  constructor(@Inject(DB) private db: Database) {}

  onModuleInit() {
    void this.purgeExpired();
    this.timer = setInterval(() => void this.purgeExpired(), 60 * 60 * 1000);
    this.timer.unref?.();
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async purgeExpired() {
    const inactive = await this.db.select().from(products).where(eq(products.active, false));
    const expired = inactive.filter(product => {
      const metadata = (product.metadata || {}) as ProductMetadata;
      const deleteAfter = metadata._trash?.deleteAfter;
      return deleteAfter && Date.parse(deleteAfter) <= Date.now();
    });

    for (const product of expired) await this.purgeProduct(product);
  }

  async purgeProduct(product: typeof products.$inferSelect) {
    const [orderedItem] = await this.db.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.productId, product.id)).limit(1);
    if (!orderedItem) {
      await this.db.delete(products).where(eq(products.id, product.id));
      return;
    }
    // Order items already retain the purchased title, SKU and price. Keep only
    // this minimal parent record so the database relationship remains valid.
    await this.db.update(products).set({
      title: "Deleted product",
      description: null,
      imageUrl: null,
      metadata: { _purged: true, purgedAt: new Date().toISOString() },
      updatedAt: new Date()
    }).where(eq(products.id, product.id));
  }
}

class CreateProductDto {
  @IsOptional() @IsString() legacyId?: string;
  @IsString() title!: string;
  @IsString() slug!: string;
  @IsOptional() @IsString() description?: string;
  @IsInt() @Min(0) price!: number;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsIn(["small", "medium", "large"]) shippingClass?: "small" | "medium" | "large";
  @IsOptional() @IsInt() @Min(0) weightGrams?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

class UpdateProductDto {
  @IsOptional() @IsString() legacyId?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() @Min(0) price?: number;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsIn(["small", "medium", "large"]) shippingClass?: "small" | "medium" | "large";
  @IsOptional() @IsInt() @Min(0) weightGrams?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

@Controller("products")
class ProductsController {
  constructor(@Inject(DB) private db: Database) {}
  @Get() list(@Query("q") q?: string) { return this.db.select().from(products).where(q ? and(eq(products.active, true), ilike(products.title, `%${q}%`)) : eq(products.active, true)).limit(100); }
  @Get(":id") async one(@Param("id") id: string) { const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id); const identifier = isUuid ? or(eq(products.id, id), eq(products.legacyId, id)) : eq(products.legacyId, id); const [product] = await this.db.select().from(products).where(and(eq(products.active, true), identifier)).limit(1); if (!product) throw new NotFoundException("Product not found"); const variants = await this.db.select().from(productVariants).where(and(eq(productVariants.productId, product.id), eq(productVariants.active, true))); return { ...product, variants }; }
}

@UseGuards(AdminGuard)
@Controller("admin/products")
class AdminProductsController {
  constructor(@Inject(DB) private db: Database, private trash: ProductTrashService) {}
  private async resolve(identifier: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
    const [product] = await this.db.select().from(products).where(isUuid ? or(eq(products.id, identifier), eq(products.legacyId, identifier)) : eq(products.legacyId, identifier)).limit(1);
    if (!product) throw new NotFoundException("Product not found");
    return product;
  }
  @Get() async list() {
    await this.trash.purgeExpired();
    const rows = await this.db.select().from(products).limit(500);
    return rows.filter(product => {
      const metadata = (product.metadata || {}) as ProductMetadata;
      return !metadata._trash && !metadata._purged;
    });
  }
  @Get("deleted") async deleted() {
    await this.trash.purgeExpired();
    const rows = await this.db.select().from(products).where(eq(products.active, false)).limit(500);
    return rows.filter(product => Boolean(((product.metadata || {}) as ProductMetadata)._trash));
  }
  @Post() async create(@Body() dto: CreateProductDto) { const { shippingClass, ...values } = dto; const [product] = await this.db.insert(products).values({ ...values, class: shippingClass }).returning(); return product; }
  @Patch(":id") async update(@Param("id") id: string, @Body() dto: UpdateProductDto) { const current = await this.resolve(id); const { shippingClass, ...values } = dto; const [product] = await this.db.update(products).set({ ...values, ...(shippingClass ? { class: shippingClass } : {}), updatedAt: new Date() }).where(eq(products.id, current.id)).returning(); return product; }
  @Delete(":id") async moveToTrash(@Param("id") id: string) {
    const current = await this.resolve(id);
    const deletedAt = new Date();
    const deleteAfter = new Date(deletedAt.getTime() + PRODUCT_TRASH_DAYS * 24 * 60 * 60 * 1000);
    const metadata = { ...((current.metadata || {}) as ProductMetadata), _trash: { deletedAt: deletedAt.toISOString(), deleteAfter: deleteAfter.toISOString(), wasActive: current.active } };
    const [product] = await this.db.update(products).set({ active: false, metadata, updatedAt: deletedAt }).where(eq(products.id, current.id)).returning();
    return product;
  }
  @Delete(":id/permanent") async permanentlyDelete(@Param("id") id: string) {
    const current = await this.resolve(id);
    const metadata = (current.metadata || {}) as ProductMetadata;
    if (!metadata._trash || metadata._purged) throw new NotFoundException("Deleted product not found");
    await this.trash.purgeProduct(current);
    return { id: current.id, permanentlyDeleted: true };
  }
  @Post(":id/restore") async restore(@Param("id") id: string) {
    const current = await this.resolve(id);
    const { _trash, _purged, ...metadata } = (current.metadata || {}) as ProductMetadata;
    if (!_trash || _purged) throw new NotFoundException("Deleted product not found");
    const [product] = await this.db.update(products).set({ active: _trash.wasActive !== false, metadata, updatedAt: new Date() }).where(eq(products.id, current.id)).returning();
    return product;
  }
}

@Module({ controllers: [ProductsController, AdminProductsController], providers: [ProductTrashService] })
export class ProductsModule {}
