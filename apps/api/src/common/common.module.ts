import { Global, Module } from "@nestjs/common";
import { AdminGuard, AuthGuard, OrdersGuard } from "./auth";
@Global()
@Module({ providers: [AuthGuard, AdminGuard, OrdersGuard], exports: [AuthGuard, AdminGuard, OrdersGuard] })
export class CommonModule {}
