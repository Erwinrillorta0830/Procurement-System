import { api, ITEMS, nowISOManila, todayManila } from './_base';
import type { ProcurementRequestRow, ProcurementMaster } from '../provider/ProcurementProvider';

// Helper: create or reuse a procurement master by procurement_no
async function ensureMaster(procurement_no: string, opts?: { lead_date?: string | null }) {
    // Check exists
    const url = `${ITEMS}/procurement?filter=${encodeURIComponent(JSON.stringify({
        procurement_no: { _eq: procurement_no }
    }))}&limit=1`;

    const found = await api<{ data: ProcurementMaster[] }>(url);
    if (found.data[0]) return found.data[0];

    // Create master
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

export async function createProcurementRequest(payload: {
    procurement_no?: string;          // if missing, generate
    item_description: string;
    quantity: number;
    estimated_cost: number;
    requestor_user_id?: number | null;
    department_id?: number | null;
    transaction_type_id?: number | null;
    purpose_text?: string | null;
    status?: ProcurementRequestRow['status']; // default Submitted
    lead_date?: string | null;                // for master bootstrap
}) {
    const procurement_no =
        payload.procurement_no ||
        `PR-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`;

    // Ensure master exists
    await ensureMaster(procurement_no, { lead_date: payload.lead_date });

    const estimated_total = Number(payload.estimated_cost) * Number(payload.quantity);

    const res = await api<{ data: ProcurementRequestRow }>(`${ITEMS}/procurement_request`, {
        method: 'POST',
        body: JSON.stringify({
            procurement_no,
            item_description: payload.item_description,
            quantity: payload.quantity,
            estimated_cost: payload.estimated_cost,
            estimated_total,
            requestor_user_id: payload.requestor_user_id ?? null,
            department_id: payload.department_id ?? null,
            transaction_type_id: payload.transaction_type_id ?? null,
            purpose_text: payload.purpose_text ?? null,
            status: payload.status ?? 'Submitted',
            created_at: nowISOManila(),
            updated_at: nowISOManila(),
        }),
    });

    // Update master amount (sum of all estimated_total)
    try {
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
    } catch { /* ignore */ }

    return { procurement_no, pr_id: res.data.pr_id };
}
