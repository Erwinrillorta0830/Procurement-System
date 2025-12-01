import { api, ITEMS, nowISOManila, todayManila } from './_base';

export type Procurement = {
    id: number;
    procurement_no: string;
    supplier_id: number;
    lead_date: string | null;
    total_amount: number | null;
    created_at?: string | null;
    updated_at?: string | null;
    encoder_id?: number | null;
    department_id?: number | null;
    po_no?: number | null;
    isApproved?: 0 | 1;
    approved_by?: number | null;
    approved_date?: string | null;
    transaction_type?: 'trade' | 'non-trade' | null;
    status?: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled' | null;
};

export type ProcurementDetailInput = {
    item_template_id?: number | null;
    item_variant_id?: number | null;
    item_name: string;
    item_description?: string | null;
    uom?: string | null;
    qty: number;
    unit_price: number;
    link?: string | null;
};

export interface Supplier {
    id: number;
    supplier_name: string;
    address?: string;
    contact_person?: string;
    email_address?: string;
}

// ---------- utils ----------
const norm = (v: string | null | undefined) => (v ?? '').trim();
const up = (v: string | null | undefined) => norm(v).toUpperCase();

// NON-TRADE detection FIRST (handles "NON-TRADE", "NON TRADE", "Non—Trade", "NONTRADE")
function prefixFromType(typeValue: string | null | undefined): 'PRTR' | 'PRNT' | 'PR' {
    const T = up(typeValue);
    const isNonTrade = /NON[\s_\-–—]*TRADE/.test(T) || T === 'NON' || T.startsWith('NON-') || T.startsWith('NON ');
    if (isNonTrade) return 'PRNT';
    if (T.includes('TRADE')) return 'PRTR';
    return 'PR';
}

async function resolveTypeAndPrefix(supplier_id: number): Promise<{
    supplier_type_raw: string | null;
    prefix: 'PRTR' | 'PRNT' | 'PR';
    transaction_type: 'trade' | 'non-trade' | null;
}> {
    // Try /:id
    try {
        const r1 = await api<{ data?: { supplier_type?: string | null } }>(
            `${ITEMS}/suppliers/${supplier_id}?fields=supplier_type`
        );
        const s1 = r1?.data?.supplier_type ?? null;
        if (norm(s1)) {
            const prefix = prefixFromType(s1);
            const tx = prefix === 'PRNT' ? 'non-trade' : prefix === 'PRTR' ? 'trade' : null;
            return { supplier_type_raw: s1, prefix, transaction_type: tx };
        }
    } catch {
        // fall through
    }
    // Fallback to filter route
    try {
        const filter = encodeURIComponent(JSON.stringify({ id: { _eq: supplier_id } }));
        const r2 = await api<{ data?: Array<{ supplier_type?: string | null }> }>(
            `${ITEMS}/suppliers?filter=${filter}&fields=supplier_type&limit=1`
        );
        const s2 = r2?.data?.[0]?.supplier_type ?? null;
        if (norm(s2)) {
            const prefix = prefixFromType(s2);
            const tx = prefix === 'PRNT' ? 'non-trade' : prefix === 'PRTR' ? 'trade' : null;
            return { supplier_type_raw: s2, prefix, transaction_type: tx };
        }
    } catch {
        // fall through
    }
    // Unknown
    return { supplier_type_raw: null, prefix: 'PR', transaction_type: null };
}

// ---------- API ----------
export async function listSuppliers(): Promise<Supplier[]> {
    const res = await fetch('http://100.126.246.124:8060/items/suppliers');
    if (!res.ok) throw new Error('Failed to fetch suppliers');
    const json = await res.json();
    return json.data || [];
}

