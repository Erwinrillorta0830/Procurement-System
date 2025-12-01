'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
    getProcurement,
    getProcurementDetails,
    approveProcurementServer,
    updateProcurementDetail,
    recomputeProcurementTotal,
    Procurement,
    ProcurementDetail,
} from '../api/procurement';
import { getSupplierById, Supplier } from '../api/suppliers';
import { getItemTemplateName, getItemVariantName, getItemTemplateUom } from '../api/ItemCatalog';
import { listUnits, Unit } from '../api/units';
import { generatePOFromProcurement } from '../api/purchaseOrder';

type SessionUser = { user_id?: number };

// --- Quick helper to fetch PO number from Directus by PO id ---
async function fetchPONumberById(poId: number): Promise<string> {
    if (!poId) return '';
    try {
        const res = await fetch(
            `http://100.126.246.124:8060/items/purchase_order/${poId}?fields=purchase_order_no`
        );
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

export default function ProcurementDetailsPage() {
    const params = useParams<{ id: string }>();
    const id = Number(params?.id);

    const [master, setMaster] = useState<Procurement | null>(null);
    const [details, setDetails] = useState<ProcurementDetail[]>([]);
    const [supplier, setSupplier] = useState<Supplier | null>(null);
    const [units, setUnits] = useState<Unit[]>([]);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');

    const [itemNames, setItemNames] = useState<Record<number, string>>({});
    const [variantNames, setVariantNames] = useState<Record<number, string>>({});

    // Human–readable PO number
    const [poNumber, setPoNumber] = useState<string>('');

    const [drafts, setDrafts] = useState<Record<number, Draft>>({});

    // lock edits if approved or already has a PO
    const approved =
        (!!master?.isApproved || master?.status === 'approved') || !!master?.po_no;

    async function loadNames(currentDetails: ProcurementDetail[]) {
        const tmplIds = Array.from(
            new Set(
                currentDetails
                    .map((d) => d.item_template_id)
                    .filter((v): v is number => !!v)
            )
        );
        const variantIds = Array.from(
            new Set(
                currentDetails
                    .map((d) => d.item_variant_id)
                    .filter((v): v is number => !!v)
            )
        );

        const tmplEntries = await Promise.all(
            tmplIds.map(
                async (tid) => [tid, await getItemTemplateName(tid)] as [number, string]
            )
        );
        const variantEntries = await Promise.all(
            variantIds.map(
                async (vid) => [vid, await getItemVariantName(vid)] as [number, string]
            )
        );

        setItemNames(Object.fromEntries(tmplEntries));
        setVariantNames(Object.fromEntries(variantEntries));
    }

    async function hydrateUoms(currentDetails: ProcurementDetail[]) {
        const clones: Record<number, Draft> = {};
        currentDetails.forEach((l) => {
            const uomFromDetail = (l as any).uom as string | undefined;
            const total = Number(
                l.total_amount ?? Number(l.qty || 0) * Number(l.unit_price || 0)
            );
            clones[l.id] = {
                qty: Number(l.qty || 0),
                unit_price: Number(l.unit_price || 0),
                total,
                uom: uomFromDetail ?? '',
                dirty: false,
            };
        });

        const missing = currentDetails.filter(
            (l) => !(l as any).uom && l.item_template_id
        );
        const mapByTemplate = new Map<number, string>();

        await Promise.all(
            missing.map(async (l) => {
                const tid = l.item_template_id as number;
                if (!mapByTemplate.has(tid)) {
                    const tmplUom = await getItemTemplateUom(tid);
                    mapByTemplate.set(tid, tmplUom || '');
                }
                clones[l.id].uom = mapByTemplate.get(tid) || '';
            })
        );

        setDrafts(clones);
    }

    async function load() {
        setMsg('');
        setPoNumber('');

        const m = await getProcurement(id);
        setMaster(m);

        if (m?.po_no) {
            const poNoStr = await fetchPONumberById(Number(m.po_no));
            setPoNumber(poNoStr || '');
        }

        const d = await getProcurementDetails(id);
        setDetails(d);
        await loadNames(d);
        await hydrateUoms(d);

        if (m?.supplier_id) {
            const s = await getSupplierById(m.supplier_id);
            setSupplier(s);
        }
    }

    useEffect(() => {
        if (Number.isFinite(id)) {
            void load();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    useEffect(() => {
        (async () => {
            const u = await listUnits();
            setUnits(u);
        })();
    }, []);

    const canApprove = !!master && !master.isApproved && master.status !== 'approved';
    const canGeneratePO = !!master?.isApproved && !master?.po_no;
    const hasPO = !!master?.po_no;

    async function onApprove() {
        const uid = getCurrentUserId();
        if (!uid) {
            setMsg('No logged-in user found.');
            return;
        }
        setBusy(true);
        setMsg('');
        try {
            await approveProcurementServer(id, uid);
            await load();
            setMsg('Approved successfully.');
        } catch (e: any) {
            setMsg(e?.message ?? 'Failed to approve');
        } finally {
            setBusy(false);
        }
    }

    async function onGeneratePO() {
        const raw = localStorage.getItem('user');
        const me = raw ? JSON.parse(raw) : null;
        const encoder_id = me?.user_id ?? null;

        setBusy(true);
        setMsg('');
        try {
            const out = await generatePOFromProcurement({
                procurement_id: id,
                encoder_id,
                approver_id: master?.approved_by ?? encoder_id,
                receiver_id: null,
                default_tax_rate: 12,
                create_items: true,
            });
            await load();
            setMsg(`PO created: ${out.purchase_order_no}`);
        } catch (e: any) {
            setMsg(e?.message ?? 'Failed to generate PO.');
        } finally {
            setBusy(false);
        }
    }

    function updateDraftRow(rowId: number, patch: Partial<Draft>) {
        setDrafts((prev) => {
            const cur: Draft =
                prev[rowId] || {
                    qty: 0,
                    unit_price: 0,
                    total: 0,
                    uom: '',
                    dirty: false,
                };
            const next: Draft = { ...cur, ...patch };

            if (patch.qty !== undefined || patch.unit_price !== undefined) {
                const q = patch.qty !== undefined ? patch.qty : cur.qty;
                const p = patch.unit_price !== undefined ? patch.unit_price : cur.unit_price;
                next.total = Number(q || 0) * Number(p || 0);
                next.dirty = true;
            }
            if (patch.uom !== undefined && patch.uom !== cur.uom) {
                next.dirty = true;
            }

            return { ...prev, [rowId]: next };
        });
    }

    async function saveRow(l: ProcurementDetail) {
        const d = drafts[l.id];
        if (!d || !d.dirty) return;

        updateDraftRow(l.id, { saving: true });
        try {
            await updateProcurementDetail({
                id: l.id,
                qty: d.qty,
                unit_price: d.unit_price,
                uom: d.uom,
            });

            const newTotal = await recomputeProcurementTotal(l.procurement_id);

            // 🔹 Update header total in state so Grand Total reflects server value
            setMaster((prev) =>
                prev && prev.id === l.procurement_id
                    ? { ...prev, total_amount: newTotal }
                    : prev
            );

            setMsg(
                `Saved line #${l.id}. New grand total: ₱ ${newTotal.toFixed(2)}`
            );

            const fresh = await getProcurementDetails(l.procurement_id);
            setDetails(fresh);

            const freshRow = fresh.find(
                (x) => x.id === l.id
            ) as ProcurementDetail & { uom?: string };

            if (freshRow) {
                setDrafts((prev) => {
                    const prevDraft = prev[l.id] ?? d;
                    return {
                        ...prev,
                        [l.id]: {
                            qty: Number(freshRow.qty || 0),
                            unit_price: Number(freshRow.unit_price || 0),
                            total: Number(
                                freshRow.total_amount ??
                                Number(freshRow.qty || 0) *
                                Number(freshRow.unit_price || 0)
                            ),
                            uom: freshRow.uom ?? prevDraft.uom ?? '',
                            dirty: false,
                            saving: false,
                        },
                    };
                });
            } else {
                updateDraftRow(l.id, { saving: false, dirty: false });
            }
        } catch (e: any) {
            setMsg(e?.message ?? 'Failed to save line.');
            updateDraftRow(l.id, { saving: false });
        }
    }

    function revertRow(l: ProcurementDetail) {
        const existing = drafts[l.id];
        setDrafts((prev) => ({
            ...prev,
            [l.id]: {
                qty: Number(l.qty || 0),
                unit_price: Number(l.unit_price || 0),
                total: Number(
                    l.total_amount ??
                    Number(l.qty || 0) * Number(l.unit_price || 0)
                ),
                uom: (l as any).uom ?? existing?.uom ?? '',
                dirty: false,
            },
        }));
    }

    const total =
        master?.total_amount ??
        details.reduce(
            (a, b) =>
                a +
                Number(
                    b.total_amount ??
                    Number(b.qty || 0) * Number(b.unit_price || 0)
                ),
            0
        );

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div className="text-2xl font-semibold">Procurement Details</div>
                <div className="flex gap-2">
                    <Link
                        href="/app/procurement"
                        className="rounded-xl px-3 py-2 border"
                    >
                        Back
                    </Link>
                    <Link
                        href={`/app/procurement/${id}/print`}
                        className="rounded-xl px-3 py-2 border"
                    >
                        Print
                    </Link>

                    {canGeneratePO && (
                        <button
                            className="rounded-xl px-3 py-2 bg-indigo-600 text-white disabled:opacity-50"
                            onClick={onGeneratePO}
                            disabled={busy}
                            title="Generate Purchase Order"
                        >
                            {busy ? 'Working…' : 'Generate PO'}
                        </button>
                    )}

                    {hasPO && (
                        <Link
                            href={`/app/procurement/po/${master?.po_no}`}
                            className="rounded-xl px-3 py-2 border"
                            title="Open this Purchase Order"
                        >
                            View PO
                        </Link>
                    )}

                    <button
                        className="rounded-xl px-3 py-2 bg-emerald-600 text-white disabled:opacity-50"
                        onClick={onApprove}
                        disabled={!canApprove || busy}
                        title={
                            canApprove
                                ? 'Approve this procurement'
                                : 'Already approved'
                        }
                    >
                        {busy
                            ? 'Working…'
                            : master?.isApproved
                                ? 'Approved'
                                : 'Approve'}
                    </button>
                </div>
            </div>

            {msg && (
                <div
                    className={`rounded-xl border p-3 ${
                        msg.toLowerCase().includes('approved') ||
                        msg.toLowerCase().includes('po created')
                            ? 'bg-emerald-50 border-emerald-200'
                            : 'bg-slate-50 border-slate-200'
                    }`}
                >
                    <div className="text-sm">{msg}</div>
                </div>
            )}

            {/* Header Card */}
            <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b text-sm font-semibold">
                    Header
                </div>
                <div className="p-4 grid md:grid-cols-3 gap-3 text-sm">
                    <Info label="PO No" value={poNumber || ''} />
                    <Info label="PR No" value={master?.procurement_no ?? ''} />
                    <Info label="Lead Date" value={master?.lead_date ?? ''} />
                    <Info
                        label="Status"
                        value={`${master?.status ?? ''}${
                            master?.isApproved ? ' (Approved)' : ''
                        }`}
                    />
                    <Info
                        label="Supplier"
                        value={
                            supplier?.supplier_name ??
                            `#${master?.supplier_id ?? ''}`
                        }
                    />
                    <Info
                        label="Payment Terms"
                        value={(supplier as any)?.payment_terms ?? ''}
                    />
                    <Info
                        label="TIN"
                        value={(supplier as any)?.tin_number ?? ''}
                    />
                    <Info
                        label="Email"
                        value={supplier?.email_address ?? ''}
                    />
                    <Info
                        label="Phone"
                        value={(supplier as any)?.phone_number ?? ''}
                    />
                    <Info
                        label="Address"
                        value={supplier?.address ?? ''}
                    />
                </div>
            </div>

            {/* Lines */}
            <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b text-sm font-semibold">
                    Items
                </div>
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
                            return (
                                <tr key={l.id} className="border-t">
                                    <td className="p-3">
                                        {(l.item_template_id &&
                                                itemNames[l.item_template_id]) ||
                                            '—'}
                                    </td>
                                    <td className="p-3">
                                        {(l.item_variant_id &&
                                                variantNames[l.item_variant_id]) ||
                                            '—'}
                                    </td>

                                    <td className="p-3 min-w-40">
                                        <select
                                            className="rounded-xl border px-3 py-2 w-full"
                                            value={d?.uom ?? ''}
                                            onChange={(e) =>
                                                updateDraftRow(l.id, {
                                                    uom: e.target.value,
                                                })
                                            }
                                            disabled={approved || saving}
                                        >
                                            <option value="">
                                                Select UOM
                                            </option>
                                            {units.map((u) => (
                                                <option
                                                    key={u.unit_id}
                                                    value={u.unit_name}
                                                >
                                                    {u.unit_name}
                                                    {u.unit_shortcut
                                                        ? ` (${u.unit_shortcut})`
                                                        : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </td>

                                    <td className="p-3">
                                        <input
                                            type="number"
                                            min={1}
                                            className="rounded-xl border px-3 py-2 w-24"
                                            value={d?.qty ?? l.qty}
                                            onChange={(e) =>
                                                updateDraftRow(l.id, {
                                                    qty: Number(
                                                        e.target.value
                                                    ),
                                                })
                                            }
                                            disabled={approved || saving}
                                        />
                                    </td>

                                    <td className="p-3">
                                        <input
                                            type="number"
                                            step="0.01"
                                            min={0}
                                            className="rounded-xl border px-3 py-2 w-32"
                                            value={
                                                d?.unit_price ??
                                                l.unit_price
                                            }
                                            onChange={(e) =>
                                                updateDraftRow(l.id, {
                                                    unit_price: Number(
                                                        e.target.value
                                                    ),
                                                })
                                            }
                                            disabled={approved || saving}
                                        />
                                    </td>

                                    <td className="p-3 font-medium">
                                        ₱{' '}
                                        {(
                                            d?.total ??
                                            (l.total_amount ||
                                                Number(l.qty || 0) *
                                                Number(
                                                    l.unit_price || 0
                                                ))
                                        ).toFixed(2)}
                                    </td>

                                    <td className="p-3">
                                        {l.date_added}
                                    </td>
                                    <td className="p-3">
                                        {l.link ? (
                                            <a
                                                className="text-blue-600 underline"
                                                href={l.link}
                                                target="_blank"
                                            >
                                                file
                                            </a>
                                        ) : (
                                            '—'
                                        )}
                                    </td>

                                    <td className="p-3">
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                className="rounded-xl px-3 py-1 border disabled:opacity-50"
                                                onClick={() =>
                                                    revertRow(l)
                                                }
                                                disabled={
                                                    approved ||
                                                    !d?.dirty ||
                                                    saving
                                                }
                                                title="Revert changes"
                                            >
                                                Revert
                                            </button>
                                            <button
                                                type="button"
                                                className="rounded-xl px-3 py-1 bg-blue-600 text-white disabled:opacity-50"
                                                onClick={() =>
                                                    void saveRow(l)
                                                }
                                                disabled={
                                                    approved ||
                                                    !d?.dirty ||
                                                    saving
                                                }
                                                title="Save this line"
                                            >
                                                {saving
                                                    ? 'Saving…'
                                                    : 'Save'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {details.length === 0 && (
                            <tr>
                                <td
                                    colSpan={9}
                                    className="p-6 text-center text-slate-500"
                                >
                                    No lines.
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>

                <div className="px-4 py-3 border-t text-right text-sm">
                    Grand Total:&nbsp;
                    <b>₱ {Number(total || 0).toFixed(2)}</b>
                </div>
            </div>
        </div>
    );
}

function Info({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">
                {label}
            </div>
            <div className="font-medium text-slate-800">
                {value || '—'}
            </div>
        </div>
    );
}
