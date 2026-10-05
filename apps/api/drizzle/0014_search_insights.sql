CREATE TABLE IF NOT EXISTS "search_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "anonymous_id" text NOT NULL,
  "query" text NOT NULL,
  "kind" text NOT NULL,
  "result_count" integer,
  "product_id" text,
  "corrected_query" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "search_events_created_idx" ON "search_events" ("created_at");
CREATE INDEX IF NOT EXISTS "search_events_query_idx" ON "search_events" ("query");