export async function createProcurementWithDetails(args: {
    supplier_id: number;
    lead_date?: string | null; // YYYY-MM-DD
    encoder_id?: number | null;
    department_id?: number | null;
    // NOTE: we intentionally ignore any incoming transaction_type to avoid accidental defaults
    status?: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled';
    items: ProcurementDetailInput[];
    transaction_type?: 'trade' | 'non-trade';
}) {
    if (!args.supplier_id) throw new Error('supplier_id is required');
    if (!args.items?.length) throw new Error('At least one detail line is required');

    // Resolve from supplier_type (never default to 'trade')
    const { supplier_type_raw, prefix, transaction_type } = await resolveTypeAndPrefix(args.supplier_id);

    const procurement_no = `${prefix}-${new Date().getFullYear()}-${String(
        Math.floor(Math.random() * 999999)
    ).padStart(6, '0')}`;

    const detailTotals = args.items.map((i) => Number(i.qty || 0) * Number(i.unit_price || 0));
    const total_amount = detailTotals.reduce((a, b) => a + b, 0);

    // 1) Create master procurement
    const masterRes = await api<{ data: Procurement }>(`${ITEMS}/procurement`, {
        method: 'POST',
        body: JSON.stringify({
            procurement_no,
            supplier_id: args.supplier_id,
            lead_date: args.lead_date ?? todayManila(),
            total_amount,
            created_at: nowISOManila(),
            updated_at: nowISOManila(),
            encoder_id: args.encoder_id ?? null,
            department_id: args.department_id ?? null,
            isApproved: 0,
            transaction_type, // 'non-trade' if NON-TRADE, 'trade' if TRADE, null otherwise
            status: args.status ?? 'pending',
        }),
    });
    const procurement = masterRes.data;

    // 2) Insert details (bulk)
    const detailsPayload = args.items.map((it) => ({
        procurement_id: procurement.id,
        item_variant_id: it.item_variant_id ?? null,
        item_template_id: it.item_template_id ?? null,
        qty: Number(it.qty || 0),
        unit_price: Number(it.unit_price || 0),
        total_amount: Number(it.qty || 0) * Number(it.unit_price || 0),
        date_added: todayManila(),
        supplier: args.supplier_id,
        link: it.link ?? null,
        created_at: nowISOManila(),
        updated_at: nowISOManila(),
        uom: it.uom ?? null,
    }));
    await api(`${ITEMS}/procurement_details`, {
        method: 'POST',
        body: JSON.stringify(detailsPayload),
    });

    // 3) Defensive recompute
    const calc = detailTotals.reduce((a, b) => a + b, 0);
    if (Math.abs(calc - (procurement.total_amount || 0)) > 0.009) {
        await api(`${ITEMS}/procurement/${procurement.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ total_amount: calc, updated_at: nowISOManila() }),
        });
    }

    // Debug (optional)
    console.log('[createProcurementWithDetails]', {
        supplier_id: args.supplier_id,
        supplier_type_raw,
        prefix_used: prefix,
        resolved_transaction_type: transaction_type,
        procurement_no,
    });

    return { procurement_id: procurement.id, procurement_no };
}

export type ProcurementDetail = {
    id: number;
    procurement_id: number;
    item_variant_id?: number | null;
    item_template_id?: number | null;
    qty: number;
    unit_price: number;
    total_amount: number;
    date_added: string;
    supplier?: number | null;
    link?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    uom?: string | null;
};

export async function listProcurements(opts?: { search?: string; status?: string }) {
    const params = new URLSearchParams();
    const filter: any = {};
    if (opts?.search) {
        filter._or = [
            { procurement_no: { _contains: opts.search } },
            { transaction_type: { _contains: opts.search } },
            { status: { _contains: opts.search } },
        ];
    }
    if (opts?.status && opts.status !== 'all') {
        filter.status = { _eq: opts.status };
    }
    if (Object.keys(filter).length) params.set('filter', JSON.stringify(filter));
    params.set('sort', '-created_at');
    params.set('limit', '200');
    const url = `${ITEMS}/procurement?${params.toString()}`;
    const json = await api<{ data: Procurement[] }>(url);
    return json.data ?? [];
}

export async function getProcurement(id: number) {
    const json = await api<{ data: Procurement }>(`${ITEMS}/procurement/${id}`);
    return json.data;
}

export async function getProcurementDetails(procurement_id: number) {
    const params = new URLSearchParams();
    params.set('filter', JSON.stringify({ procurement_id: { _eq: procurement_id } }));
    params.set('sort', 'id');
    params.set('limit', '500');
    const url = `${ITEMS}/procurement_details?${params.toString()}`;
    const json = await api<{ data: ProcurementDetail[] }>(url);
    return json.data ?? [];
}

export async function approveProcurementServer(id: number, approved_by: number) {
    const payload = {
        isApproved: 1,
        status: 'approved',
        approved_by,
        approved_date: nowISOManila(),
        updated_at: nowISOManila(),
    };
    return api(`${ITEMS}/procurement/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
}

export async function updateProcurementDetail(detail: {
    id: number;
    qty: number;
    unit_price: number;
    uom?: string | null;
}) {
    const total_amount = Number(detail.qty || 0) * Number(detail.unit_price || 0);
    const body: any = {
        qty: Number(detail.qty || 0),
        unit_price: Number(detail.unit_price || 0),
        total_amount,
        updated_at: nowISOManila(),
    };
    if (detail.uom !== undefined) body.uom = detail.uom;

    return api(`${ITEMS}/procurement_details/${detail.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
}


/** NEW: create a single line (used by Add Item in details modal) */
export async function createProcurementDetail(input: {
    procurement_id: number;
    item_template_id?: number | null;
    item_variant_id?: number | null;
    uom?: string | null;
    qty: number;
    unit_price: number;
    link?: string | null;
}) {
    const payload = {
        procurement_id: input.procurement_id,
        item_template_id: input.item_template_id ?? null,
        item_variant_id: input.item_variant_id ?? null,
        uom: input.uom ?? null,
        qty: Number(input.qty || 0),
        unit_price: Number(input.unit_price || 0),
        total_amount: Number(input.qty || 0) * Number(input.unit_price || 0),
        date_added: todayManila(),
        created_at: nowISOManila(),
        updated_at: nowISOManila(),
        link: input.link ?? null,
    };
    const json = await api<{ data: ProcurementDetail }>(`${ITEMS}/procurement_details`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    return json.data;
}

/** NEW: delete a single detail line by id */
export async function deleteProcurementDetail(id: number) {
    await api(`${ITEMS}/procurement_details/${id}`, { method: 'DELETE' });
    return true;
}

export async function recomputeProcurementTotal(procurement_id: number) {
    const params = new URLSearchParams();
    params.set('filter', JSON.stringify({ procurement_id: { _eq: procurement_id } }));
    params.set('limit', '500');
    const url = `${ITEMS}/procurement_details?${params.toString()}`;
    const json = await api<{ data: { total_amount?: number; qty?: number; unit_price?: number }[] }>(url);

    const total = (json.data ?? []).reduce((a, b) => {
        const t = b.total_amount ?? Number(b.qty || 0) * Number(b.unit_price || 0);
        return a + Number(t || 0);
    }, 0);

    await api(`${ITEMS}/procurement/${procurement_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ total_amount: total, updated_at: nowISOManila() }),
    });

    return total;
}

