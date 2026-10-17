# MPWR legal and privacy readiness — 17 October 2026

Working implementation and operational handover, not a compliance certificate.
The production service and business records have not been independently audited.

## Implemented

- Original 17-section shopping terms: product/options information, order review,
  prices, payments, delivery, cancellations, returns, reviews, restrictions,
  privacy, complaints and prospective changes. MPWR contact details are included.
- Clear distinction between the voluntary return offer and mandatory remedies.
- Linked privacy notice at signup and checkout; optional cookie permission is
  separate from agreeing to shopping terms. No preselected acceptance checkbox.
- API validation requires explicit acceptance of the current version at signup
  and both order-creation endpoints. The server records its own timestamp and
  source, plus terms/notice versions. Signup evidence is in `users.legacy_data`;
  checkout evidence is in `orders.delivery.policyAcceptance`.
- Readable, printable policies, section links and an immutable archived bundle at
  `legal-archive/2026-10-17.2/` (previous version preserved). The generator refuses to rewrite that version with
  changed wording. Future releases must archive a new version and update both
  legal-policy constants and the cookie notice version if relevant.
- Authenticated privacy-request form, customer receipt/status/outcome page, and
  administrator queue. Types: access, correction, deletion and objection.
  Repeated submissions of the same open type return the original receipt.
- Account deletion now submits a reviewed request, including for customers with
  existing orders. It **does not instantly delete or disable the account** and
  does not cancel orders. UI wording and the policy state this explicitly.
- Admin closure requires an outcome. Closing a request **does not perform data
  erasure**. Staff must execute and verify the actual work before recording closure.
- Profile updates no longer return the password hash or the full user row.
- API bootstrap sets `Cache-Control: no-store` and `X-Content-Type-Options`.
- Optional browser categories remain off by default. Saved choices include a
  notice version and timestamp. Obsolete notice versions or expired choices fail
  closed; expiry also clears associated optional storage when consent is checked.

## Required business decisions and external work

| Item | Current status / required action | Owner |
| --- | --- | --- |
| Legal seller | MPWR name, Kisaasi/Bahai Road, email and telephone supplied. Owner requested uppercase placeholders for entity type, proprietor/full legal name, registration details, address for service and relevant company/director disclosures. These are marked as draft and still require replacement with verified details. | Business owner |
| Sales territory | Current checkout supports Uganda. Owner confirmed Uganda-only sales and delivery. Policies now state this explicitly. | Business owner |
| PDPO | Verify registration category/status, responsible privacy lead, renewal and reporting obligations. No application, payment or certificate has been submitted or verified here. | Business owner / adviser |
| Legal review | Uganda-qualified adviser to review the actual product categories, cancellation rights, seller disclosures and policy enforceability. | Business owner / lawyer |
| Provider register | Confirm actual production host, database and backup providers, delivery partners, countries, subprocessors, contracts and transfer arrangements. Code references alone do not prove an active provider or lawful transfer. | Owner / operator |
| Retention | Approve a record-by-record schedule with legal/accounting advice, configure deletion jobs and media/backup lifecycles, and verify restores do not reintroduce erased data. No blanket retention period or automatic erasure job has been claimed. | Owner / accountant / operator |
| Privacy operations | Check the admin queue daily; fulfil requests, verify identity proportionately, and communicate outcomes. There is no automatic email notification or autonomous erasure/export engine. | Privacy lead |
| Production verification | Deploy matching frontend/API and migration, inspect HTTPS/cookies/CORS/cache behavior, verify external trackers, test rights workflows, access controls, payment callbacks and backups. | Operator |

PDPO's current resource centre includes registration guidance and a 2026 annual
report notice. Check applicability and current instructions directly with PDPO;
do not infer that MPWR is registered from the presence of a policy page.

## Privacy request procedure

1. Review new requests in Management → Privacy requests. Record email/telephone
   requests there through an authorized operational process too; they are not
   automatically imported into the website queue.
2. Confirm the requester and locate relevant records. Request only proportionate
   verification; never ask for a password, PIN or full card number. The web form
   is a convenient channel, not a replacement for a prescribed statutory form.
3. Identify scope, recipient systems, deadlines and any applicable retention
   reason. Track urgency independently: the queue currently has no deadline
   reminders, escalation service or automated breach detection.
4. For access, assemble a checked copy without secrets or other people's data.
   For correction, update each affected system. For deletion, review open orders,
   refunds, payment records, complaints, legal holds, uploads and backups before
   erasing or de-identifying. Do not blindly delete a user row: orders and quotes
   reference it. For objections, assess the specific use and stop it where required.
