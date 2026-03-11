import PODetailsPage from "../../../../modules/procurement/po/details";

export const dynamicParams = false;

type Params = { id: string };

type PurchaseOrderIdRow = {
    purchase_order_id: number | string;
};

type DirectusListResponse<T> = {
    data?: T[];
};

function fallbackParams(): Params[] {
    const csv = (process.env.PURCHASE_ORDER_IDS_CSV || "").trim();

    const list = csv
        ? csv
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        : [process.env.PO_DEFAULT_ID || "1"];

    return list.map((id) => ({ id }));
}

export async function generateStaticParams(): Promise<Params[]> {
    const baseUrl =
        process.env.DIRECTUS_URL ||
        process.env.NEXT_PUBLIC_DIRECTUS_URL ||
        "";

    const token =
        process.env.DIRECTUS_STATIC_TOKEN ||
        process.env.DIRECTUS_TOKEN ||
        "";

    if (!baseUrl) {
        return fallbackParams();
    }

    const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

    try {
        const response = await fetch(
            `${normalizedBaseUrl}/items/purchase_order?fields=purchase_order_id&limit=-1`,
            {
                headers: token
                    ? {
                        Authorization: `Bearer ${token}`,
                    }
                    : undefined,
                cache: "no-store",
            }
        );

        if (!response.ok) {
            return fallbackParams();
        }

        const json = (await response.json()) as DirectusListResponse<PurchaseOrderIdRow>;
        const rows = Array.isArray(json.data) ? json.data : [];

        if (rows.length === 0) {
            return fallbackParams();
        }

        return rows
            .filter(
                (row): row is PurchaseOrderIdRow =>
                    row !== null &&
                    row !== undefined &&
                    (typeof row.purchase_order_id === "number" ||
                        typeof row.purchase_order_id === "string")
            )
            .map((row) => ({
                id: String(row.purchase_order_id),
            }));
    } catch {
        return fallbackParams();
    }
}

export default function Page() {
    return <PODetailsPage />;
}