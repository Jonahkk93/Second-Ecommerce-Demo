# MPWR production deployment

The production layout is:

- Cloudflare Pages: static storefront from `dist/`
- Railway: NestJS API container
- Railway PostgreSQL: application data
- Railway Redis: rate limiting and short-lived state
- Cloudflare R2: product, profile, and review images
- Resend: account verification and password-reset email
- Flutterwave: checkout and payment webhooks

Do not paste secrets into Git, Cloudflare Pages, or browser JavaScript. API-only
secrets belong in the Railway API service variables.

## 1. Prepare the accounts

1. Create a Railway account and connect the GitHub repository.
2. Create a Cloudflare Pages project for the same repository.
3. Verify the production sending domain in Resend.
4. Connect a custom domain to the R2 bucket before public launch. The `r2.dev`
   address is suitable for development only.

## 2. Create the Cloudflare Pages project

Create the Pages project first so its `https://<project>.pages.dev` origin is
known. Use these build settings:

```text
Production branch: main
Build command: npm run build
Build output directory: dist
Node version: 22
```

The storefront uses `/api/v1` on its own origin. A narrowly routed Pages
Function forwards those requests to Railway, which keeps the HTTP-only session
cookie first-party even while the temporary `pages.dev` and `railway.app`
domains are in use. After Railway assigns the API domain, add this Pages
Functions variable and redeploy:

```text
MPWR_API_ORIGIN=https://<railway-api-domain>
```

Do not set `MPWR_API_URL` in the Pages build environment; its default
`/api/v1` value is intentional. `MPWR_API_ORIGIN` is read only by the server-side
Function and is never written into browser assets. `_routes.json` limits
Function invocations to `/api/*`, so static assets remain static requests.

## 3. Create the Railway project

Create one Railway project with three services:

1. Add the standard PostgreSQL database service.
2. Add the standard Redis database service.
3. Add the GitHub repository as a service named `api`.

The API uses ordinary latitude and longitude columns. Google Routes computes
road distance from Kisaasi, so the standard PostgreSQL service is sufficient
and PostGIS is not required.

Railway reads `railway.json`, builds `apps/api/Dockerfile`, runs the production
migration before release, and checks `/v1/health`. Generate a public domain for
the API service after its variables have been configured.

## 4. Configure Railway variables

Set the following on the `api` service. Use Railway reference variables for
the database connections rather than copying passwords.

```dotenv
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
JWT_SECRET=<at-least-32-random-characters>
WEB_ORIGIN=https://<project>.pages.dev
GOOGLE_MAPS_API_KEY=<server-key>
FLW_SECRET_KEY=<flutterwave-secret-key>
FLW_SECRET_HASH=<flutterwave-webhook-secret-hash>
FLW_REDIRECT_URL=https://<project>.pages.dev/payment-complete.html
RESEND_API_KEY=<resend-api-key>
AUTH_EMAIL_FROM=MPWR <accounts@your-domain.example>
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-access-key-id>
R2_SECRET_ACCESS_KEY=<r2-secret-access-key>
R2_BUCKET=mpwr-media
R2_PUBLIC_BASE_URL=https://media.your-domain.example
```

Railway supplies `PORT`; do not set it manually. Restrict the Google key to
the Geocoding and Routes APIs. Keep PostgreSQL and Redis private and reference
their internal Railway URLs from the API.

To generate the JWT secret locally:

```bash
openssl rand -base64 48
```

## 5. Complete service configuration

1. Generate the Railway API public domain.
2. Set Cloudflare Pages `MPWR_API_ORIGIN` to that origin without `/v1`, then redeploy.
3. Set Railway `WEB_ORIGIN` to the exact Pages origin, then redeploy the API.
4. In Flutterwave, set the webhook URL to
   `https://<railway-api-domain>/v1/payments/webhooks/flutterwave`.
5. Confirm the Flutterwave secret hash matches `FLW_SECRET_HASH`.
6. Set the Flutterwave redirect URL to the final storefront payment-complete
   page.

When a custom storefront domain is connected, replace the temporary Pages
origin in `WEB_ORIGIN` and `FLW_REDIRECT_URL`, then redeploy both services. Keep
the browser API path at `/api/v1`; only update `MPWR_API_ORIGIN` if Railway's
origin changes.

## 6. Launch checks

Verify all of the following before accepting real payments:

- `GET https://<railway-api-domain>/v1/health` returns `status: ok`.
- Registration sends an email and verification succeeds.
- Password reset succeeds without contacting Firebase.
- Product, profile, and review uploads return the custom R2 media domain.
- A Uganda delivery quote uses road distance from Kisaasi.
- A Flutterwave test payment updates the order only after webhook verification.
- PostgreSQL backups and restore testing are enabled.
- Railway logs and alerting are monitored.
- Firebase export counts match PostgreSQL and R2 migration counts before old
  Firebase projects and credentials are disabled.

## 7. Rollback

Keep the previous Railway deployment available until the launch checks pass.
If a release fails health checks, Railway does not route traffic to it. Restore
the last known-good API deployment and database backup instead of editing live
production data manually.

## Provider documentation

- Railway PostgreSQL: https://docs.railway.com/databases/postgresql
- Railway Redis: https://docs.railway.com/databases/redis
- Railway health checks: https://docs.railway.com/deployments/healthchecks
- Railway pre-deploy commands: https://docs.railway.com/deployments/pre-deploy-command
- Cloudflare Pages static HTML: https://developers.cloudflare.com/pages/framework-guides/deploy-anything/
- Cloudflare Pages Functions: https://developers.cloudflare.com/pages/functions/get-started/
- Cloudflare Pages Function routing: https://developers.cloudflare.com/pages/functions/routing/
- Cloudflare R2 public buckets and custom domains: https://developers.cloudflare.com/r2/buckets/public-buckets/
