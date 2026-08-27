import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import Redis from "ioredis";
import * as schema from "./schema";

export const DB = Symbol("DB");
export const PG_POOL = Symbol("PG_POOL");
export const REDIS = Symbol("REDIS");
export type Database = NodePgDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    { provide: PG_POOL, inject: [ConfigService], useFactory: (config: ConfigService) => new Pool({ connectionString: config.getOrThrow("DATABASE_URL"), max: 10 }) },
    { provide: DB, inject: [PG_POOL], useFactory: (pool: Pool) => drizzle(pool, { schema }) },
    { provide: REDIS, inject: [ConfigService], useFactory: (config: ConfigService) => new Redis(config.getOrThrow("REDIS_URL"), { lazyConnect: true, maxRetriesPerRequest: 1 }) }
  ],
  exports: [DB, PG_POOL, REDIS]
})
export class DatabaseModule {}
