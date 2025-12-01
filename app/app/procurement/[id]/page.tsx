// app/procurement/[id]/page.tsx
import ProcurementDetailsPage from "../../../modules/procurement/details";

// ✅ This function tells Next.js which [id] pages to generate
export async function generateStaticParams() {
    try {
        const res = await fetch("http://100.126.246.124:8060/items/procurement");
        const json = await res.json();

        // Assuming the Directus API returns something like { data: [{ id: 1 }, { id: 2 }, ...] }
        const items = json.data || [];

        return items.map((item: any) => ({
            id: item.id.toString(),
        }));
    } catch (error) {
        console.error("❌ Failed to fetch procurement IDs for static generation:", error);
        return []; // Fallback to no pages if fetch fails
    }
}

// ✅ Default page component (keep this)
export default function Page() {
    return <ProcurementDetailsPage />;
}
