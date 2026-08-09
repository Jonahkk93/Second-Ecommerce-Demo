# MPWR storefront

## Build and deploy

Run `npm run build` before publishing. The build copies the static site into
`dist/` and assigns one deployment version to local CSS and JavaScript URLs.
Vercel uses this command automatically through `vercel.json`.

Do not edit `dist/`; it is generated and ignored by Git.

## Loading lifecycle

Pages reveal after their critical local content is rendered. Dynamic page
scripts should call `window.MPWRLoading?.ready()` after their first useful
render. The shared loader still has a bounded fallback, and image loaders
continue independently when an image request is slow.

## Search suggestions

Edit the JSON in `#search-suggestions-data` in `search.html`. Both the initial
loading chips and interactive search chips read that single configuration.
