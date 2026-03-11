import ProcurementPrintPage from "../../../../modules/procurement/print";

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
        const response = await fetch(
            `${DIRECTUS_BASE_URL.replace(/\/+$/, "")}/items/procurement?fields=id&limit=-1`,
            {
                cache: "no-store",
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch procurement ids: ${response.status}`);
        }

        const json = (await response.json()) as DirectusListResponse<ProcurementIdRow>;
        const rows = Array.isArray(json.data) ? json.data : [];

        return rows
            .filter(
                (row): row is ProcurementIdRow =>
                    row !== null &&
                    row !== undefined &&
                    (typeof row.id === "number" || typeof row.id === "string")
            )
            .map((row) => ({
                id: String(row.id),
            }));
    } catch (error: unknown) {
        console.error("Failed to fetch procurement IDs for print static params:", error);
        return [];
    }
}

export default async function Page({
                                       params,
                                   }: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return <ProcurementPrintPage id={id} />;
}