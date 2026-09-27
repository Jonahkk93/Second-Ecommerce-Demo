const forwardedRequestHeaders = headers => {
    const forwarded = new Headers();
    for (const [name, value] of Object.entries(headers)) {
        if (value == null || ["host", "content-length", "connection"].includes(name.toLowerCase())) continue;
        forwarded.set(name, Array.isArray(value) ? value.join(", ") : String(value));
    }
    return forwarded;
};

export default async function handler(request, response) {
    const configuredOrigin = String(process.env.MPWR_API_ORIGIN || "").trim();
    if (!configuredOrigin) {
        return response.status(503).json({ message: "API origin is not configured" });
    }

    let upstreamOrigin;
    try {
        upstreamOrigin = new URL(configuredOrigin);
    } catch {
        return response.status(500).json({ message: "API origin is invalid" });
    }
    if (upstreamOrigin.protocol !== "https:") {
        return response.status(500).json({ message: "API origin must use HTTPS" });
    }

    const incomingUrl = new URL(request.url, `https://${request.headers.host}`);
    const upstreamUrl = new URL(upstreamOrigin);
    const apiPath = incomingUrl.pathname.replace(/^\/api(?=\/|$)/, "") || "/";
    upstreamUrl.pathname = `${upstreamOrigin.pathname.replace(/\/$/, "")}${apiPath}`;
    upstreamUrl.search = incomingUrl.search;

    const method = String(request.method || "GET").toUpperCase();
    let body;
    if (!["GET", "HEAD"].includes(method) && request.body != null) {
        body = typeof request.body === "string" || Buffer.isBuffer(request.body)
            ? request.body
            : JSON.stringify(request.body);
    }

    try {
        const upstreamResponse = await fetch(upstreamUrl, {
            method,
            headers: forwardedRequestHeaders(request.headers),
            body,
            redirect: "manual"
        });
        response.status(upstreamResponse.status);
        upstreamResponse.headers.forEach((value, name) => {
            if (!["content-encoding", "content-length", "transfer-encoding"].includes(name.toLowerCase())) response.setHeader(name, value);
        });
        response.setHeader("Cache-Control", "no-store");
        return response.send(Buffer.from(await upstreamResponse.arrayBuffer()));
    } catch {
        return response.status(502).json({ message: "API is temporarily unavailable" });
    }
}
