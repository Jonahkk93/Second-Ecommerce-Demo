import { Controller, Get, Inject } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DB, Database } from "./database/database.module";
import { REDIS } from "./database/database.module";
import Redis from "ioredis";
@Controller("health")
export class HealthController {
  constructor(@Inject(DB) private readonly db: Database, @Inject(REDIS) private readonly redis: Redis) {}
  @Get() async health() { await Promise.all([this.db.execute(sql`select 1`), this.redis.ping()]); return { status: "ok", service: "mpwr-api" }; }
}
