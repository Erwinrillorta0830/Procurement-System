import { api, ITEMS } from './_base';
import type { ProcurementMaster, ProcurementRequestRow, ProcurementDetail } from '../provider/ProcurementProvider';

// LIST (flat)
export async function fetchProcurementList({ search = '' }: { search?: string }) {
    const params = new URLSearchParams();
    if (search) {
        // Search in item_description or procurement_no
        params.set(
            'filter',
            JSON.stringify({
                _or: [
                    { item_description: { _contains: search } },
                    { procurement_no: { _contains: search } },
                ],
            })
        );
    }
    params.set('limit', '200');
    params.set('sort', '-created_at');

    const url = `${ITEMS}/procurement_request?${params.toString()}`;
    const json = await api<{ data: ProcurementRequestRow[] }>(url);
    return json.data;
}

// GROUPS by procurement_no
export async function fetchProcurementGrouped({ search = '' }: { search?: string }) {
    const list = await fetchProcurementList({ search });
    const grouped = new Map<
        string,
        { procurement_no: string; total_items: number; total_estimate: number }
    >();
    for (const r of list) {
        const g = grouped.get(r.procurement_no) || {
            procurement_no: r.procurement_no,
            total_items: 0,
            total_estimate: 0,
        };
        g.total_items += 1;
        g.total_estimate += Number(r.estimated_total || r.estimated_cost * r.quantity || 0);
        grouped.set(r.procurement_no, g);
    }
    return Array.from(grouped.values()).sort((a, b) => a.procurement_no.localeCompare(b.procurement_no));
}

// MASTER by procurement_no
export async function fetchProcurementByNo(no: string) {
    const params = new URLSearchParams();
    params.set('filter', JSON.stringify({ procurement_no: { _eq: no } }));
    params.set('limit', '1');

    const url = `${ITEMS}/procurement?${params.toString()}`;
    const json = await api<{ data: ProcurementMaster[] }>(url);
    return json.data[0] ?? null;
}

// DETAILS by procurement_no (from procurement_details)
export async function fetchDetailsByProcurementNo(no: string) {
    const params = new URLSearchParams();
    params.set('filter', JSON.stringify({ procurement_no: { _eq: no } }));
    params.set('sort', '-created_date');

    const url = `${ITEMS}/procurement_details?${params.toString()}`;
    const json = await api<{ data: ProcurementDetail[] }>(url);
    return json.data ?? [];
}
