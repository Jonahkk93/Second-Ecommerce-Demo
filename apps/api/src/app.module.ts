import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { DatabaseModule } from "./database/database.module";
import { CommonModule } from "./common/common.module";
import { HealthController } from "./health.controller";
import { AuthModule } from "./modules/auth.module";
import { ProductsModule } from "./modules/products.module";
import { DeliveryModule } from "./modules/delivery.module";
import { OrdersModule } from "./modules/orders.module";
import { PaymentsModule } from "./modules/payments.module";
import { AddressesModule } from "./modules/addresses.module";
import { validateEnvironment } from "./config";
import { CustomerDataModule } from "./modules/customer-data.module";
import { MediaModule } from "./modules/media.module";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }), JwtModule.register({ global: true }), CommonModule, DatabaseModule, AuthModule, AddressesModule, CustomerDataModule, MediaModule, ProductsModule, DeliveryModule, OrdersModule, PaymentsModule],
  controllers: [HealthController]
})
export class AppModule {}
