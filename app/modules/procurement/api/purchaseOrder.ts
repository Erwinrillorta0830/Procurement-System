// modules/procurement/api/purchaseOrder.ts
import { api, nowISOManila } from './_base';
import { getProcurement, getProcurementDetails, Procurement } from './procurement';
import { getItemTemplateName, getItemVariantName, getItemTemplateUom } from './ItemCatalog'; // ✅ name lookups

export type PurchaseOrder = {
    purchase_order_id: number;           // PK
    purchase_order_no: string;           // e.g. "PO-2025-000123"
    supplier_name: number;               // supplier_id
    date: string;                        // YYYY-MM-DD
    time: string;                        // HH:mm:ss
    payment_type: number;
    datetime?: string | null;
    date_encoded?: string | null;
    approver_id?: number | null;
    encoder_id?: number | null;
    receiver_id?: number | null;
    remark?: string | null;
    reference?: string | null;
    total_amount?: number | null;
    price_type?: string | null;
    payment_status?: number | null;
    receiving_type?: number | null;
    inventory_status?: number | null;
    transaction_type?: number | null;
    receipt_required?: 0 | 1 | null;
};

// Lines (non-trade)
export type PurchaseOrderItem = {
    po_item_id: number;
    purchase_order_id: number;
    line_no: number;
    item_name: string;
    item_description?: string | null;
    uom?: string | null;
    qty: number;
    unit_price: number;
    line_subtotal: number;
    tax_rate: number;
    tax_amount: number;
    discount_amount: number;
    line_total: number;
    expected_date?: string | null;
    // plus trace fields you created: procurement_id, procurement_detail_id, etc. (returned by Directus)
};

function todayYYYYMMDD(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Simple client-side PO number (replace with server sequence if you have one)
function genPONumber(): string {
    const y = new Date().getFullYear();
    const n = String(Math.floor(Math.random() * 999999)).padStart(6, '0');
    return `PO-${y}-${n}`;
}

function timeHHMMSSManila(): string {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const manila = new Date(utc + 8 * 3600 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(manila.getHours())}:${pad(manila.getMinutes())}:${pad(manila.getSeconds())}`;
}

const to2 = (n: number) => Math.round(n * 100) / 100;

/** Create PO header only (no lines) */
async function createPOHeaderFromProcurement(p: Procurement, encoder_id: number | null, totalFromDetails: number) {
    const payload: Partial<PurchaseOrder> = {
        purchase_order_no: genPONumber(),
        supplier_name: p.supplier_id!,
        date: todayYYYYMMDD(),
        time: timeHHMMSSManila(),
        datetime: nowISOManila(),
        date_encoded: nowISOManila(),
        encoder_id: encoder_id ?? null,
        approver_id: p.approved_by ?? null,
        receiver_id: null,
        total_amount: Number(to2(totalFromDetails)),
        price_type: 'General Receive Price',
        payment_status: 0,
        payment_type: 0,
        receiving_type: 3,
        inventory_status: 0,
        transaction_type: 1,
        receipt_required: 1,
        remark: p.procurement_no,
        reference: String(p.id),
    };

    const res = await api<{ data: PurchaseOrder }>(`items/purchase_order`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    return res.data;
}

/** Build and insert purchase_order_items from procurement_details (non-trade) */
export async function createPOItemsFromProcurement(args: {
    purchase_order_id: number;
    procurement_id: number;
    default_tax_rate?: number; // e.g. 12 for VAT, 0 if not applicable
}) {
    const { purchase_order_id, procurement_id, default_tax_rate = 0 } = args;

    const p = await getProcurement(procurement_id);
    const rows = await getProcurementDetails(procurement_id);
    if (!p || !rows.length) return { created: 0 };

    const items: any[] = [];
    let i = 1;

    for (const r of rows) {
        let name = '';
        if (r.item_variant_id) name = await getItemVariantName(r.item_variant_id);
        if (!name && r.item_template_id) name = await getItemTemplateName(r.item_template_id);
        if (!name) name = 'Non-trade Item';

        const desc = (r as any).item_description ?? (r as any).link ?? null;

        let uom = (r as any).uom || '';
        if (!uom && r.item_template_id) uom = await getItemTemplateUom(r.item_template_id);

        const qty = Number(r.qty || 0);
        const price = Number(r.unit_price || 0);
        const subtotal = to2(qty * price);
        const tax_rate = default_tax_rate;
        const tax_amount = to2(subtotal * (tax_rate / 100));
        const discount_amount = 0;
        const line_total = to2(subtotal - discount_amount + tax_amount);

        items.push({
            purchase_order_id,
            line_no: i++,
            item_name: name,
            item_description: desc,
            uom: uom || null,
            qty,
            unit_price: price,
            line_subtotal: subtotal,
            tax_rate,
            tax_amount,
            discount_amount,
            line_total,
            expected_date: p.lead_date || null,
            notes: null,
            procurement_id: procurement_id,
            procurement_detail_id: r.id,
            supplier_id: p.supplier_id,
            item_template_id: r.item_template_id ?? null,
            item_variant_id: r.item_variant_id ?? null,
            currency: 'PHP',
            encoder_id: p.encoder_id ?? null,
            department_id: p.department_id ?? null,
            created_at: nowISOManila(),
            updated_at: nowISOManila(),
        });
    }

    await api(`items/purchase_order_items`, {
        method: 'POST',
        body: JSON.stringify(items),
    });

    return { created: items.length };
}


/** Generate PO header, link to procurement.po_no, and optionally create items */
export async function generatePOFromProcurement(args: {
    procurement_id: number;
    encoder_id: number | null;
    approver_id?: number | null;
    receiver_id?: number | null;
    default_tax_rate?: number; // pass 12 for VAT, 0 to skip
    create_items?: boolean;     // default true
}) {
    const {
        procurement_id,
        encoder_id,
        approver_id = null,    // kept for signature compatibility (header already uses p.approved_by)
        receiver_id = null,    // not used currently
        default_tax_rate = 0,
        create_items = true,
    } = args;

    const p: Procurement = await getProcurement(procurement_id);
    const details = await getProcurementDetails(procurement_id);

    if (!p) throw new Error('Procurement not found.');
    if (!p.supplier_id) throw new Error('Procurement has no supplier_id.');
    if (!p.isApproved) throw new Error('Procurement must be approved before generating a PO.');

    // sum from procurement details
    const total = details.reduce(
        (a, b) => a + Number(b.total_amount ?? (Number(b.qty || 0) * Number(b.unit_price || 0))),
        0
    );

    // create header
    const po = await createPOHeaderFromProcurement(p, encoder_id, total);
    if (!po?.purchase_order_id) throw new Error('Failed to create Purchase Order.');

    // link back to procurement
    await api(`items/procurement/${procurement_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ po_no: po.purchase_order_id }),
    });

    // create non-trade lines
    if (create_items) {
        await createPOItemsFromProcurement({
            purchase_order_id: po.purchase_order_id,
            procurement_id,
            default_tax_rate,
        });
    }

    // If you don’t use DB triggers to refresh PO header total from items,
    // you can fetch SUM(line_total) here and PATCH purchase_order.total_amount.

    return { purchase_order_id: po.purchase_order_id, purchase_order_no: po.purchase_order_no };
}

