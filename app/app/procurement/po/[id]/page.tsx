// app/procurement/po/[id]/page.tsx
import PODetailsPage from "../../../../modules/procurement/po/details";

// Only allow params we pre-generated (required for `output: 'export'`)
export const dynamicParams = false;

type Params = { id: string };

/** Fallback list when Directus is unreachable during build. */
function fallbackParams(): Params[] {
    // Optional: provide a CSV of ids at build time
    const csv = (process.env.PURCHASE_ORDER_IDS_CSV || "").trim();
    const list = csv
        ? csv.split(",").map(s => s.trim()).filter(Boolean)
        : [process.env.PO_DEFAULT_ID || "1"]; // at least one id so build won’t fail

    return list.map(id => ({ id }));
}

/** Build-time enumeration of PO ids to statically export. */
export async function generateStaticParams(): Promise<Params[]> {
    const base = process.env.NEXT_PUBLIC_DIRECTUS_URL || process.env.DIRECTUS_URL;
    const token = process.env.DIRECTUS_TOKEN || "";

    if (!base) return fallbackParams();

    try {
        const res = await fetch(
            `${base}/items/purchase_order?fields=purchase_order_id&limit=-1`,
            {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                // Build-time fetch; no caching needed for export
                cache: "no-store",
            }
        );

        if (!res.ok) return fallbackParams();

        const json = await res.json();
        const rows = (json?.data ?? []) as Array<{ purchase_order_id: number }>;

        if (!rows.length) return fallbackParams();

        return rows.map(r => ({ id: String(r.purchase_order_id) }));
    } catch {
        return fallbackParams();
    }
}

// You can keep this simple; the client child uses `useParams()`
export default function Page() {
    return <PODetailsPage />;
}
