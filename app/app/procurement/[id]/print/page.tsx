// app/procurement/[id]/print/page.tsx
import ProcurementPrintPage from "../../../../modules/procurement/print";

export async function generateStaticParams() {
    // Fetch all procurement records to get their IDs
    const res = await fetch("http://100.126.246.124:8060/items/procurement");
    const data = await res.json();

    return data.data.map((item: { id: string | number }) => ({
        id: item.id.toString(),
    }));
}

// Pass the static id to your client component
export default function Page({ params }: { params: { id: string } }) {
    return <ProcurementPrintPage id={params.id} />;
}
