import { Body, Controller, Get, Inject, Module, NotFoundException, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Min } from "class-validator";
import { and, eq, ilike, or } from "drizzle-orm";
import { AdminGuard } from "../common/auth";
import { DB, Database } from "../database/database.module";
import { products, productVariants } from "../database/schema";

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
  @Get(":id") async one(@Param("id") id: string) { const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id); const [product] = await this.db.select().from(products).where(isUuid ? or(eq(products.id, id), eq(products.legacyId, id)) : eq(products.legacyId, id)).limit(1); if (!product) throw new NotFoundException("Product not found"); const variants = await this.db.select().from(productVariants).where(and(eq(productVariants.productId, product.id), eq(productVariants.active, true))); return { ...product, variants }; }
}

@UseGuards(AdminGuard)
@Controller("admin/products")
class AdminProductsController {
  constructor(@Inject(DB) private db: Database) {}
  @Get() list() { return this.db.select().from(products).limit(500); }
  @Post() async create(@Body() dto: CreateProductDto) { const { shippingClass, ...values } = dto; const [product] = await this.db.insert(products).values({ ...values, class: shippingClass }).returning(); return product; }
  @Patch(":id") async update(@Param("id") id: string, @Body() dto: UpdateProductDto) { const { shippingClass, ...values } = dto; const [product] = await this.db.update(products).set({ ...values, ...(shippingClass ? { class: shippingClass } : {}), updatedAt: new Date() }).where(eq(products.id, id)).returning(); if (!product) throw new NotFoundException("Product not found"); return product; }
}

@Module({ controllers: [ProductsController, AdminProductsController] })
export class ProductsModule {}
