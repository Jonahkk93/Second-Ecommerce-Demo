# MPWR cookie preferences

`js/cookie-consent.js` loads synchronously before storefront scripts. It starts
optional categories off and stores explicit choices in `mpwrCookieConsentV1`
for 180 days on the current browser origin. Account, footer, About MPWR and
privacy-policy links open the same modal. `manage-cookies.html` is the standalone
fallback and also opens that modal on arrival.
Visitors without a current saved choice see a bottom banner on storefront pages.
Its Reject and Accept all buttons save the choice immediately; Manage
cookies opens the detailed panel. The banner stays hidden after a valid choice,
returns when that choice expires, and is suppressed on the standalone settings
page. Closing the detailed panel without saving returns to the banner.

- Necessary: sign-in, security, cart, checkout, requested account services and consent choices.
- Performance: search event requests, visitor ID and search attribution.
- Functional: recent searches, recently viewed products and saved discovery session order.
- Targeting: local product interaction signals for personalized recommendations.

No advertising SDK is installed by this feature. New optional integrations must
check `window.MPWRCookieConsent.allows(category)` before storage access or a
request, and stop when `mpwr:cookie-consent-changed` fires. The API returns false
for unknown categories. Treat a missing API as denied.

Withdrawal removes the associated optional browser records. Cart/order writes
strip search attribution when performance is denied, including account-restored
carts. This does not remove historical server analytics or necessary order data.
Closing the panel discards unsaved switch changes. Saving notifies the current
tab, and storage events update other tabs on the same origin.

Run `node --test tests/cookie-consent.test.mjs` for consent persistence,
revocation, expiry, storage failures, analytics gating, recommendation signals
and outbound cart/order checks. Run `npm run build` for the deployable site.
