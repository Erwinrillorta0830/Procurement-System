import { api, ITEMS, nowISOManila, todayManila } from './_base';
import type { ProcurementMaster, ProcurementRequestRow, ProcurementDetail } from '../provider/ProcurementProvider';

// Creates a Purchase Order from an approved procurement
export async function generatePurchaseOrder(args: { procurement_no: string; supplier_id: number }) {
    const { procurement_no, supplier_id } = args;

    // Guard: must be approved
    const masters = await api<{ data: ProcurementMaster[] }>(
        `${ITEMS}/procurement?filter=${encodeURIComponent(
            JSON.stringify({ procurement_no: { _eq: procurement_no }, isApproved: { _eq: 1 } })
        )}&limit=1`
    );
    const master = masters.data[0];
    if (!master) throw new Error('Procurement must be Approved before generating a PO.');

    // Gather details (quotation chosen supplier lines) & request rows for amount fallback
    const details = await api<{ data: ProcurementDetail[] }>(
        `${ITEMS}/procurement_details?filter=${encodeURIComponent(
            JSON.stringify({ procurement_no: { _eq: procurement_no }, supplier: { _eq: supplier_id } })
        )}&limit=500`
    );
    const requests = await api<{ data: ProcurementRequestRow[] }>(
        `${ITEMS}/procurement_request?filter=${encodeURIComponent(
            JSON.stringify({ procurement_no: { _eq: procurement_no } })
        )}&limit=500`
    );

    const lineTotal =
        details.data.length > 0
            ? details.data.reduce((a, b) => a + Number(b.total_amount ?? 0), 0)
            : requests.data.reduce((a, b) => a + Number(b.estimated_total ?? 0), 0);

    // 1) Create Purchase Order
    const poRes = await api<{ data: { purchase_order_id: number } }>(`${ITEMS}/purchase_order`, {
        method: 'POST',
        body: JSON.stringify({
            date: todayManila(),
            date_encoded: nowISOManila(),
            supplier_id,
            total_amount: lineTotal,
            procurement_no,
            status: 'Open',
        }),
    });

    const po_id = poRes.data.purchase_order_id;

    // 2) Link master to PO
    await api(`${ITEMS}/procurement`, {
        method: 'PATCH',
        body: JSON.stringify({
            filter: { procurement_no: { _eq: procurement_no } },
            data: { po_no: po_id },
        }),
    });

    return { po_id };
}
