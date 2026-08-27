import { Global, Module } from "@nestjs/common";
import { AdminGuard, AuthGuard } from "./auth";
@Global()
@Module({ providers: [AuthGuard, AdminGuard], exports: [AuthGuard, AdminGuard] })
export class CommonModule {}
