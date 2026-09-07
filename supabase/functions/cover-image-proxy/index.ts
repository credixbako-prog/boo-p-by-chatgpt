import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const PRODUCTION_ORIGIN = "https://credixbako-prog.github.io";
const FETCH_TIMEOUT_MS = 7_000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);
const ALLOWED_HOSTS = [
  "covers.openlibrary.org",
  "books.google.com",
  "googleusercontent.com",
  "nicebooks.com",
  "chasse-aux-livres.fr",
  "shnyjvinzjvgourpscvh.supabase.co",
];

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  const isLocal = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin);
  const allowedOrigin = origin === PRODUCTION_ORIGIN || isLocal ? origin : PRODUCTION_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function errorResponse(request: Request, message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function isAllowedHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function parseImageUrl(value: string | null) {
  if (!value || value.length > 2_048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return null;
    if (!isAllowedHost(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

async function fetchAllowedImage(initialUrl: URL) {
  let current = initialUrl;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await fetch(current, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "Accept": "image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.8,*/*;q=0.1",
        "User-Agent": "BOO-P cover preview/1.0",
      },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirect === MAX_REDIRECTS) throw new Error("too_many_redirects");
      const next = parseImageUrl(new URL(response.headers.get("location") || "", current).href);
      if (!next) throw new Error("unsafe_redirect");
      current = next;
      continue;
    }
    return response;
  }
  throw new Error("too_many_redirects");
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "GET") return errorResponse(request, "Méthode non autorisée.", 405);

  const source = parseImageUrl(new URL(request.url).searchParams.get("url"));
  if (!source) return errorResponse(request, "Cette source de couverture n’est pas autorisée.", 400);

  try {
    const upstream = await fetchAllowedImage(source);
    if (!upstream.ok) return errorResponse(request, "La couverture est momentanément indisponible.", 502);

    const contentType = (upstream.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const announcedSize = Number(upstream.headers.get("content-length") || 0);
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) return errorResponse(request, "Le fichier reçu n’est pas une image compatible.", 415);
    if (announcedSize > MAX_IMAGE_BYTES) return errorResponse(request, "La couverture dépasse la taille autorisée.", 413);

    const body = await upstream.arrayBuffer();
    if (!body.byteLength || body.byteLength > MAX_IMAGE_BYTES) return errorResponse(request, "La couverture dépasse la taille autorisée.", 413);

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders(request),
        "Content-Type": contentType,
        "Content-Length": String(body.byteLength),
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.warn("cover-image-proxy", JSON.stringify({ host: source.hostname, error: String(error) }));
    return errorResponse(request, "La couverture n’a pas pu être chargée.", 504);
  }
});