export async function getPurchaseOrder(id: number) {
    const fields = [
        'purchase_order_id',
        'purchase_order_no',
        'supplier_name',
        'date',
        'time',
        'total_amount',
        'remark',
        'reference',
        'payment_type',
        'payment_status',
        'receiving_type',
        'inventory_status',
        'transaction_type',
        'receipt_required',
    ].join(',');

    const url = `items/purchase_order/${id}?fields=${encodeURIComponent(fields)}`;
    const json = await api<{ data: PurchaseOrder }>(url);
    return json.data;
}

export async function getPurchaseOrderById(id: number) {
    const url = `items/purchase_order/${id}`;
    const json = await api<{ data: PurchaseOrder }>(url);
    return json.data;
}

export async function listPurchaseOrders(limit = 200) {
    const url = `items/purchase_order?sort=-date,-datetime&limit=${limit}`;
    const json = await api<{ data: PurchaseOrder[] }>(url);
    return json.data ?? [];
}
/** Batch fetch POs by id (using _in) */
export async function listPOsByIds(ids: number[]) {
    if (!ids.length) return [];
    const params = new URLSearchParams();
    params.set('filter', JSON.stringify({ purchase_order_id: { _in: ids } }));
    params.set('limit', '500');
    const url = `items/purchase_order?${params.toString()}`;
    const json = await api<{ data: PurchaseOrder[] }>(url);
    return json.data ?? [];
}

export async function findPOForProcurement(procurementId: number, procurementNo?: string | null) {
    // Try by reference first (we set it to procurement_id in the generator)
    const byRef = `items/purchase_order?filter[reference][_eq]=${encodeURIComponent(String(procurementId))}&limit=1&sort=-date,-datetime`;
    const r1 = await api<{ data: PurchaseOrder[] }>(byRef);
    if (r1.data?.length) return r1.data[0];

    // Try by remark matching the PR number (we set remark=procurement_no in the generator)
    if (procurementNo) {
        const byRemark = `items/purchase_order?filter[remark][_eq]=${encodeURIComponent(procurementNo)}&limit=1&sort=-date,-datetime`;
        const r2 = await api<{ data: PurchaseOrder[] }>(byRemark);
        if (r2.data?.length) return r2.data[0];
    }

    return null;
}

/** Get PO items for a header */
export async function listPOItems(purchase_order_id: number) {
    const fields = [
        'po_item_id',
        'purchase_order_id',
        'line_no',
        'item_name',
        'item_description',
        'uom',
        'qty',
        'unit_price',
        'line_subtotal',
        'tax_rate',
        'tax_amount',
        'discount_amount',
        'line_total',
    ].join(',');

    const url =
        `items/purchase_order_items` +
        `?fields=${encodeURIComponent(fields)}` +
        `&filter[purchase_order_id][_eq]=${encodeURIComponent(String(purchase_order_id))}` +
        `&sort=line_no&limit=500`;

    const json = await api<{ data: any[] }>(url);
    return json.data ?? [];
}

export async function listPOItemsByPOId(purchase_order_id: number) {
    const url =
        `items/purchase_order_items` +
        `?filter[purchase_order_id][_eq]=${encodeURIComponent(String(purchase_order_id))}` +
        `&sort=line_no&limit=500`;
    const json = await api<{ data: PurchaseOrderItem[] }>(url);
    return json.data ?? [];
}