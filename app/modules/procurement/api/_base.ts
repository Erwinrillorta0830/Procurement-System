// modules/procurement/api/_base.ts

const API_BASE = "/api/items";

export const ITEMS = API_BASE;

// --- Time helpers (Manila) --------------------------------------------------
export function nowISOManila(): string {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc + 8 * 3600 * 1000).toISOString();
}

export function todayManila(): string {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const date = new Date(utc + 8 * 3600 * 1000);
    const pad = (value: number): string => String(value).padStart(2, "0");

    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
        date.getUTCDate()
    )}`;
}

// --- URL helper -------------------------------------------------------------
const isAbsoluteUrl = (url: string): boolean => /^https?:\/\//i.test(url);

function normalizeApiPath(path: string): string {
    const trimmed = String(path ?? "").trim();

    if (!trimmed) return API_BASE;

    if (isAbsoluteUrl(trimmed)) return trimmed;

    // already correct
    if (trimmed.startsWith("/api/items/") || trimmed === "/api/items") {
        return trimmed;
    }

    // caller passed "api/items/..."
    if (trimmed.startsWith("api/items/")) {
        return `/${trimmed}`;
    }

    // caller passed "/items/..."
    if (trimmed.startsWith("/items/")) {
        return `${API_BASE}${trimmed.slice("/items".length)}`;
    }

    // caller passed "items/..."
    if (trimmed.startsWith("items/")) {
        return `${API_BASE}/${trimmed.slice("items/".length)}`;
    }

    // caller passed "/procurement"
    if (trimmed.startsWith("/")) {
        return `${API_BASE}${trimmed}`;
    }

    // caller passed "procurement"
    return `${API_BASE}/${trimmed}`;
}

// --- Fetch wrapper ----------------------------------------------------------
export async function api<T>(
    path: string,
    init: RequestInit = {}
): Promise<T> {
    const url = normalizeApiPath(path);

    const headers = new Headers(init.headers);

    const hasBody =
        init.body !== undefined &&
        init.body !== null &&
        !(init.body instanceof FormData);

    if (hasBody && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    try {
        const res = await fetch(url, {
            ...init,
            headers,
            cache: "no-store",
        });

        const contentType = res.headers.get("content-type") ?? "";
        const isJson = contentType.includes("application/json");

        if (!res.ok) {
            const errorText = isJson
                ? JSON.stringify(await res.json().catch(() => null))
                : await res.text().catch(() => "");

            throw new Error(
                `API ${res.status} for ${url}: ${errorText || res.statusText}`
            );
        }

        if (!isJson) {
            return null as T;
        }

        return (await res.json()) as T;
    } catch (error: unknown) {
        console.error("API fetch error:", url, error);
        throw error;
    }
}