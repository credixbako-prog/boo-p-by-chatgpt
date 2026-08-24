import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const NICEBOOKS_ORIGIN = "https://nicebooks.com";
const CHASSE_ORIGIN = "https://www.chasse-aux-livres.fr";
const PRODUCTION_ORIGIN = "https://credixbako-prog.github.io";
const FETCH_TIMEOUT_MS = 7_000;
const MAX_HTML_LENGTH = 1_500_000;

type BookMetadata = {
  source: "NiceBooks" | "Chasse aux Livres";
  sourceId: string;
  sourceUrl: string;
  isbn: string;
  title: string;
  authors: string[];
  publisher: string;
  publishedDate: string;
  edition: string;
  format: string;
  totalPages: number;
  description: string;
  descriptionSource: string;
  genre: string;
  genres: string[];
  coverUrl: string;
};

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  const isLocal = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin);
  const allowedOrigin = origin === PRODUCTION_ORIGIN || isLocal ? origin : PRODUCTION_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonResponse(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": status === 200 ? "private, max-age=3600" : "no-store",
    },
  });
}

function normalizeISBN(value: unknown) {
  return String(value || "").toUpperCase().replace(/[^0-9X]/g, "");
}

function isValidISBN10(value: string) {
  if (!/^\d{9}[\dX]$/.test(value)) return false;
  const sum = [...value].reduce((total, character, index) => {
    const digit = character === "X" ? 10 : Number(character);
    return total + digit * (10 - index);
  }, 0);
  return sum % 11 === 0;
}

function isValidISBN13(value: string) {
  if (!/^\d{13}$/.test(value)) return false;
  const sum = [...value.slice(0, 12)].reduce(
    (total, character, index) => total + Number(character) * (index % 2 ? 3 : 1),
    0,
  );
  return (10 - (sum % 10)) % 10 === Number(value[12]);
}

function isValidISBN(value: string) {
  return value.length === 10 ? isValidISBN10(value) : isValidISBN13(value);
}

