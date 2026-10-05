ALTER TABLE "search_events" ADD COLUMN IF NOT EXISTS "revenue" integer DEFAULT 0 NOT NULL;
ALTER TABLE "search_events" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;

CREATE TABLE IF NOT EXISTS "search_daily_analytics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "day" date NOT NULL,
  "query" text NOT NULL,
  "normalized_query" text NOT NULL,
  "searches" integer DEFAULT 0 NOT NULL,
  "clicks" integer DEFAULT 0 NOT NULL,
  "purchases" integer DEFAULT 0 NOT NULL,
  "revenue" integer DEFAULT 0 NOT NULL,
  "zero_results" integer DEFAULT 0 NOT NULL,
  "result_impressions" integer DEFAULT 0 NOT NULL,
  "clicked_products" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "purchased_products" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "search_daily_query_unique" ON "search_daily_analytics" ("day", "normalized_query");
CREATE INDEX IF NOT EXISTS "search_daily_day_idx" ON "search_daily_analytics" ("day");
CREATE INDEX IF NOT EXISTS "search_daily_query_idx" ON "search_daily_analytics" ("normalized_query");

INSERT INTO "search_daily_analytics" (
  "day",
  "query",
  "normalized_query",
  "searches",
  "clicks",
  "purchases",
  "revenue",
  "zero_results",
  "result_impressions",
  "clicked_products",
  "purchased_products",
  "updated_at"
)
SELECT
  date_trunc('day', "created_at")::date AS "day",
  min("query") AS "query",
  lower(trim(regexp_replace("query", '\s+', ' ', 'g'))) AS "normalized_query",
  count(*) FILTER (WHERE "kind" = 'search')::integer AS "searches",
  count(*) FILTER (WHERE "kind" = 'click')::integer AS "clicks",
  count(*) FILTER (WHERE "kind" = 'purchase')::integer AS "purchases",
  coalesce(sum("revenue") FILTER (WHERE "kind" = 'purchase'), 0)::integer AS "revenue",
  count(*) FILTER (WHERE "kind" = 'search' AND coalesce("result_count", 0) = 0)::integer AS "zero_results",
  coalesce(sum("result_count") FILTER (WHERE "kind" = 'search'), 0)::integer AS "result_impressions",
  '{}'::jsonb AS "clicked_products",
  '{}'::jsonb AS "purchased_products",
  now()
FROM "search_events"
GROUP BY date_trunc('day', "created_at")::date, lower(trim(regexp_replace("query", '\s+', ' ', 'g')))
ON CONFLICT ("day", "normalized_query") DO NOTHING;
