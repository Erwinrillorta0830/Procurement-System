import { api, ITEMS, nowISOManila } from './_base';
import type { ProcurementRequestRow } from '../provider/ProcurementProvider';

// Approve: set all request rows to Approved & master.isApproved=1
export async function approveProcurement(procurement_no: string) {
    // 1) Update rows
    await api(`${ITEMS}/procurement_request`, {
        method: 'PATCH',
        body: JSON.stringify({
            filter: { procurement_no: { _eq: procurement_no } },
            data: { status: 'Approved', updated_at: nowISOManila() } as Partial<ProcurementRequestRow>,
        }),
    });

    // 2) Mark master approved
    await api(`${ITEMS}/procurement`, {
        method: 'PATCH',
        body: JSON.stringify({
            filter: { procurement_no: { _eq: procurement_no } },
            data: { isApproved: 1 },
        }),
    });
}
