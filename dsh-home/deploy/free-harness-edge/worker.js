const HOP_BY_HOP_HEADERS = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
];

export default {
  async fetch(request, env) {
    if (!env.UPSTREAM) {
      return new Response("Harness upstream is not configured.", { status: 503 });
    }

    const incomingUrl = new URL(request.url);
    const upstreamUrl = new URL(env.UPSTREAM);
    upstreamUrl.pathname = incomingUrl.pathname;
    upstreamUrl.search = incomingUrl.search;

    const headers = new Headers(request.headers);
    for (const name of HOP_BY_HOP_HEADERS) headers.delete(name);
    headers.delete("host");
    headers.set("x-forwarded-host", "harness.artificialhedge.co");
    headers.set("x-forwarded-proto", "https");
    headers.set("origin", "https://harness.artificialhedge.co");
    const referer = headers.get("referer");
    if (referer) {
      const refererUrl = new URL(referer);
      headers.set(
        "referer",
        `https://harness.artificialhedge.co${refererUrl.pathname}${refererUrl.search}`,
      );
    }

    const init = {
      method: request.method,
      headers,
      redirect: "manual",
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body;
    }

    const upstreamResponse = await fetch(upstreamUrl, init);
    if (upstreamResponse.status === 101) return upstreamResponse;

    const responseHeaders = new Headers(upstreamResponse.headers);
    const location = responseHeaders.get("location");
    if (location) {
      const resolved = new URL(location, upstreamUrl);
      if (resolved.origin === upstreamUrl.origin) {
        responseHeaders.set(
          "location",
          `${incomingUrl.origin}${resolved.pathname}${resolved.search}${resolved.hash}`,
        );
      }
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  },
};
