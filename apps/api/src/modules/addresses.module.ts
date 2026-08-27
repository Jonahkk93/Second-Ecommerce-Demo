import { Body, Controller, Delete, Get, Inject, Module, NotFoundException, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { IsBoolean, IsOptional, IsString } from "class-validator";
import { and, desc, eq, ne } from "drizzle-orm";
import { AuthGuard, AuthUser, CurrentUser } from "../common/auth";
import { DB, Database } from "../database/database.module";
import { addresses } from "../database/schema";

class AddressDto {
  @IsOptional() @IsString() label?: string;
  @IsString() address!: string;
  @IsString() city!: string;
  @IsString() district!: string;
  @IsOptional() @IsString() googlePlaceId?: string;
  @IsOptional() @IsString() latitude?: string;
  @IsOptional() @IsString() longitude?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

class UpdateAddressDto {
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() googlePlaceId?: string;
  @IsOptional() @IsString() latitude?: string;
  @IsOptional() @IsString() longitude?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

@UseGuards(AuthGuard)
@Controller("addresses")
class AddressesController {
  constructor(@Inject(DB) private db: Database) {}

  @Get()
  list(@CurrentUser() user: AuthUser) { return this.db.select().from(addresses).where(eq(addresses.userId, user.sub)).orderBy(desc(addresses.isDefault), desc(addresses.createdAt)); }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: AddressDto) {
    return this.db.transaction(async tx => {
      if (dto.isDefault) await tx.update(addresses).set({ isDefault: false, updatedAt: new Date() }).where(eq(addresses.userId, user.sub));
      const [address] = await tx.insert(addresses).values({ ...dto, userId: user.sub, country: "Uganda" }).returning();
      return address;
    });
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateAddressDto) {
    return this.db.transaction(async tx => {
      if (dto.isDefault) await tx.update(addresses).set({ isDefault: false, updatedAt: new Date() }).where(and(eq(addresses.userId, user.sub), ne(addresses.id, id)));
      const [address] = await tx.update(addresses).set({ ...dto, country: "Uganda", updatedAt: new Date() }).where(and(eq(addresses.id, id), eq(addresses.userId, user.sub))).returning();
      if (!address) throw new NotFoundException("Address not found");
      return address;
    });
  }

  @Delete(":id")
  async remove(@CurrentUser() user: AuthUser, @Param("id") id: string) { const [address] = await this.db.delete(addresses).where(and(eq(addresses.id, id), eq(addresses.userId, user.sub))).returning(); if (!address) throw new NotFoundException("Address not found"); return { deleted: true }; }
}

@Module({ controllers: [AddressesController] })
export class AddressesModule {}
