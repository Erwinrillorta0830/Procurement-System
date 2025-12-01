// modules/procurement/api/_base.ts

// --- Base URL ---------------------------------------------------------------
const DIRECTUS_BASE =
    (typeof window !== "undefined" && (window as any).__NEXT_PUBLIC_DIRECTUS_URL__) ||
    process.env.NEXT_PUBLIC_DIRECTUS_URL ||
    "http://100.126.246.124:8060";

export const ITEMS = `${DIRECTUS_BASE.replace(/\/+$/, "")}/items`;

// --- Time helpers (Manila) --------------------------------------------------
export function nowISOManila(): string {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc + 8 * 3600 * 1000).toISOString();
}

export function todayManila(): string {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const d = new Date(utc + 8 * 3600 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// --- Auth helpers -----------------------------------------------------------
const isBrowser = typeof window !== "undefined";

// 🔹 Static frontend token fallback (service user / fixed role)
const STATIC_TOKEN: string | null = process.env.NEXT_PUBLIC_DIRECTUS_TOKEN ?? null;

function getCookie(name: string): string | null {
    if (!isBrowser || !document?.cookie) return null;
    const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : null;
}

function getToken(): string | null {
    // 1) Browser: try localStorage and cookies first
    if (isBrowser) {
        try {
            const raw = localStorage.getItem("user");
            if (raw) {
                const u = JSON.parse(raw);
                // adapt these keys to your login payload
                if (u?.access_token) return u.access_token;
                if (u?.token) return u.token;
                if (u?.authToken) return u.authToken;
            }
        } catch {
            // ignore JSON / storage errors
        }

        const cookieKeys = ["directus_access_token", "access_token", "auth_token"];
        for (const k of cookieKeys) {
            const v = getCookie(k);
            if (v) return v;
        }
    }

    // 2) Fallback: use static Directus token (service user / fixed role)
    if (STATIC_TOKEN) return STATIC_TOKEN;

    return null;
}

// --- URL helper -------------------------------------------------------------
const isAbsoluteUrl = (url: string) => /^https?:\/\//i.test(url);

function buildUrl(path: string): string {
    if (isAbsoluteUrl(path)) return path;

    const base = DIRECTUS_BASE.replace(/\/+$/, "");
    const p = path.replace(/^\/+/, "");
    return `${base}/${p}`;
}

// --- Fetch wrapper (adds Authorization when available) ----------------------
export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
    const token = getToken();
    const url = buildUrl(path);

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(init.headers as any),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    try {
        const res = await fetch(url, {
            ...init,
            headers,
            // ❌ do NOT send credentials for cross-origin with CORS_ORIGIN="*"
            // credentials: "include",
            cache: "no-store",
        });

        if (!res.ok) {
            const text = await res.text().catch(() => "");
            if (res.status === 401 || res.status === 403) {
                // log full context for debugging
                console.error("AUTH_FORBIDDEN:", res.status, url, text);
                throw new Error("AUTH_FORBIDDEN");
            }
            throw new Error(`API ${res.status} for ${url}: ${text || res.statusText}`);
        }

        return (await res.json()) as T;
    } catch (err) {
        console.error("API fetch error:", url, err);
        throw err;
    }
}
