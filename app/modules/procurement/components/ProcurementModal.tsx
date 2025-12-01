'use client';

import * as React from 'react';
import {
    getProcurement,
    getProcurementDetails,
    approveProcurementServer,
    updateProcurementDetail,
    recomputeProcurementTotal,
    Procurement,
    ProcurementDetail,
    createProcurementDetail,     // NEW
    deleteProcurementDetail,     // NEW
} from '../api/procurement';
import { getSupplierById, Supplier } from '../api/suppliers';
import {
    getItemTemplateName,
    getItemVariantName,
    getItemTemplateUom,
    listItemTemplates,
    listItemVariants,
    ItemTemplate,
    ItemVariant,
} from '../api/ItemCatalog';
import { listUnits, Unit } from '../api/units';
import { generatePOFromProcurement } from '../api/purchaseOrder';
import POModal from './POModal';
import { printNodeWithIframe } from '../../../lib/printNodeWithIframe';

type SessionUser = { user_id?: number };
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://100.126.246.124:8060';

/* ------------ helpers ------------ */
async function fetchPONumberById(poId: number): Promise<string> {
    if (!poId) return '';
    try {
        const res = await fetch(`${API_BASE}/items/purchase_order/${poId}?fields=purchase_order_no`);
        if (!res.ok) return '';
        const json = await res.json();
        return json?.data?.purchase_order_no ?? '';
    } catch {
        return '';
    }
}
function getCurrentUserId(): number | null {
    try {
        const raw = localStorage.getItem('user');
        if (!raw) return null;
        const u: SessionUser = JSON.parse(raw);
        return (u.user_id ?? null) as number | null;
    } catch {
        return null;
    }
}

type Draft = {
    qty: number;
    unit_price: number;
    total: number;
    uom: string;
    dirty: boolean;
    saving?: boolean;
};

