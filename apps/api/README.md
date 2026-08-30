# MPWR API

The API is a standalone TypeScript service built with NestJS/Fastify, PostgreSQL, Redis, Google Maps Platform, Pesapal API 3.0, Resend, and Cloudflare R2. Storefront data, authentication, and uploaded media are handled by the MPWR stack; Firebase is only retained as a temporary migration source.

## Local setup

1. Install Node.js 22 and Docker Desktop.
2. Copy `.env.example` to `.env` and fill in the Google Maps, Pesapal sandbox, and production email secrets.
3. Start infrastructure with `docker compose up postgres redis -d`.
4. Run `npm install`, `npm run api:migrate`, and `npm run api:dev` from the repository root.
5. Import the existing static catalogue with `npm run api:import-products -- ../../js/products.js`.

Enable the Google Geocoding API and Routes API. Restrict the server key to those APIs and to the production server IPs. Never put `GOOGLE_MAPS_API_KEY`, `PESAPAL_CONSUMER_KEY`, `PESAPAL_CONSUMER_SECRET`, or `JWT_SECRET` in browser code.

## Checkout flow

1. Register or sign in through `POST /v1/auth/register` or `POST /v1/auth/login`.
2. Send UUID product IDs and an Uganda destination to `POST /v1/delivery/quotes`.
3. The server reloads product prices, verifies the address is in Uganda, computes road distance from Kisaasi, selects the distance/size rate, and creates a 20-minute quote.
4. Create the order through `POST /v1/orders` with the returned `quoteId`.
5. Initialize hosted checkout through `POST /v1/payments/initialize/:orderId` and redirect to `checkoutUrl`.
6. Pesapal calls `POST /v1/payments/webhooks/pesapal`; the API retrieves the transaction directly from Pesapal and verifies its reference, amount, currency, and completion state before marking the order as processing.

## Main endpoints

- `GET /v1/health`
- `POST /v1/auth/register`, `POST /v1/auth/login`, `POST /v1/auth/logout`, `GET /v1/auth/me`
- `PATCH|DELETE /v1/auth/account`
- `POST /v1/auth/password-reset/request`, `POST /v1/auth/password-reset/confirm`
- `POST /v1/auth/email-verification/send`, `POST /v1/auth/email-verification/confirm`
- `GET|PATCH /v1/profile`
- `GET|PUT /v1/cart`, `GET|PUT /v1/favorites`
- `GET|PUT|PATCH /v1/reviews`
- `GET|PUT /v1/storefront/:key`
- `GET|POST|PATCH|DELETE /v1/addresses`
- `GET /v1/products`, `GET /v1/products/:id`
- `POST /v1/delivery/quotes`
- `POST /v1/orders`, `GET /v1/orders`, `GET /v1/orders/:id`
- `POST /v1/payments/initialize/:orderId`, `GET /v1/payments/:orderId`
- `POST /v1/payments/webhooks/pesapal`
- `GET|POST|PATCH /v1/admin/products`
- `GET /v1/orders/admin/all`, `PATCH /v1/orders/:id/status`
- `GET /v1/delivery/admin/rates`, `PATCH /v1/delivery/admin/rates/:id`

Admin endpoints require a user whose database `role` is `admin`. Promote the first trusted account directly in PostgreSQL; do not expose role assignment through public registration.

## Firestore migration

The browser compatibility adapter in `js/firestore-api.js` sends the former Firestore operations to this API. Authentication uses bcrypt password hashes in PostgreSQL and seven-day HTTP-only session cookies. Existing imported Firebase accounts must use **Forgot Password** once to establish a local password; Firebase Authentication is not contacted.

1. Generate a Firebase service-account key and place it at the repository root as `firebase-service-account.local.json`. This filename and migration exports are ignored by Git.
2. Export Firestore with `npm run firebase:export -- ../../firebase-service-account.local.json`.
3. Import the snapshot with `npm run firebase:import`.
4. Reconcile collection and PostgreSQL counts before disabling Firestore writes. Both scripts are safe to rerun; the importer upserts records by their legacy identifiers.

Do not commit, paste, or deploy the service-account JSON with the storefront. Revoke the key in Firebase Console after the final production migration if it is no longer required.

## Authentication email

No additional software is required. For production, create a Resend account, verify the website's sending domain, and configure `RESEND_API_KEY` and `AUTH_EMAIL_FROM`. Without `RESEND_API_KEY`, development requests return a local preview URL instead of sending mail. Reset and verification tokens are random, stored only as SHA-256 hashes, expire automatically, and can be used once.

## Media storage

Images are uploaded through authenticated `POST /v1/media/uploads/:purpose` requests and stored in the configured Cloudflare R2 bucket. Configure `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, and `R2_PUBLIC_BASE_URL`. Product uploads require an administrator; profile and review uploads are scoped to the signed-in user. JPEG, PNG, WebP, and GIF files are accepted up to 5 MB and their file signatures are validated by the API.

Run `npm run media:migrate-r2` after configuring R2 to copy unique Firebase-hosted images into R2 and replace nested database URLs. The command is idempotent. Use the `r2.dev` URL only for development and connect a custom media domain before production.

## Production notes

- Follow `docs/DEPLOYMENT.md` for the Railway and Cloudflare Pages deployment sequence.
- Run PostgreSQL and Redis as managed services with private networking, backups, and TLS.
- Deploy the API separately from the static storefront and set `WEB_ORIGIN` to the exact storefront origin.
- Run migrations before releasing a new API image.
- Register the production Pesapal IPN URL and configure its returned IPN ID in Railway.
- Firebase Authentication can be disabled after existing users have been notified to reset their passwords.
- Revoke and remove Firebase credentials after the final data and media reconciliation is complete.