5. Record the completed action, retained categories, reason, review period and
   customer-facing explanation. Notify relevant recipients when needed. Use an
   authorized delivery channel for any personal-data export; do not put it in a
   public media bucket. Close the queue item only after completion/verified outcome.
6. Keep an appropriate audit record without retaining unnecessary identity copies.
   A denied request needs a reason and an escalation route, not a silent closure.

Access requests have a thirty-day statutory maximum in the Act; objection
notices have a fourteen-day written-response rule. Check the applicable form and
procedure for each request. These are not a universal deadline for every right.

## Data/storage inventory and retention gaps

| Data | Current implementation | Remaining work |
| --- | --- | --- |
| Session | `mpwr_session`, HttpOnly, SameSite=Lax, seven days; Secure in production | Verify deployed HTTPS, origin/CSRF defenses and password-reset session revocation |
| Reset / email links | Hashed tokens; one hour / 24-hour validity | Schedule expired/used-token deletion; strengthen outstanding-token/session invalidation |
| Account, addresses, saved preferences, cart, wishlist | Database records plus local shopping storage | Approve inactive-account rules and deletion/anonymisation procedure |
| Orders, payment/refund references, terms receipts | Persistent transaction records | Confirm accounting/dispute periods and legal holds; retain archived policy evidence |
| Reviews, profile images, feedback and appeals | Database plus media objects; some media URLs publicly retrievable | Apply media access/lifecycle rules; remove orphaned files; limit sensitive evidence uploads |
| `mpwrCookieConsentV1` | Browser-local current choices, notice version, timestamp; 180 days | No central consent log. Decide proportionate evidence needs; never imply tamper-proof consent |
| Recent searches/history/session ordering | Functional category; cleared on withdrawal | No per-entry expiry while category remains enabled |
| Search visitor/attribution | Performance category; client gates requests and removes optional attribution on withdrawal | Server search-event endpoint does not independently verify a consent receipt; approve raw/aggregate retention and purge routine |
| Local recommendation signals | Targeting category; cleared on withdrawal | Review limits whenever new personalization is added |
| Server analytics, logs, backups and providers | Separate systems, not erased by a cookie toggle | Establish retention, access logging, provider safeguards and tested deletion/restore procedures |

## Incident procedure

The owner should appoint a responsible contact and keep an incident log: detect,
contain, preserve necessary evidence, establish affected data/people/providers,
notify the regulator as required, follow regulator directions on customer notices,
recover and verify the fix. Uganda's Act requires immediate regulator notification
when the relevant unauthorized access/acquisition is believed to have occurred;
do not substitute an assumed GDPR 72-hour rule. This document is a procedure,
not proof of monitoring, staff training or a filed notification.

## Release and validation

Run `npm run api:migrate`, `npm run api:build`, `npm run build`,
`node --test tests/cookie-consent.test.mjs`, `node tests/legal-readiness-api.cjs`
and `node tests/feedback-api.cjs` against the local disposable-test workflow.
The API test suppresses outbound email and removes its own test records.

Migration `0017_privacy_requests.sql` has been applied to the local database.
Frontend and API changes must ship together: the old API will reject new terms
fields and does not implement privacy requests. At this audit, port 3000 still
served the previous API and Docker CLI commands did not complete. No production
deployment has been performed. Restart/rebuild the API before using the new
workflow in that preview; do not mistake successful in-process tests for a live
production verification.

An updated local review build is available at `http://127.0.0.1:8787/`, with the
new API on port 3002. It was built with
`MPWR_API_URL=http://127.0.0.1:3002/v1 npm run build`. This is a local preview
configuration, not a production artifact: rebuild with the production API origin
before deployment. The usual port-5501 source preview still targets port 3000.

## Primary sources reviewed

- [Electronic Transactions Act, Cap. 99 — NITA-U](https://www.nita.go.ug/sites/default/files/2026-09/Electronic%20Transactions%20Act%20cap%2099.pdf), consumer protection, sections 23–27.
- [Data Protection and Privacy Act, Cap. 97 — NITA-U](https://www.nita.go.ug/sites/default/files/2026-09/Data%20Protection%20and%20Privacy%20Act%20cap%2097.pdf), notices, retention, transfers, security and rights.
- [PDPO official resource centre](https://pdpo.go.ug/knowledge-center), registration guidance, prescribed forms and current reporting notices.

The checklist separates implemented controls from unresolved legal/business
facts. Neither longer terms nor this checklist guarantees freedom from disputes.

## Owner clarification

Uganda-only launch confirmed. Missing registered seller details are visibly marked
as draft uppercase placeholders in Terms and Legal Information, as requested.
Current terms version is 2026-10-17.2; the privacy/cookie notice remains version
2026-10-17.1 because its wording did not change. Replace placeholders before launch.
