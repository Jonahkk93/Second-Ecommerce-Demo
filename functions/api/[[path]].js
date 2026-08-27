export async function onRequest({ request, env }) {
    const configuredOrigin = String(env.MPWR_API_ORIGIN || "").trim();
    if (!configuredOrigin) {
        return Response.json({ message: "API origin is not configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }

    let upstreamBase;
    try {
        upstreamBase = new URL(configuredOrigin);
    } catch {
        return Response.json({ message: "API origin is invalid" }, { status: 500, headers: { "Cache-Control": "no-store" } });
    }

    if (upstreamBase.protocol !== "https:") {
        return Response.json({ message: "API origin must use HTTPS" }, { status: 500, headers: { "Cache-Control": "no-store" } });
    }

    const incomingUrl = new URL(request.url);
    const upstreamUrl = new URL(upstreamBase);
    const apiPath = incomingUrl.pathname.replace(/^\/api(?=\/|$)/, "") || "/";
    upstreamUrl.pathname = `${upstreamBase.pathname.replace(/\/$/, "")}${apiPath}`;
    upstreamUrl.search = incomingUrl.search;

    const upstreamRequest = new Request(upstreamUrl, request);
    upstreamRequest.headers.delete("host");
    upstreamRequest.headers.set("x-forwarded-host", incomingUrl.host);
    upstreamRequest.headers.set("x-forwarded-proto", "https");

    try {
        return await fetch(upstreamRequest);
    } catch {
        return Response.json({ message: "API is temporarily unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }
}
