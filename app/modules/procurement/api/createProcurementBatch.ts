import { api, ITEMS, nowISOManila, todayManila } from './_base';
import type { ProcurementMaster, ProcurementRequestRow } from '../provider/ProcurementProvider';

// Ensure a master exists for the group (procurement_no)
async function ensureMaster(procurement_no: string, opts?: { lead_date?: string | null }) {
    const url = `${ITEMS}/procurement?filter=${encodeURIComponent(
        JSON.stringify({ procurement_no: { _eq: procurement_no } })
    )}&limit=1`;
    const found = await api<{ data: ProcurementMaster[] }>(url);
    if (found.data[0]) return found.data[0];

    const res = await api<{ data: ProcurementMaster }>(`${ITEMS}/procurement`, {
        method: 'POST',
        body: JSON.stringify({
            procurement_no,
            lead_date: opts?.lead_date ?? todayManila(),
            amount: 0,
            date_created: nowISOManila(),
            encoder_id: null,
            department: null,
            po_no: null,
            isApproved: 0,
            transaction_type: null,
        }),
    });
    return res.data;
}

export type CreateProcurementItemInput = {
    // from the UI
    item_tmpl_id?: number | null;
    item_variant_id?: number | null;
    item_name: string;         // resolved name (template or variant)
    item_description?: string | null;
    uom?: string | null;
    quantity: number;
    list_price: number;        // unit price
};

export async function createProcurementBatch(args: {
    procurement_no?: string;
    lead_date?: string | null; // YYYY-MM-DD
    items: CreateProcurementItemInput[];
}) {
    const procurement_no =
        args.procurement_no ||
        `PR-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`;

    await ensureMaster(procurement_no, { lead_date: args.lead_date });

    // Build rows for procurement_request
    const rows = args.items.map((it) => {
        const estimated_total = Number(it.quantity) * Number(it.list_price);
        const row: Partial<ProcurementRequestRow> = {
            procurement_no,
            item_description: it.item_description ?? it.item_name,
            quantity: it.quantity,
            estimated_cost: it.list_price,
            estimated_total,
            purpose_text: null,
            status: 'Submitted',
            created_at: nowISOManila(),
            updated_at: nowISOManila(),
        };
        return row;
    });

    // Insert rows in bulk (Directus supports POST /items/collection with array)
    await api(`${ITEMS}/procurement_request`, {
        method: 'POST',
        body: JSON.stringify(rows),
    });

    // Recalculate master amount
    const items = await api<{ data: ProcurementRequestRow[] }>(
        `${ITEMS}/procurement_request?filter=${encodeURIComponent(
            JSON.stringify({ procurement_no: { _eq: procurement_no } })
        )}&limit=500`
    );
    const sum = items.data.reduce((a, b) => a + Number(b.estimated_total ?? 0), 0);
    await api(`${ITEMS}/procurement`, {
        method: 'PATCH',
        body: JSON.stringify({
            filter: { procurement_no: { _eq: procurement_no } },
            data: { amount: sum },
        }),
    });

    return { procurement_no };
}
