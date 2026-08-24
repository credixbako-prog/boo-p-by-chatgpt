import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const NICEBOOKS_ORIGIN = "https://nicebooks.com";
const CHASSE_ORIGIN = "https://www.chasse-aux-livres.fr";
const PRODUCTION_ORIGIN = "https://credixbako-prog.github.io";
const FETCH_TIMEOUT_MS = 5_500;
const MAX_HTML_LENGTH = 1_500_000;
const SOURCE_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [0, 180, 520];
const CACHE_TTL_MS = 6 * 60 * 60 * 1_000;
const MAX_CACHE_ENTRIES = 250;

type BookMetadata = {
  source: string;
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

type SourceResult = {
  book: BookMetadata | null;
  attempts: number;
  errors: string[];
};

const metadataCache = new Map<string, { book: BookMetadata; expiresAt: number }>();

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

function isbn10To13(value: string) {
  const isbn10 = normalizeISBN(value);
  if (!isValidISBN10(isbn10)) return "";
  const core = `978${isbn10.slice(0, 9)}`;
  const sum = [...core].reduce(
    (total, character, index) => total + Number(character) * (index % 2 ? 3 : 1),
    0,
  );
  return `${core}${(10 - (sum % 10)) % 10}`;
}

function isbn13To10(value: string) {
  const isbn13 = normalizeISBN(value);
  if (!isValidISBN13(isbn13) || !isbn13.startsWith("978")) return "";
  const core = isbn13.slice(3, 12);
  const sum = [...core].reduce(
    (total, character, index) => total + Number(character) * (10 - index),
    0,
  );
  const check = (11 - (sum % 11)) % 11;
  return `${core}${check === 10 ? "X" : check}`;
}

function isbnVariants(value: string) {
  const isbn = normalizeISBN(value);
  const converted = isbn.length === 10 ? isbn10To13(isbn) : isbn13To10(isbn);
  return [...new Set([isbn, converted].filter(isValidISBN))];
}

function cacheBook(book: BookMetadata) {
  const entry = { book, expiresAt: Date.now() + CACHE_TTL_MS };
  for (const variant of isbnVariants(book.isbn)) metadataCache.set(variant, entry);
  while (metadataCache.size > MAX_CACHE_ENTRIES) {
    const oldest = metadataCache.keys().next().value;
    if (!oldest) break;
    metadataCache.delete(oldest);
  }
}

function cachedBook(isbn: string) {
  for (const variant of isbnVariants(isbn)) {
    const entry = metadataCache.get(variant);
    if (!entry) continue;
    if (entry.expiresAt > Date.now()) return entry.book;
    metadataCache.delete(variant);
  }
  return null;
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

function sourceUrl(value: unknown, origin: string) {
  const url = absoluteUrl(value, origin);
  if (!url) return "";
  try {
    return new URL(url).origin === new URL(origin).origin ? url : "";
  } catch {
    return "";
  }
}

function containsISBN(value: string, isbn: string) {
  const compact = String(value || "").toUpperCase().replace(/[^0-9X]/g, "");
  return isbnVariants(isbn).some((candidate) => compact.includes(candidate));
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
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        ...extraHeaders,
      },
    });
    if (!response.ok) throw new Error(`Source distante indisponible (${response.status})`);
    const text = await response.text();
    if (text.length > MAX_HTML_LENGTH) throw new Error("Réponse distante trop volumineuse");
    return { text, response };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Source distante trop lente après ${FETCH_TIMEOUT_MS} ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function parseNiceBooks(html: string, isbn: string): BookMetadata | null {
  const start = html.search(/<div\b[^>]*class=["'][^"']*search-result-line[^"']*["']/i);
  if (start < 0) return null;
  const end = html.indexOf("<script", start);
  const block = html.slice(start, end > start ? end : Math.min(html.length, start + 40_000));
  // NiceBooks affiche l'ISBN dans le contexte de la page, pas dans le bloc
  // `search-result-line` lui-même. Valider la page entière évite d'écarter un
  // résultat exact tout en refusant une page qui ne correspond pas à la requête.
  if (!containsISBN(html, isbn)) return null;
  const titleMatch = block.match(/<a\b[^>]*href=["']([^"']*\/fr\/book\/[^"']+)["'][^>]*class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)
    || block.match(/<a\b[^>]*class=["'][^"']*title[^"']*["'][^>]*href=["']([^"']*\/fr\/book\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
  if (!titleMatch) return null;

  const authorMatch = block.match(/<a\b[^>]*href=["'][^"']*q=author[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
  const publisherMatch = block.match(/<a\b[^>]*href=["'][^"']*q=publisher[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
  const coverMatch = block.match(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/i);
  const detailsMatch = block.match(/<div[^>]*>\s*([^<]*?),\s*<em>([\s\S]*?)<\/em>,\s*([\d\s]+)\s*pages?\s*<\/div>/i);
  const sourceLink = sourceUrl(titleMatch[1], NICEBOOKS_ORIGIN);
  const title = plainText(titleMatch[2]);
  if (!sourceLink || !title || title.length > 500) return null;

  return {
    source: "NiceBooks",
    sourceId: sourceLink,
    sourceUrl: sourceLink,
    isbn,
    title,
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

async function lookupNiceBooks(isbn: string, attempt = 0) {
  const retry = attempt ? `&_boop_retry=${attempt}-${Date.now()}` : "";
  const lookupUrl = `${NICEBOOKS_ORIGIN}/fr/search/isbn?isbn=${encodeURIComponent(isbn)}${retry}`;
  const { text } = await fetchText(lookupUrl, { Referer: `${NICEBOOKS_ORIGIN}/fr/search/isbn` });
  return parseNiceBooks(text, isbn);
}

function firstCookie(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() || [response.headers.get("set-cookie") || ""];
  return values.map((value) => value.split(";")[0].trim()).filter(Boolean).join("; ");
}

function parseChasse(html: string, isbn: string): BookMetadata | null {
  const rows = [...html.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
  const row = rows.find((candidate) => containsISBN(candidate, isbn)) || "";
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
  const sourceLink = sourceUrl(titleMatch[1], CHASSE_ORIGIN);
  const title = plainText(titleMatch[2]);
  if (!sourceLink || !title || title.length > 500) return null;

  return {
    source: "Chasse aux Livres",
    sourceId: sourceLink,
    sourceUrl: sourceLink,
    isbn,
    title,
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

async function lookupChasseAuxLivres(isbn: string, attempt = 0) {
  const retry = attempt ? `&_boop_retry=${attempt}-${Date.now()}` : "";
  const searchUrl = `${CHASSE_ORIGIN}/search?query=${encodeURIComponent(isbn)}&catalog=fr${retry}`;
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

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function attemptISBNs(isbn: string) {
  const variants = isbnVariants(isbn);
  const alternate = variants.find((variant) => variant !== isbn) || isbn;
  return [isbn, isbn, alternate].slice(0, SOURCE_ATTEMPTS);
}

async function lookupWithRetries(
  source: string,
  isbn: string,
  lookup: (candidate: string, attempt: number) => Promise<BookMetadata | null>,
): Promise<SourceResult> {
  const candidates = attemptISBNs(isbn);
  const errors: string[] = [];
  for (const [attempt, candidate] of candidates.entries()) {
    if (RETRY_DELAYS_MS[attempt]) await delay(RETRY_DELAYS_MS[attempt]);
    try {
      const book = await lookup(candidate, attempt);
      if (book?.title) return { book: { ...book, isbn }, attempts: attempt + 1, errors };
      errors.push(`${source} tentative ${attempt + 1}: aucun résultat exploitable`);
    } catch (error) {
      errors.push(`${source} tentative ${attempt + 1}: ${error instanceof Error ? error.message : "erreur inconnue"}`);
    }
  }
  return { book: null, attempts: candidates.length, errors };
}

function completeness(book: BookMetadata) {
  return [book.title, book.authors.length, book.publisher, book.publishedDate, book.totalPages, book.coverUrl]
    .filter(Boolean).length;
}

function mergePartnerBooks(books: BookMetadata[], isbn: string) {
  if (!books.length) return null;
  const ranked = [...books].sort((left, right) => completeness(right) - completeness(left));
  const merged = ranked.slice(1).reduce((current, incoming) => ({
    ...incoming,
    ...current,
    sourceId: current.sourceId || incoming.sourceId,
    sourceUrl: current.sourceUrl || incoming.sourceUrl,
    isbn,
    title: current.title || incoming.title,
    authors: current.authors.length ? current.authors : incoming.authors,
    publisher: current.publisher || incoming.publisher,
    publishedDate: current.publishedDate || incoming.publishedDate,
    edition: current.edition || incoming.edition,
    format: current.format || incoming.format,
    totalPages: current.totalPages || incoming.totalPages,
    description: current.description || incoming.description,
    descriptionSource: current.descriptionSource || incoming.descriptionSource,
    genre: current.genre || incoming.genre,
    genres: current.genres.length ? current.genres : incoming.genres,
    coverUrl: current.coverUrl || incoming.coverUrl,
  }), { ...ranked[0], isbn });
  merged.source = [...new Set(books.map((book) => book.source).filter(Boolean))].join(" + ");
  return merged;
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

  const startedAt = Date.now();
  const cached = cachedBook(isbn);
  if (cached) {
    console.info("isbn-fallback", JSON.stringify({ isbn, cache: "hit", source: cached.source, elapsedMs: Date.now() - startedAt }));
    return jsonResponse(request, { books: [cached], source: cached.source, sources: cached.source.split(" + "), cached: true });
  }

  const [niceBooks, chasse] = await Promise.all([
    lookupWithRetries("NiceBooks", isbn, lookupNiceBooks),
    lookupWithRetries("Chasse aux Livres", isbn, lookupChasseAuxLivres),
  ]);
  const merged = mergePartnerBooks([niceBooks.book, chasse.book].filter((book): book is BookMetadata => Boolean(book)), isbn);
  const attempts = { niceBooks: niceBooks.attempts, chasseAuxLivres: chasse.attempts };

  if (merged) {
    cacheBook(merged);
    console.info("isbn-fallback", JSON.stringify({
      isbn, cache: "miss", source: merged.source, attempts, elapsedMs: Date.now() - startedAt,
    }));
    return jsonResponse(request, {
      books: [merged], source: merged.source, sources: merged.source.split(" + "), attempts, cached: false,
    });
  }

  const failures = [...niceBooks.errors, ...chasse.errors];
  console.warn("isbn-fallback", JSON.stringify({
    isbn, cache: "miss", source: null, attempts, elapsedMs: Date.now() - startedAt, failures,
  }));
  return jsonResponse(request, { books: [], source: null, sources: [], attempts, retried: true });
});
