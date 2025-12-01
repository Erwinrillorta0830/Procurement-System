export type ProcParam = { id: string };
export const dynamicParams = false;

export async function generateStaticParams(): Promise<ProcParam[]> {
    const fallbackId = process.env.PROCUREMENT_DEFAULT_ID || "1109";
    const base = process.env.NEXT_PUBLIC_DIRECTUS_URL;
    if (!base) return [{ id: fallbackId }];

    const token = process.env.DIRECTUS_TOKEN;

    try {
        const res = await fetch(
            `${base}/items/procurement?fields=procurement_id&limit=-1`,
            { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
        );
        if (!res.ok) return [{ id: fallbackId }];

        const json = await res.json();
        const rows = (json?.data ?? []) as Array<{ procurement_id: number }>;
        const list = rows.map(r => ({ id: String(r.procurement_id) }));
        return list.length ? list : [{ id: fallbackId }];
    } catch {
        return [{ id: fallbackId }];
    }
}