export default function ProcurementModal({
                                             open,
                                             onClose,
                                             id,
                                             procurementNo,
                                         }: {
    open: boolean;
    onClose: () => void;
    id?: number | null;
    procurementNo?: string | null;
}) {
    const [master, setMaster] = React.useState<Procurement | null>(null);
    const [details, setDetails] = React.useState<ProcurementDetail[]>([]);
    const [supplier, setSupplier] = React.useState<Supplier | null>(null);
    const [units, setUnits] = React.useState<Unit[]>([]);
    const [busy, setBusy] = React.useState(false);
    const [msg, setMsg] = React.useState('');
    const [error, setError] = React.useState<string | null>(null);

    const [itemNames, setItemNames] = React.useState<Record<number, string>>({});
    const [variantNames, setVariantNames] = React.useState<Record<number, string>>({});
    const [drafts, setDrafts] = React.useState<Record<number, Draft>>({});
    const [tmplUoms, setTmplUoms] = React.useState<Record<number, string>>({});

    const [poModalOpen, setPoModalOpen] = React.useState(false);
    const [poIdForModal, setPoIdForModal] = React.useState<number | null>(null);
    const [poNumber, setPoNumber] = React.useState<string>('');

    // INNER print node
    const printRef = React.useRef<HTMLDivElement>(null);

    const approved =
        (!!master?.isApproved || master?.status === 'approved') || !!master?.po_no;

    React.useEffect(() => { (async () => { const u = await listUnits(); setUnits(u); })(); }, []);
    React.useEffect(() => { if (open) void load(); /* eslint-disable-next-line */ }, [open, id, procurementNo]);

    async function resolveHeaderIdByNo(no: string): Promise<number | null> {
        try {
            const url = new URL(`${API_BASE}/items/procurement`);
            url.searchParams.set('filter[procurement_no][_eq]', no);
            url.searchParams.set('limit', '1');
            const r = await fetch(url.toString());
            if (!r.ok) return null;
            const j = await r.json();
            const row = Array.isArray(j?.data) ? j.data[0] : j?.data;
            return row?.id ?? null;
        } catch { return null; }
    }

    async function load() {
        try {
            setError(null); setMsg(''); setPoNumber(''); setTmplUoms({});

            let headerId = id ?? null;
            if (!headerId && procurementNo) {
                headerId = await resolveHeaderIdByNo(procurementNo);
                if (!headerId) throw new Error('Procurement not found.');
            }

            const m = await getProcurement(Number(headerId));
            setMaster(m);

            if (m?.po_no) {
                const poNoStr = await fetchPONumberById(Number(m.po_no));
                setPoNumber(poNoStr || '');
            }

            const d = await getProcurementDetails(Number(headerId));
            setDetails(d);
            await Promise.all([loadNames(d), hydrateUoms(d), loadTemplateUoms(d)]);

            if (m?.supplier_id) {
                const s = await getSupplierById(m.supplier_id);
                setSupplier(s);
            }
        } catch (e: any) { setError(e?.message || 'Failed to load procurement.'); }
    }

    async function loadNames(currentDetails: ProcurementDetail[]) {
        const tmplIds = Array.from(new Set(currentDetails.map(d => d.item_template_id).filter((v): v is number => !!v)));
        const variantIds = Array.from(new Set(currentDetails.map(d => d.item_variant_id).filter((v): v is number => !!v)));
        const tmplEntries = await Promise.all(tmplIds.map(async (tid) => [tid, await getItemTemplateName(tid)] as [number, string]));
        const variantEntries = await Promise.all(variantIds.map(async (vid) => [vid, await getItemVariantName(vid)] as [number, string]));
        setItemNames(Object.fromEntries(tmplEntries));
        setVariantNames(Object.fromEntries(variantEntries));
    }

    async function loadTemplateUoms(currentDetails: ProcurementDetail[]) {
        const needTmpl = Array.from(new Set(currentDetails.filter(l => !(l as any).uom && l.item_template_id).map(l => l.item_template_id as number)));
        if (needTmpl.length === 0) { setTmplUoms({}); return; }
        const pairs = await Promise.all(needTmpl.map(async (tid) => [tid, await getItemTemplateUom(tid)] as [number, string]));
        setTmplUoms(Object.fromEntries(pairs));
    }

    async function hydrateUoms(currentDetails: ProcurementDetail[]) {
        const clones: Record<number, Draft> = {};
        currentDetails.forEach((l) => {
            const uomFromDetail = (l as any).uom as string | undefined;
            const total = Number(l.total_amount ?? (Number(l.qty || 0) * Number(l.unit_price || 0)));
            clones[l.id] = { qty: Number(l.qty || 0), unit_price: Number(l.unit_price || 0), total, uom: uomFromDetail ?? '', dirty: false };
        });
        setDrafts(clones);
    }

    const canApprove = !!master && !master.isApproved && master.status !== 'approved';
    const canGeneratePO = !!master?.isApproved && !master?.po_no;

    async function onApprove() {
        const uid = getCurrentUserId();
        if (!uid) { setMsg('No logged-in user found.'); return; }
        setBusy(true); setMsg('');
        try { await approveProcurementServer(Number(master?.id), uid); await load(); setMsg('Approved successfully.'); }
        catch (e: any) { setMsg(e?.message ?? 'Failed to approve'); }
        finally { setBusy(false); }
    }

    async function onGeneratePO() {
        const raw = localStorage.getItem('user'); const me = raw ? JSON.parse(raw) : null;
        const encoder_id = me?.user_id ?? null;
        setBusy(true); setMsg('');
        try {
            const out = await generatePOFromProcurement({
                procurement_id: Number(master?.id),
                encoder_id, approver_id: master?.approved_by ?? encoder_id, receiver_id: null,
                default_tax_rate: 12, create_items: true,
            });
            await load(); setMsg(`PO created: ${out.purchase_order_no}`);
        } catch (e: any) { setMsg(e?.message ?? 'Failed to generate PO.'); }
        finally { setBusy(false); }
    }

    function updateDraftRow(rowId: number, patch: Partial<Draft>) {
        setDrafts((prev) => {
            const cur = prev[rowId] || { qty: 0, unit_price: 0, total: 0, uom: '', dirty: false };
            const next = { ...cur, ...patch };
            if (patch.qty !== undefined || patch.unit_price !== undefined) {
                const q = patch.qty !== undefined ? patch.qty : cur.qty;
                const p = patch.unit_price !== undefined ? patch.unit_price : cur.unit_price;
                next.total = Number(q || 0) * Number(p || 0);
                next.dirty = true;
            }
            if (patch.uom !== undefined && patch.uom !== cur.uom) next.dirty = true;
            return { ...prev, [rowId]: next };
        });
    }

    async function saveRow(l: ProcurementDetail) {
        const d = drafts[l.id]; if (!d || !d.dirty) return;
        updateDraftRow(l.id, { saving: true });
        try {
            await updateProcurementDetail({ id: l.id, qty: d.qty, unit_price: d.unit_price, uom: d.uom });
            await recomputeProcurementTotal(l.procurement_id);
            await load();
            setMsg(`Saved line #${l.id}.`);
        } catch (e: any) {
            setMsg(e?.message ?? 'Failed to save line.');
            updateDraftRow(l.id, { saving: false });
        }
    }

    // --------- ADD LINE (inline) ----------
    const [addOpen, setAddOpen] = React.useState(false);
    const [tmplSearch, setTmplSearch] = React.useState('');
    const [tmplList, setTmplList] = React.useState<ItemTemplate[]>([]);
    const [addTmplId, setAddTmplId] = React.useState<number | 0>(0);
    const [variantList, setVariantList] = React.useState<ItemVariant[]>([]);
    const [addVariantId, setAddVariantId] = React.useState<number | 0>(0);
    const [addUom, setAddUom] = React.useState('');
    const [addQty, setAddQty] = React.useState<number>(1);
    const [addPrice, setAddPrice] = React.useState<number>(0);
    const addTotal = Number(addQty || 0) * Number(addPrice || 0);
    const [addBusy, setAddBusy] = React.useState(false);

    // search templates
    React.useEffect(() => { (async () => {
        if (!addOpen) return;
        const data = await listItemTemplates(tmplSearch || '');
        setTmplList(data);
    })(); }, [tmplSearch, addOpen]);

    // pick template → load variants + default uom/price
    React.useEffect(() => { (async () => {
        if (!addOpen || !addTmplId) { setVariantList([]); setAddVariantId(0); setAddUom(''); return; }
        const tmpl = tmplList.find(t => t.id === addTmplId);
        setAddUom(tmpl?.uom || '');
        const variants = await listItemVariants(addTmplId);
        setVariantList(variants);
        if (variants.length === 0) {
            setAddVariantId(0);
            setAddPrice(Number(tmpl?.base_price || 0));
        } else {
            setAddVariantId(0);
            setAddPrice(0);
        }
    })(); }, [addTmplId]);

    // pick variant → price from variant
    React.useEffect(() => {
        if (!addOpen) return;
        if (!addVariantId) {
            const tmpl = tmplList.find(t => t.id === addTmplId);
            setAddPrice(Number(tmpl?.base_price || 0));
            return;
        }
        const v = variantList.find(x => x.id === addVariantId);
        setAddPrice(Number(v?.list_price || 0));
    }, [addVariantId]);

    async function doAddLine() {
        if (!master?.id) return;
        if (!addTmplId) { setMsg('Select an item template to add.'); return; }
        setAddBusy(true); setMsg('');
        try {
            await createProcurementDetail({
                procurement_id: Number(master.id),
                item_template_id: addTmplId || null,
                item_variant_id: addVariantId || null,
                uom: addUom || '',
                qty: Number(addQty || 0),
                unit_price: Number(addPrice || 0),
            });
            await recomputeProcurementTotal(Number(master.id));
            // reset add row
            setAddOpen(false);
            setAddTmplId(0); setAddVariantId(0); setVariantList([]); setAddUom(''); setAddQty(1); setAddPrice(0);
            await load();
            setMsg('Item added.');
        } catch (e: any) {
            setMsg(e?.message || 'Failed to add item.');
        } finally { setAddBusy(false); }
    }

    async function doDeleteLine(row: ProcurementDetail) {
        if (!row?.id) return;
        if (!confirm('Remove this line?')) return;
        try {
            await deleteProcurementDetail(row.id);
            await recomputeProcurementTotal(row.procurement_id);
            await load();
            setMsg(`Removed line #${row.id}.`);
        } catch (e: any) {
            setMsg(e?.message || 'Failed to remove line.');
        }
    }

    const grandTotal =
        master?.total_amount ??
        details.reduce((a, b) => a + Number(b.total_amount || (b.qty || 0) * (b.unit_price || 0)), 0);

    const supplierName =
        typeof (master as any)?.supplier_id === 'number'
            ? (supplier?.supplier_name ?? `#${master?.supplier_id ?? ''}`)
            : supplier?.supplier_name ?? '—';

    const handlePrint = () => {
        if (printRef.current) {
            printNodeWithIframe(printRef.current, `Procurement ${master?.procurement_no ?? ''}`);
        }
    };

    return (
        <>
            {/* SCREEN MODAL */}
            <div className={`fixed inset-0 z-[60] ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
                <div className={`absolute inset-0 bg-black/40 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
                <div className={`absolute left-1/2 top-1/2 w-[min(100vw-24px,1100px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-xl transition-all ${open ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                    <div className="flex items-center justify-between border-b px-4 py-3">
                        <div className="font-semibold">
                            Procurement {master?.procurement_no ? `#${master.procurement_no}` : (master?.id ? `#${master.id}` : '')}
                        </div>
                        <div className="flex gap-2">
                            {!!master?.po_no && (
                                <button className="rounded-xl border px-3 py-1.5 text-sm"
                                        onClick={() => { setPoIdForModal(Number(master?.po_no) || null); setPoModalOpen(true); }}>
                                    View PO
                                </button>
                            )}
                            <button onClick={handlePrint} className="rounded-xl border px-3 py-1.5 text-sm">Print</button>
                            <button onClick={onClose} className="rounded-xl border px-3 py-1.5 text-sm">Close</button>
                        </div>
                    </div>

                    {(msg || error) && (
                        <div
                            className={`mx-4 mt-3 rounded-xl border p-3 text-sm ${
                                error ? 'bg-rose-50 border-rose-200 text-rose-700' :
                                    msg.toLowerCase().includes('po created') || msg.toLowerCase().includes('approved')
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                        : 'bg-slate-50 border-slate-200'
                            }`}
                        >
                            {error || msg}
                        </div>
                    )}

                    {/* BODY */}
                    <div className="max-h-[78vh] overflow-auto p-4">
                        {/* Header */}
                        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                            <div className="px-4 py-3 border-b text-sm font-semibold">Header</div>
                            <div className="p-4 grid md:grid-cols-3 gap-3 text-sm">
                                <Info label="PO No" value={poNumber || ''} />
                                <Info label="PR No" value={master?.procurement_no ?? ''} />
                                <Info label="Lead Date" value={master?.lead_date ?? ''} />
                                <Info label="Status" value={`${master?.status ?? ''}${master?.isApproved ? ' (Approved)' : ''}`} />
                                <Info label="Supplier" value={supplierName} />
                                <Info label="Payment Terms" value={(supplier as any)?.payment_terms ?? ''} />
                                <Info label="TIN" value={(supplier as any)?.tin_number ?? ''} />
                                <Info label="Email" value={supplier?.email_address ?? ''} />
                                <Info label="Phone" value={(supplier as any)?.phone_number ?? ''} />
                                <Info label="Address" value={supplier?.address ?? ''} />
                            </div>
                        </div>

                        {/* Lines */}
                        <div className="mt-4 rounded-2xl border bg-white shadow-sm overflow-hidden">
                            <div className="px-4 py-3 border-b flex items-center justify-between">
                                <div className="text-sm font-semibold">Items</div>
                                {!approved && (
                                    <div className="flex gap-2">
                                        {!addOpen ? (
                                            <button className="rounded-xl px-3 py-2 bg-emerald-600 text-white" onClick={() => setAddOpen(true)}>
                                                + Add Item
                                            </button>
                                        ) : (
                                            <button className="rounded-xl px-3 py-2 border" onClick={() => setAddOpen(false)}>
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Add Item Row */}
                            {addOpen && !approved && (
                                <div className="p-3 border-b grid gap-2 md:grid-cols-6">
                                    <div className="md:col-span-2 grid gap-1">
                                        <input className="rounded-xl border px-3 py-2" placeholder="Search item templates…"
                                               value={tmplSearch} onChange={(e) => setTmplSearch(e.target.value)} />
                                        <select className="rounded-xl border px-3 py-2" value={addTmplId}
                                                onChange={(e) => setAddTmplId(Number(e.target.value))}>
                                            <option value={0}>Select template</option>
                                            {tmplList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <select className="rounded-xl border px-3 py-2 w-full" value={addVariantId}
                                                onChange={(e) => setAddVariantId(Number(e.target.value))}
                                                disabled={!addTmplId || variantList.length === 0}>
                                            <option value={0}>No variant</option>
                                            {variantList.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <input className="rounded-xl border px-3 py-2 w-full" placeholder="UOM"
                                               value={addUom} onChange={(e) => setAddUom(e.target.value)} />
                                    </div>
                                    <div>
                                        <input type="number" min={1} className="rounded-xl border px-3 py-2 w-full"
                                               value={addQty} onChange={(e) => setAddQty(Number(e.target.value))} />
                                    </div>
                                    <div>
                                        <input type="number" step="0.01" min={0} className="rounded-xl border px-3 py-2 w-full"
                                               value={addPrice} onChange={(e) => setAddPrice(Number(e.target.value))} />
                                    </div>
                                    <div className="md:col-span-6 flex items-center justify-between">
                                        <div className="text-sm text-slate-600">Total: <b>₱ {addTotal.toFixed(2)}</b></div>
                                        <button onClick={doAddLine} disabled={addBusy} className="rounded-xl px-4 py-2 bg-blue-600 text-white">
                                            {addBusy ? 'Adding…' : 'Add'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="overflow-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                    <tr className="text-left bg-slate-50">
                                        <th className="p-3">Item Template</th>
                                        <th className="p-3">Variant</th>
                                        <th className="p-3">UOM</th>
                                        <th className="p-3">Qty</th>
                                        <th className="p-3">Unit Price</th>
                                        <th className="p-3">Total</th>
                                        <th className="p-3">Date Added</th>
                                        <th className="p-3">Link</th>
                                        <th className="p-3">Actions</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {details.map((l) => {
                                        const d = drafts[l.id];
                                        const saving = !!d?.saving;
                                        const uom = (d?.uom ?? (l as any).uom) || (l.item_template_id ? tmplUoms[l.item_template_id] : '') || '';
                                        return (
                                            <tr key={l.id} className="border-t">
                                                <td className="p-3">{(l.item_template_id && itemNames[l.item_template_id]) || '—'}</td>
                                                <td className="p-3">{(l.item_variant_id && variantNames[l.item_variant_id]) || '—'}</td>
                                                <td className="p-3 min-w-40">
                                                    <input className="rounded-xl border px-3 py-2 w-28"
                                                           value={uom} onChange={(e) => updateDraftRow(l.id, { uom: e.target.value })}
                                                           disabled={approved || saving} />
                                                </td>
                                                <td className="p-3">
                                                    <input type="number" min={1} className="rounded-xl border px-3 py-2 w-24"
                                                           value={d?.qty ?? l.qty}
                                                           onChange={(e) => updateDraftRow(l.id, { qty: Number(e.target.value) })}
                                                           disabled={approved || saving} />
                                                </td>
                                                <td className="p-3">
                                                    <input type="number" step="0.01" min={0} className="rounded-xl border px-3 py-2 w-32"
                                                           value={d?.unit_price ?? l.unit_price}
                                                           onChange={(e) => updateDraftRow(l.id, { unit_price: Number(e.target.value) })}
                                                           disabled={approved || saving} />
                                                </td>
                                                <td className="p-3 font-medium">
                                                    ₱ {((d?.qty ?? l.qty ?? 0) * (d?.unit_price ?? l.unit_price ?? 0)).toFixed(2)}
                                                </td>
                                                <td className="p-3">{l.date_added}</td>
                                                <td className="p-3">
                                                    {l.link ? (
                                                        <a className="text-blue-600 underline" href={l.link} target="_blank" rel="noreferrer">file</a>
                                                    ) : '—'}
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex gap-2">
                                                        {!approved && (
                                                            <button type="button" className="rounded-xl px-3 py-1 bg-rose-600 text-white"
                                                                    onClick={() => void doDeleteLine(l)}>
                                                                Delete
                                                            </button>
                                                        )}
                                                        <button type="button" className="rounded-xl px-3 py-1 border disabled:opacity-50"
                                                                onClick={() => {
                                                                    const existing = drafts[l.id];
                                                                    setDrafts((prev) => ({
                                                                        ...prev,
                                                                        [l.id]: {
                                                                            qty: Number(l.qty || 0),
                                                                            unit_price: Number(l.unit_price || 0),
                                                                            total: Number(l.total_amount ?? (Number(l.qty || 0) * (l.unit_price || 0))),
                                                                            uom: (l as any).uom ?? existing?.uom ?? '',
                                                                            dirty: false,
                                                                        },
                                                                    }));
                                                                }}
                                                                disabled={approved || !d?.dirty || saving}>
                                                            Revert
                                                        </button>
                                                        <button type="button" className="rounded-xl px-3 py-1 bg-blue-600 text-white disabled:opacity-50"
                                                                onClick={() => void saveRow(l)} disabled={approved || !d?.dirty || saving}>
                                                            {saving ? 'Saving…' : 'Save'}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {details.length === 0 && (
                                        <tr><td colSpan={9} className="p-6 text-center text-slate-500">No lines.</td></tr>
                                    )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="px-4 py-3 border-t text-right text-sm">
                                Grand Total:&nbsp;<b>₱ {Number(grandTotal || 0).toFixed(2)}</b>
                            </div>
                        </div>
                    </div>

                    {/* Footer actions */}
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                        <div className="text-sm text-slate-500">
                            {master?.status}{master?.isApproved ? ' · Approved' : ''}
                        </div>
                        <div className="flex gap-2">
                            {canGeneratePO && (
                                <button className="rounded-xl px-3 py-2 bg-indigo-600 text-white disabled:opacity-50"
                                        onClick={onGeneratePO} disabled={busy} title="Generate Purchase Order">
                                    {busy ? 'Working…' : 'Generate PO'}
                                </button>
                            )}
                            <button className="rounded-xl px-3 py-2 bg-emerald-600 text-white disabled:opacity-50"
                                    onClick={onApprove} disabled={!canApprove || busy}
                                    title={canApprove ? 'Approve this procurement' : 'Already approved'}>
                                {busy ? 'Working…' : master?.isApproved ? 'Approved' : 'Approve'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ===== OFF-SCREEN PRINT CONTENT ===== */}
            <div aria-hidden style={{ position: 'fixed', left: '-200vw', top: 0, width: '210mm', background: 'white', padding: 0 }}>
                <div ref={printRef}>
                    <InvoicePrint
                        title="PROCUREMENT"
                        poNumber={poNumber || ''}
                        master={master}
                        supplier={supplier}
                        details={details}
                        itemNames={itemNames}
                        variantNames={variantNames}
                        uomMap={tmplUoms}
                    />
                </div>
            </div>

            {/* PO modal */}
            <POModal
                open={poModalOpen}
                onClose={() => setPoModalOpen(false)}
                poId={poIdForModal}
                fallbackProcurementId={Number(master?.id) || null}
            />
        </>
    );
}

function Info({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
            <div className="font-medium text-slate-800">{value || '—'}</div>
        </div>
    );
}

/** A4 Invoice block (screen/print neutral) */
function InvoicePrint({
                          title,
                          poNumber,
                          master,
                          supplier,
                          details,
                          itemNames,
                          variantNames,
                          uomMap,
                      }: {
    title: string;
    poNumber: string;
    master: Procurement | null;
    supplier: Supplier | null;
    details: ProcurementDetail[];
    itemNames: Record<number, string>;
    variantNames: Record<number, string>;
    uomMap: Record<number, string>;
}) {
    const grand =
        master?.total_amount ??
        details.reduce((a, b) => a + Number(b.total_amount || (b.qty || 0) * (b.unit_price || 0)), 0);

    return (
        <div className="w-a4">
            <header className="flex items-start justify-between mb-3">
                <div>
                    <div className="h1">PROCUREMENT</div>
                    {poNumber && <div className="muted">PO No: {poNumber}</div>}
                    <div className="muted">PR No: {master?.procurement_no ?? '—'}</div>
                    <div className="muted">Lead Date: {master?.lead_date ?? '—'}</div>
                    <div className="muted">Status: {master?.status ?? '—'}{master?.isApproved ? ' (Approved)' : ''}</div>
                </div>
                <div className="text-right text-sm">
                    <div className="font-semibold">{supplier?.supplier_name ?? (master ? `Supplier #${(master as any)?.supplier_id ?? ''}` : '—')}</div>
                    <div>{supplier?.address}</div>
                    <div>{supplier?.email_address}{(supplier as any)?.phone_number ? ` · ${(supplier as any)?.phone_number}` : ''}</div>
                    <div>{(supplier as any)?.tin_number ? `TIN: ${(supplier as any)?.tin_number}` : ''}</div>
                    <div>{(supplier as any)?.payment_terms ? `Terms: ${(supplier as any)?.payment_terms}` : ''}</div>
                </div>
            </header>

            <table>
                <thead>
                <tr>
                    <th>Item Template</th>
                    <th>Variant</th>
                    <th>UOM</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Unit Price</th>
                    <th className="text-right">Total</th>
                </tr>
                </thead>
                <tbody>
                {details.map((l) => {
                    const uom = (l as any).uom || (l.item_template_id ? uomMap[l.item_template_id] : '') || '—';
                    const total = Number(l.total_amount || (l.qty || 0) * (l.unit_price || 0));
                    return (
                        <tr key={l.id}>
                            <td>{(l.item_template_id && itemNames[l.item_template_id]) || '—'}</td>
                            <td>{(l.item_variant_id && variantNames[l.item_variant_id]) || '—'}</td>
                            <td>{uom}</td>
                            <td className="text-right">{Number(l.qty || 0).toFixed(2)}</td>
                            <td className="text-right">₱ {Number(l.unit_price || 0).toFixed(2)}</td>
                            <td className="text-right">₱ {total.toFixed(2)}</td>
                        </tr>
                    );
                })}
                {details.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-slate-500 py-6">No lines.</td></tr>
                )}
                </tbody>
                <tfoot>
                <tr>
                    <td colSpan={5} className="text-right font-semibold pt-3">Grand Total</td>
                    <td className="text-right font-bold pt-3">₱ {Number(grand || 0).toFixed(2)}</td>
                </tr>
                </tfoot>
            </table>

            <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
                <div><div className="font-semibold">Prepared By</div><div className="mt-12 border-t w-56"></div></div>
                <div><div className="font-semibold">Approved By</div><div className="mt-12 border-t w-56"></div></div>
            </div>
        </div>
    );
}