function decodeEntities(value: unknown) {
  const named: Record<string, string> = {
    amp: "&", quot: '"', apos: "'", "#39": "'", lt: "<", gt: ">", nbsp: " ",
    eacute: "é", egrave: "è", ecirc: "ê", agrave: "à", acirc: "â", ccedil: "ç",
    ugrave: "ù", ucirc: "û", ocirc: "ô", icirc: "î", laquo: "«", raquo: "»", ndash: "–", mdash: "—",
  };
  return String(value || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+|#39);/gi, (entity, name) => named[String(name).toLowerCase()] ?? entity);
}

function plainText(value: unknown) {
  return decodeEntities(String(value || "").replace(/<br\s*\/?\s*>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(value: unknown, origin: string) {
  const decoded = decodeEntities(value).trim();
  if (!decoded) return "";
  try {
    const url = new URL(decoded, origin);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function normalizeAuthor(value: unknown) {
  const author = plainText(value);
  const parts = author.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length === 2 ? `${parts[1]} ${parts[0]}` : author;
}

async function fetchText(url: string, extraHeaders: Record<string, string> = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/json;q=0.9",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.6",
        "User-Agent": "BOO-P ISBN metadata proxy/1.0",
        ...extraHeaders,
      },
    });
    if (!response.ok) throw new Error(`Source distante indisponible (${response.status})`);
    const text = await response.text();
    if (text.length > MAX_HTML_LENGTH) throw new Error("Réponse distante trop volumineuse");
    return { text, response };
  } finally {
    clearTimeout(timeout);
  }
}

function parseNiceBooks(html: string, isbn: string): BookMetadata | null {
  const start = html.search(/<div\b[^>]*class=["'][^"']*search-result-line[^"']*["']/i);
  if (start < 0) return null;
  const end = html.indexOf("<script", start);
  const block = html.slice(start, end > start ? end : Math.min(html.length, start + 40_000));
  const titleMatch = block.match(/<a\b[^>]*href=["']([^"']*\/fr\/book\/[^"']+)["'][^>]*class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)
    || block.match(/<a\b[^>]*class=["'][^"']*title[^"']*["'][^>]*href=["']([^"']*\/fr\/book\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
  if (!titleMatch) return null;

  const authorMatch = block.match(/<a\b[^>]*href=["'][^"']*q=author[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
  const publisherMatch = block.match(/<a\b[^>]*href=["'][^"']*q=publisher[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
  const coverMatch = block.match(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/i);
  const detailsMatch = block.match(/<div[^>]*>\s*([^<]*?),\s*<em>([\s\S]*?)<\/em>,\s*([\d\s]+)\s*pages?\s*<\/div>/i);
  const sourceUrl = absoluteUrl(titleMatch[1], NICEBOOKS_ORIGIN);

  return {
    source: "NiceBooks",
    sourceId: sourceUrl,
    sourceUrl,
    isbn,
    title: plainText(titleMatch[2]),
    authors: authorMatch ? [normalizeAuthor(authorMatch[1])].filter(Boolean) : [],
    publisher: plainText(publisherMatch?.[1]),
    publishedDate: plainText(detailsMatch?.[1]),
    edition: "",
    format: plainText(detailsMatch?.[2]) || "Livre",
    totalPages: Math.max(0, Number(plainText(detailsMatch?.[3]).replace(/\s/g, "")) || 0),
    description: "",
    descriptionSource: "",
    genre: "",
    genres: [],
    coverUrl: absoluteUrl(coverMatch?.[1], NICEBOOKS_ORIGIN),
  };
}

async function lookupNiceBooks(isbn: string) {
  const sourceUrl = `${NICEBOOKS_ORIGIN}/fr/search/isbn?isbn=${encodeURIComponent(isbn)}`;
  const { text } = await fetchText(sourceUrl, { Referer: `${NICEBOOKS_ORIGIN}/fr/search/isbn` });
  return parseNiceBooks(text, isbn);
}

function firstCookie(response: Response) {
  const value = response.headers.get("set-cookie") || "";
  return value.split(";")[0].trim();
}

function parseChasse(html: string, isbn: string): BookMetadata | null {
  const row = html.match(/<tr\b[\s\S]*?<\/tr>/i)?.[0] || "";
  if (!row) return null;
  const titleMatch = row.match(/<div\b[^>]*class=["'][^"']*title[^"']*["'][^>]*>\s*<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
  if (!titleMatch) return null;
  const authorMatch = row.match(/<div\b[^>]*class=["'][^"']*creator-list[^"']*["'][^>]*>[\s\S]*?<a\b[^>]*>([\s\S]*?)<\/a>/i);
  const editorMatch = row.match(/<div\b[^>]*class=["'][^"']*editor[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  const publisherMatch = editorMatch?.[1].match(/<a\b[^>]*>([\s\S]*?)<\/a>/i);
  const editorText = plainText(editorMatch?.[1]);
  const bindingMatches = [...row.matchAll(/<div\b[^>]*class=["'][^"']*binding[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)].map((match) => plainText(match[1]));
  const binding = bindingMatches.find((value) => /pages?/i.test(value)) || "";
  const coverMatch = row.match(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/i);
  const sourceUrl = absoluteUrl(titleMatch[1], CHASSE_ORIGIN);

  return {
    source: "Chasse aux Livres",
    sourceId: sourceUrl,
    sourceUrl,
    isbn,
    title: plainText(titleMatch[2]),
    authors: authorMatch ? [normalizeAuthor(authorMatch[1])].filter(Boolean) : [],
    publisher: plainText(publisherMatch?.[1]),
    publishedDate: editorText.match(/(?:-|–)\s*(\d{4}(?:-\d{2}-\d{2})?)/)?.[1] || "",
    edition: editorText.match(/\(([^)]+)\)/)?.[1] || "",
    format: binding.split(",")[0]?.trim() || "Livre",
    totalPages: Math.max(0, Number(binding.match(/([\d\s]+)\s*pages?/i)?.[1]?.replace(/\s/g, "")) || 0),
    description: "",
    descriptionSource: "",
    genre: "",
    genres: [],
    coverUrl: absoluteUrl(coverMatch?.[1], CHASSE_ORIGIN),
  };
}

async function lookupChasseAuxLivres(isbn: string) {
  const searchUrl = `${CHASSE_ORIGIN}/search?query=${encodeURIComponent(isbn)}&catalog=fr`;
  const initial = await fetchText(searchUrl, { Referer: CHASSE_ORIGIN });
  const hash = initial.text.match(/id=["']hash-cont["'][^>]*data-hash=["']([^"']+)["']/i)?.[1]
    || initial.text.match(/data-hash=["']([^"']+)["'][^>]*id=["']hash-cont["']/i)?.[1];
  if (!hash) return null;

  const endpoint = `${CHASSE_ORIGIN}/rest/search-results?h=${encodeURIComponent(hash)}&p=1&l=1&duih=&b=d`;
  const cookie = firstCookie(initial.response);
  const result = await fetchText(endpoint, {
    Referer: searchUrl,
    "X-Requested-With": "XMLHttpRequest",
    ...(cookie ? { Cookie: cookie } : {}),
  });
  const payload = JSON.parse(result.text);
  return parseChasse(String(payload?.d || payload?.m || ""), isbn);
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return jsonResponse(request, { error: "Méthode non autorisée." }, 405);

  let body: { isbn?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Corps JSON invalide." }, 400);
  }

  const isbn = normalizeISBN(body?.isbn);
  if (!isValidISBN(isbn)) return jsonResponse(request, { error: "ISBN-10 ou ISBN-13 invalide." }, 400);

  const failures: string[] = [];
  try {
    const niceBooks = await lookupNiceBooks(isbn);
    if (niceBooks?.title) return jsonResponse(request, { books: [niceBooks], source: niceBooks.source });
  } catch (error) {
    failures.push(`NiceBooks: ${error instanceof Error ? error.message : "erreur inconnue"}`);
  }

  try {
    const chasse = await lookupChasseAuxLivres(isbn);
    if (chasse?.title) return jsonResponse(request, { books: [chasse], source: chasse.source });
  } catch (error) {
    failures.push(`Chasse aux Livres: ${error instanceof Error ? error.message : "erreur inconnue"}`);
  }

  if (failures.length === 2) {
    console.warn("ISBN fallback sources unavailable", failures.join(" | "));
    return jsonResponse(request, { error: "Les catalogues de secours sont momentanément indisponibles." }, 502);
  }
  return jsonResponse(request, { books: [], source: null });
});
