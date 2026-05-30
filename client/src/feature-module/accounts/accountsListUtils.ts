/**
 * Resolves accounts attachment file_path to an absolute backend URL (split SPA/API safe).
 * @param apiBaseUrl — from getApiBaseUrl() (e.g. https://…onrender.com/api)
 */
export function resolveAccountsStorageFileUrl(
  filePath: string | null | undefined,
  apiBaseUrl: string
): string {
  if (!filePath) return "";
  const raw = String(filePath).trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = apiBaseUrl.replace(/\/+$/, "");
  let origin = "";
  try {
    origin = new URL(base, typeof window !== "undefined" ? window.location.origin : "https://placeholder.invalid").origin;
  } catch {
    origin = base.replace(/\/api\/?$/i, "");
  }

  let p = raw;
  if (p.startsWith("school_")) {
    p = `/api/storage/files/${p}`;
  } else if (p.startsWith("/storage/files/")) {
    p = `/api${p}`;
  } else if (p.startsWith("storage/files/")) {
    p = `/api/${p}`;
  } else if (!p.startsWith("/api/")) {
    p = `/api/storage/files/${p}`;
  }
  if (!p.startsWith("/")) p = `/${p}`;
  return `${origin}${p}`;
}

/** Normalizes paginated GET /api/accounts/* responses. */
export function parseAccountsListResponse(res: unknown): {
  data: any[];
  total: number;
  page: number;
  pageSize: number;
} {
  const r = res as Record<string, unknown> | null;
  const data = Array.isArray(r?.data) ? r!.data : [];
  const total = typeof r?.total === "number" ? r!.total : data.length;
  const page = typeof r?.page === "number" ? r!.page : 1;
  const pageSize = typeof r?.pageSize === "number" ? r!.pageSize : 10;
  return { data, total, page, pageSize };
}

/** Fetches all pages (for export) using the same filters; respects server page_size max (100). */
export async function fetchAllAccountsPages<T>(
  fetchPage: (args: { page: number; page_size: number }) => Promise<unknown>,
  pageSize = 100,
  maxPages = 50
): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  let total = Infinity;
  while (out.length < total && page <= maxPages) {
    const res = await fetchPage({ page, page_size: pageSize });
    const { data, total: t } = parseAccountsListResponse(res);
    total = t;
    out.push(...(data as T[]));
    if (!data.length || out.length >= total) break;
    page++;
  }
  return out;
}
