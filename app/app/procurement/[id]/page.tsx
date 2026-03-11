import ProcurementDetailsPage from "../../../modules/procurement/details";

type ProcurementIdRow = {
    id: number | string;
};

type DirectusListResponse<T> = {
    data?: T[];
};

const DIRECTUS_BASE_URL =
    process.env.DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_DIRECTUS_URL ||
    "";

export async function generateStaticParams(): Promise<Array<{ id: string }>> {
    if (!DIRECTUS_BASE_URL) {
        console.error("DIRECTUS_URL or NEXT_PUBLIC_DIRECTUS_URL is not configured.");
        return [];
    }

    try {
        const res = await fetch(
            `${DIRECTUS_BASE_URL.replace(/\/+$/, "")}/items/procurement?fields=id&limit=-1`,
            {
                cache: "no-store",
            }
        );

        if (!res.ok) {
            throw new Error(`Failed to fetch procurement ids: ${res.status}`);
        }

        const json: DirectusListResponse<ProcurementIdRow> = await res.json();
        const items = Array.isArray(json.data) ? json.data : [];

        return items
            .filter(
                (item): item is ProcurementIdRow =>
                    item !== null &&
                    item !== undefined &&
                    (typeof item.id === "number" || typeof item.id === "string")
            )
            .map((item) => ({
                id: String(item.id),
            }));
    } catch (error: unknown) {
        console.error(
            "Failed to fetch procurement IDs for static generation:",
            error
        );
        return [];
    }
}

export default function Page() {
    return <ProcurementDetailsPage />;
}