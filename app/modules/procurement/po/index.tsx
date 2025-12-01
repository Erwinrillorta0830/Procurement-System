'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type PurchaseOrder = {
    purchase_order_id: number;
    purchase_order_no: string;
    supplier_name: number;
    date: string;
    time?: string | null;
    total_amount?: number | null;
    inventory_status?: number | null;
};

type Supplier = { supplier_id: number; supplier_name: string };

type POItem = {
    po_item_id: number;
    purchase_order_id: number;
    item_name: string | null;
    item_description: string | null;
    item_template_id: number;
    item_variant_id?: number | null;
    uom: string;
    qty: string;
    unit_price: string;
    currency?: string | null;
    line_total?: string | null;
    line_subtotal?: string | null;
};

type Dept = { department_id: number; department_name: string };

type User = {
    user_id: number;
    user_fname?: string;
    user_lname?: string;
    full_name: string;
    user_department: number | null;
};

const DIRECTUS = process.env.NEXT_PUBLIC_DIRECTUS_URL as string;

const INVENTORY_STATUS = { PARTIAL: 5, FULL: 6 } as const;
const PO_STATUS_FIELD = 'inventory_status';

function statusLabel(code?: number | null) {
    if (code === INVENTORY_STATUS.FULL) return 'Fully Received';
    if (code === INVENTORY_STATUS.PARTIAL) return 'Partially Received';
    return 'Open';
}
function statusClass(code?: number | null) {
    if (code === INVENTORY_STATUS.FULL) return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
    if (code === INVENTORY_STATUS.PARTIAL) return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
    return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
}

/** Normalizes anything like "PO-001292" => "1292" for string-based matching */
function normalizePoNo(val: string | number | null | undefined): string {
    if (val == null) return '';
    const s = String(val).trim();
    const digits = s.replace(/\D+/g, '');
    if (digits.length) return digits.replace(/^0+/, '') || '0';
    return s;
}

// --- Data fetchers ------------------------------------------------------------

async function listPurchaseOrders(limit = 300): Promise<PurchaseOrder[]> {
    const res = await fetch(
        `${DIRECTUS}/items/purchase_order?sort[]=-purchase_order_id&limit=${limit}`,
        { cache: 'no-store' }
    );
    const json = await res.json();
    return json.data ?? [];
}

/** Get procurement-linked POs: both numeric IDs and normalized strings */
async function listProcurementPoNos(): Promise<{ idSet: Set<number>; strSet: Set<string> }> {
    const url = new URL(`${DIRECTUS}/items/procurement`);
    url.searchParams.set('fields', 'po_no');
    url.searchParams.set('limit', '-1');
    url.searchParams.set('filter', JSON.stringify({ po_no: { _nnull: true } }));
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return { idSet: new Set(), strSet: new Set() };

    const json = await res.json();
    const rows = (json?.data ?? []) as Array<{ po_no: number | string }>;
    const idSet = new Set<number>();
    const strSet = new Set<string>();
    for (const r of rows) {
        const n = Number(r.po_no);
        if (!Number.isNaN(n)) idSet.add(n);
        const norm = normalizePoNo(r.po_no);
        if (norm) strSet.add(norm);
    }
    return { idSet, strSet };
}

async function getPOHeader(poId: number): Promise<PurchaseOrder | null> {
    const res = await fetch(`${DIRECTUS}/items/purchase_order/${poId}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const j = await res.json();
    return j.data ?? null;
}

async function getSupplierById(id: number): Promise<Supplier | null> {
    const res = await fetch(`${DIRECTUS}/items/suppliers/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
}

async function getPOItems(poId: number): Promise<POItem[]> {
    const params = new URLSearchParams();
    params.set('filter', JSON.stringify({ purchase_order_id: { _eq: poId } }));
    params.set('sort[]', 'line_no');
    params.set('limit', '-1');
    const res = await fetch(`${DIRECTUS}/items/purchase_order_items?${params.toString()}`, {
        cache: 'no-store',
    });
    const json = await res.json();
    return json.data ?? [];
}

// receiving helpers
async function listReceivingsByPO(poId: number): Promise<{ id: number }[]> {
    const url = new URL(`${DIRECTUS}/items/receiving`);
    url.searchParams.set('fields', 'id');
    url.searchParams.set('limit', '-1');
    url.searchParams.set('filter', JSON.stringify({ purchase_order_id: { _eq: poId } }));
    const res = await fetch(url.toString(), { cache: 'no-store' });
    const json = await res.json();
    return (json.data ?? []).map((x: any) => ({ id: Number(x.id) }));
}
async function listReceivingLinesByReceivingIds(
    receivingIds: number[]
): Promise<Array<{ po_item_id: number; qty_received: number }>> {
    if (!receivingIds.length) return [];
    const url = new URL(`${DIRECTUS}/items/receiving_item_lines`);
    url.searchParams.set('limit', '-1');
    url.searchParams.set('filter', JSON.stringify({ receiving_id: { _in: receivingIds } }));
    url.searchParams.set('fields', 'po_item_id,qty_received');
    const res = await fetch(url.toString(), { cache: 'no-store' });
    const json = await res.json();
    const rows = json.data ?? [];
    return rows.map((r: any) => ({
        po_item_id: Number(r.po_item_id),
        qty_received: Number(r.qty_received || 0),
    }));
}
async function getAlreadyReceivedMap(poId: number): Promise<Record<number, number>> {
    const recs = await listReceivingsByPO(poId);
    const ids = recs.map((r) => r.id);
    const lines = await listReceivingLinesByReceivingIds(ids);
    const map: Record<number, number> = {};
    for (const l of lines) {
        map[l.po_item_id] = (map[l.po_item_id] || 0) + Number(l.qty_received || 0);
    }
    return map;
}

// Departments / Users
async function getDepartments(): Promise<Dept[]> {
    const res = await fetch(
        `${DIRECTUS}/items/department?limit=-1&fields=department_id,department_name`,
        { cache: 'no-store' }
    );
    const json = await res.json();
    const rows = json.data ?? [];
    return rows.map((d: any) => ({
        department_id: Number(d.department_id ?? 0),
        department_name: String(d.department_name ?? 'Unnamed'),
    }));
}
async function getUsers(): Promise<User[]> {
    const res = await fetch(
        `${DIRECTUS}/items/user?limit=-1&fields=user_id,user_department,user_fname,user_lname,user_email`,
        { cache: 'no-store' }
    );
    const json = await res.json();
    const rows = json.data ?? [];
    return rows.map((u: any) => {
        const fname = u.user_fname ?? '';
        const lname = u.user_lname ?? '';
        const full =
            [fname, lname].filter(Boolean).join(' ').trim() || (u.user_email ?? `#${u.user_id ?? ''}`);
        return {
            user_id: Number(u.user_id ?? 0),
            user_fname: fname,
            user_lname: lname,
            full_name: full,
            user_department: u.user_department != null ? Number(u.user_department) : null,
        };
    });
}

// POST/PATCH helpers
async function createReceiving(payload: {
    purchase_order_id: number;
    received_by: number;
    received_date?: string;
    reference_no?: string | null;
    notes?: string | null;
}) {
    const res = await fetch(`${DIRECTUS}/items/receiving`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to create receiving');
    const json = await res.json();
    return json.data;
}
async function createReceivingLine(payload: {
    receiving_id: number;
    po_item_id: number;
    item_template_id: number;
    item_variant_id?: number | null;
    uom: string;
    qty_received: number;
    unit_cost: number;
    currency?: string | null;
    received_at?: string;
    notes?: string | null;
}) {
    const res = await fetch(`${DIRECTUS}/items/receiving_item_lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to create receiving line');
    const json = await res.json();
    return json.data;
}
async function createAssignments(rows: Array<{
    receiving_item_line_id: number;
    department_id: number;
    user_id?: number | null;
    qty_assigned: number;
    assigned_at?: string;
    assigned_by: number;
    notes?: string | null;
}>) {
    if (!rows.length) return [];
    const res = await fetch(`${DIRECTUS}/items/item_assignment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows),
    });
    if (!res.ok) throw new Error('Failed to create item assignments');
    const json = await res.json();
    return json.data;
}
async function updatePurchaseOrderStatus(poId: number, statusCode: number) {
    const res = await fetch(`${DIRECTUS}/items/purchase_order/${poId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [PO_STATUS_FIELD]: statusCode }),
    });
    if (!res.ok) throw new Error('Failed to update PO status');
    return (await res.json()).data;
}

// --- Receive & Assign Dialog --------------------------------------------------

function ReceiveAssignDialog({
                                 open,
                                 onClose,
                                 poId,
                                 poItems,
                                 currentUserId,
                             }: {
    open: boolean;
    onClose: () => void;
    poId: number;
    poItems: POItem[];
    currentUserId: number;
}) {
    const [departments, setDepartments] = useState<Dept[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [referenceNo, setReferenceNo] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [receivedMap, setReceivedMap] = useState<Record<number, number>>({});

    type Split = { department_id: number; user_id: number | null; qty: number };
    type Row = {
        key: string;
        po_item_id: number;
        item_template_id: number;
        item_variant_id?: number | null;
        item_name: string;
        uom: string;
        ordered_qty: number;
        unit_cost: number;
        currency: string | null;
        received_so_far: number;
        remaining: number;
        received_today: number;
        splits: Split[];
    };

    const baseRows = useMemo<Row[]>(
        () =>
            (poItems || []).map((it) => ({
                key: String(it.po_item_id),
                po_item_id: it.po_item_id,
                item_template_id: it.item_template_id,
                item_variant_id: it.item_variant_id ?? null,
                item_name: it.item_name ?? 'Item',
                uom: it.uom,
                ordered_qty: Number(it.qty ?? 0),
                unit_cost: Number(it.unit_price ?? 0),
                currency: it.currency ?? 'PHP',
                received_so_far: 0,
                remaining: Number(it.qty ?? 0),
                received_today: 0,
                splits: [],
            })),
        [poItems]
    );

    const [rows, setRows] = useState<Row[]>([]);

    useEffect(() => {
        if (!open) return;

        (async () => {
            const [d, u, recMap] = await Promise.all([getDepartments(), getUsers(), getAlreadyReceivedMap(poId)]);
            setDepartments(d);
            setUsers(u);

            const computed = baseRows
                .map((r) => {
                    const sofar = Number(recMap[r.po_item_id] || 0);
                    const remaining = Math.max(0, r.ordered_qty - sofar);
                    return { ...r, received_so_far: sofar, remaining, received_today: 0, splits: [] };
                })
                .filter((r) => r.remaining > 0);

            setRows(computed);
            setReceivedMap(recMap);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, poId]);

    function patchRow(key: string, patch: Partial<Row>) {
        setRows((prev) =>
            prev.map((r) => {
                if (r.key !== key) return r;
                const next = { ...r, ...patch };
                if ('received_today' in patch) {
                    const val = Number((patch as any).received_today || 0);
                    next.received_today = Math.max(0, Math.min(r.remaining, val));
                }
                return next;
            })
        );
    }

    function addSplit(key: string) {
        setRows((prev) =>
            prev.map((r) =>
                r.key === key
                    ? {
                        ...r,
                        splits: [
                            ...r.splits,
                            { department_id: departments[0]?.department_id ?? 0, user_id: null, qty: 0 },
                        ],
                    }
                    : r
            )
        );
    }

    function updateSplit(key: string, idx: number, patch: Partial<Split>) {
        setRows((prev) =>
            prev.map((r) => {
                if (r.key !== key) return r;
                const old = r.splits[idx];
                let nextSplit: Split = { ...old, ...patch, qty: Number(patch.qty ?? old.qty) };

                if (patch.department_id != null && nextSplit.user_id != null) {
                    const chosenUser = users.find((u) => u.user_id === nextSplit.user_id);
                    if (chosenUser && Number(chosenUser.user_department ?? -1) !== Number(patch.department_id)) {
                        nextSplit.user_id = null;
                    }
                }

                const nextSplits = r.splits.map((s, i) => (i === idx ? nextSplit : s));
                return { ...r, splits: nextSplits };
            })
        );
    }

    function removeSplit(key: string, idx: number) {
        setRows((prev) => prev.map((r) => (r.key === key ? { ...r, splits: r.splits.filter((_, i) => i !== idx) } : r)));
    }

    const valid = useMemo(() => {
        for (const r of rows) {
            if (r.received_today > r.remaining) return false;
            if (r.received_today < 0) return false;
            const sum = r.splits.reduce((t, s) => t + (Number(s.qty) || 0), 0);
            if (sum !== Number(r.received_today || 0)) return false;
        }
        return true;
    }, [rows]);

    const hasWork = useMemo(() => rows.some((r) => Number(r.received_today) > 0), [rows]);
    const allItemsFulfilled = rows.length === 0;

    async function handleSave() {
        try {
            setSaving(true);

            if (!rows.some((r) => r.received_today > 0)) {
                alert('Nothing to receive.');
                return;
            }

            const hdr = await createReceiving({
                purchase_order_id: poId,
                received_by: currentUserId,
                reference_no: referenceNo || undefined,
                notes: notes || undefined,
            });

            for (const r of rows) {
                if (!r.received_today || r.received_today <= 0) continue;

                const qtyToSave = Math.max(0, Math.min(r.remaining, Number(r.received_today)));

                const ril = await createReceivingLine({
                    receiving_id: hdr.id,
                    po_item_id: r.po_item_id,
                    item_template_id: r.item_template_id,
                    ...(r.item_variant_id ? { item_variant_id: r.item_variant_id } : {}),
                    uom: r.uom,
                    qty_received: qtyToSave,
                    unit_cost: Number(r.unit_cost),
                    currency: r.currency ?? 'PHP',
                });

                const assignments = r.splits.map((s) => ({
                    receiving_item_line_id: ril.id,
                    department_id: Number(s.department_id),
                    user_id: s.user_id ? Number(s.user_id) : null,
                    qty_assigned: Number(s.qty),
                    assigned_by: currentUserId,
                }));
                if (assignments.length) await createAssignments(assignments);
            }

            const latestMap = await getAlreadyReceivedMap(poId);
            const combined: Record<number, number> = { ...receivedMap };
            for (const [k, v] of Object.entries(latestMap)) combined[Number(k)] = Number(v);

            const allFulfilled = (poItems || []).every((it) => {
                const ordered = Number(it.qty || 0);
                const got = Number(combined[it.po_item_id] || 0);
                return got >= ordered;
            });

            await updatePurchaseOrderStatus(poId, allFulfilled ? INVENTORY_STATUS.FULL : INVENTORY_STATUS.PARTIAL);

            onClose();
        } catch (e: any) {
            alert(e?.message || 'Failed to save receiving');
        } finally {
            setSaving(false);
        }
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center p-4">
            <div className="w-full max-w-5xl rounded-2xl bg-white shadow-xl border">
                <div className="px-5 py-4 border-b flex items-center justify-between">
                    <div className="text-base font-semibold">Receive & Assign Items</div>
                    <button className="text-slate-500 hover:text-slate-700" onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <label className="text-sm">Reference No</label>
                            <input
                                className="mt-1 w-full rounded-lg border px-3 py-2"
                                placeholder="DR / SI"
                                value={referenceNo}
                                onChange={(e) => setReferenceNo(e.target.value)}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-sm">Notes</label>
                            <input
                                className="mt-1 w-full rounded-lg border px-3 py-2"
                                placeholder="Remarks"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    {allItemsFulfilled && (
                        <div className="rounded-xl border p-4 text-sm bg-slate-50">
                            All items in this PO are fully received. There’s nothing left to receive.
                        </div>
                    )}

                    {!allItemsFulfilled &&
                        rows.map((r) => (
                            <div key={r.key} className="rounded-2xl border p-4 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div className="font-medium">
                                        {r.item_name || 'Item'} <span className="text-xs text-slate-500">• {r.uom}</span>
                                    </div>
                                    <div className="text-xs text-slate-600 space-x-3">
                                        <span>Ordered: <b>{r.ordered_qty}</b></span>
                                        <span>Received: <b>{r.received_so_far}</b></span>
                                        <span>Remaining: <b>{r.remaining}</b></span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
                                    <div>
                                        <label className="text-sm">Qty Received</label>
                                        <input
                                            type="number"
                                            min={0}
                                            max={r.remaining}
                                            step="0.0001"
                                            className="mt-1 w-full rounded-lg border px-3 py-2"
                                            value={r.received_today}
                                            onChange={(e) => {
                                                const v = Number(e.target.value || 0);
                                                const clamped = Math.max(0, Math.min(r.remaining, v));
                                                patchRow(r.key, { received_today: clamped });
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm">Unit Cost</label>
                                        <input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            className="mt-1 w-full rounded-lg border px-3 py-2"
                                            value={r.unit_cost}
                                            onChange={(e) => patchRow(r.key, { unit_cost: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm">Currency</label>
                                        <input
                                            className="mt-1 w-full rounded-lg border px-3 py-2"
                                            value={r.currency ?? 'PHP'}
                                            onChange={(e) => patchRow(r.key, { currency: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex items-end justify-end">
                                        <button className="rounded-lg px-3 py-2 border hover:bg-slate-50" onClick={() => addSplit(r.key)} disabled={r.remaining <= 0}>
                                            Add Split
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-3 space-y-2">
                                    {r.splits.map((s, idx) => {
                                        const filteredUsers = users.filter(
                                            (u) => Number(u.user_department ?? -1) === Number(s.department_id)
                                        );

                                        return (
                                            <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                                                <div className="md:col-span-2">
                                                    <label className="text-sm">Department</label>
                                                    <select
                                                        className="mt-1 w-full rounded-lg border px-3 py-2"
                                                        value={s.department_id}
                                                        onChange={(e) => updateSplit(r.key, idx, { department_id: Number(e.target.value) })}
                                                    >
                                                        {departments.map((d) => (
                                                            <option key={d.department_id} value={d.department_id}>
                                                                {d.department_name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div className="md:col-span-2">
                                                    <label className="text-sm">User (optional)</label>
                                                    <select
                                                        className="mt-1 w-full rounded-lg border px-3 py-2"
                                                        value={s.user_id ?? ''}
                                                        onChange={(e) =>
                                                            updateSplit(r.key, idx, { user_id: e.target.value ? Number(e.target.value) : null })
                                                        }
                                                    >
                                                        <option value="">Unassigned</option>
                                                        {filteredUsers.map((u) => (
                                                            <option key={u.user_id} value={u.user_id}>
                                                                {u.full_name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="text-sm">Qty</label>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={r.received_today}
                                                        step="0.0001"
                                                        className="mt-1 w-full rounded-lg border px-3 py-2"
                                                        value={s.qty}
                                                        onChange={(e) => {
                                                            const v = Number(e.target.value || 0);
                                                            updateSplit(r.key, idx, { qty: Math.max(0, Math.min(r.received_today, v)) });
                                                        }}
                                                    />
                                                </div>

                                                <div className="flex justify-end">
                                                    <button className="rounded-lg px-3 py-2 hover:bg-slate-50" onClick={() => removeSplit(r.key, idx)}>
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="mt-2 text-xs text-slate-500">
                                    Sum of splits must equal Qty Received. You cannot receive beyond Remaining.
                                </div>
                            </div>
                        ))}
                </div>

                <div className="px-5 py-4 border-t flex items-center justify-end gap-2">
                    <button className="rounded-lg px-3 py-2 hover:bg-slate-50" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className="rounded-lg px-3 py-2 bg-black text-white disabled:opacity-50"
                        disabled={!valid || !hasWork || saving || allItemsFulfilled}
                        onClick={handleSave}
                        title={allItemsFulfilled ? 'All items fully received' : undefined}
                    >
                        {saving ? 'Saving…' : 'Save Receiving'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- Main PO list + details + items ------------------------------------------

export default function POList() {
    const [pos, setPOs] = useState<PurchaseOrder[]>([]);
    const [supMap, setSupMap] = useState<Record<number, Supplier>>({});
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [poHeader, setPoHeader] = useState<PurchaseOrder | null>(null);

    const [items, setItems] = useState<POItem[]>([]);
    const [recvMap, setRecvMap] = useState<Record<number, number>>({});
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string>('');
    const [receiveOpen, setReceiveOpen] = useState(false);

    const [statusFilter, setStatusFilter] = useState<'ALL' | 'PARTIAL' | 'FULL'>('ALL');

    const currentUserId = 223;

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);

                // 1) Get procurement-linked PO numbers (id & normalized strings)
                const { idSet, strSet } = await listProcurementPoNos();

                // 2) Load POs then filter by purchase_order_id or purchase_order_no
                const list = await listPurchaseOrders(300);
                const filtered = list.filter((p) => {
                    const byId = idSet.has(Number(p.purchase_order_id));
                    if (byId) return true;
                    const byNo = strSet.has(normalizePoNo(p.purchase_order_no));
                    return byNo;
                });

                setPOs(filtered);
                setSelectedId(filtered.length ? filtered[0].purchase_order_id : null);

                // 3) Supplier map for filtered list
                const supplierIds = Array.from(new Set(filtered.map((p) => p.supplier_name).filter(Boolean))) as number[];
                const map: Record<number, Supplier> = {};
                await Promise.all(
                    supplierIds.map(async (id) => {
                        const s = await getSupplierById(id);
                        if (s) map[id] = s as Supplier;
                    })
                );
                setSupMap(map);
            } catch (e: any) {
                setErr(e?.message || 'Failed to load POs');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    useEffect(() => {
        (async () => {
            if (!selectedId) {
                setItems([]);
                setPoHeader(null);
                setRecvMap({});
                return;
            }
            try {
                setLoading(true);
                const [hdr, itms, rmap] = await Promise.all([getPOHeader(selectedId), getPOItems(selectedId), getAlreadyReceivedMap(selectedId)]);
                setPoHeader(hdr);
                setItems(itms);
                setRecvMap(rmap);
            } catch (e: any) {
                setErr(e?.message || 'Failed to load PO details');
            } finally {
                setLoading(false);
            }
        })();
    }, [selectedId]);

    const totalAmountSum = useMemo(() => pos.reduce((a, b) => a + Number(b.total_amount || 0), 0), [pos]);

    const filteredPos = useMemo(() => {
        if (statusFilter === 'ALL') return pos;
        if (statusFilter === 'FULL') return pos.filter((p) => p.inventory_status === INVENTORY_STATUS.FULL);
        return pos.filter((p) => p.inventory_status === INVENTORY_STATUS.PARTIAL);
    }, [pos, statusFilter]);

    const orderedTotal = useMemo(() => items.reduce((t, r) => t + Number(r.qty || 0), 0), [items]);
    const receivedTotal = useMemo(
        () => items.reduce((t, r) => t + Math.min(Number(r.qty || 0), Number(recvMap[r.po_item_id] || 0)), 0),
        [items, recvMap]
    );
    const remainingTotal = Math.max(0, orderedTotal - receivedTotal);
    const progress = orderedTotal > 0 ? Math.min(1, receivedTotal / orderedTotal) : 0;

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Purchase Orders</h1>
                <Link href="/app/procurement" className="rounded-xl px-3 py-2 border">
                    Back to Procurements
                </Link>
            </div>

            {err && <div className="text-sm rounded border p-2 bg-slate-50">{err}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: PO list */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="px-4 py-3 border-b flex items-center justify-between">
                        <div className="text-sm font-semibold">POs (Linked to Procurement)</div>
                        <div className="flex items-center gap-2">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                                className="text-xs rounded-lg border px-2 py-1"
                                title="Filter by status"
                            >
                                <option value="ALL">All</option>
                                <option value="PARTIAL">Partial</option>
                                <option value="FULL">Full</option>
                            </select>
                        </div>
                    </div>

                    <ul className="max-h-[420px] overflow-auto divide-y">
                        {filteredPos.map((p) => {
                            const active = selectedId === p.purchase_order_id;
                            const sup = supMap[p.supplier_name];
                            return (
                                <li
                                    key={p.purchase_order_id}
                                    className={`px-4 py-3 cursor-pointer hover:bg-slate-50 ${active ? 'bg-slate-50' : ''}`}
                                    onClick={() => setSelectedId(p.purchase_order_id)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="font-medium flex items-center gap-2">
                                            {p.purchase_order_no}
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusClass(p.inventory_status)}`}>
                        {statusLabel(p.inventory_status)}
                      </span>
                                        </div>
                                        <div className="text-xs text-slate-500">₱ {Number(p.total_amount || 0).toFixed(2)}</div>
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        {p.date} {p.time ? `· ${p.time}` : ''} · {sup?.supplier_name ?? `#${p.supplier_name}`}
                                    </div>
                                </li>
                            );
                        })}
                        {filteredPos.length === 0 && (
                            <li className="px-4 py-6 text-sm text-slate-500">{loading ? 'Loading…' : 'No POs linked to Procurement.'}</li>
                        )}
                    </ul>
                    <div className="px-4 py-2 border-t text-xs text-slate-600">
                        Count: <b>{filteredPos.length}</b> · Total: <b>₱ {totalAmountSum.toFixed(2)}</b>
                    </div>
                </div>

                {/* Right: Details + Items */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Overview Card */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="px-4 py-4 border-b flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="text-lg font-semibold">{poHeader?.purchase_order_no ?? '—'}</div>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusClass(poHeader?.inventory_status)}`}>
                  {statusLabel(poHeader?.inventory_status)}
                </span>
                            </div>
                            <div className="text-sm text-slate-600">
                                {poHeader?.date ?? '—'} {poHeader?.time ? `· ${poHeader.time}` : ''}
                            </div>
                        </div>

                        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="rounded-xl border p-3">
                                <div className="text-xs text-slate-500">Supplier</div>
                                <div className="font-medium">
                                    {poHeader?.supplier_name != null
                                        ? supMap[poHeader.supplier_name]?.supplier_name ?? `#${poHeader.supplier_name}`
                                        : '—'}
                                </div>
                            </div>

                            <div className="rounded-xl border p-3">
                                <div className="text-xs text-slate-500">Total Amount</div>
                                <div className="font-medium">₱ {Number(poHeader?.total_amount ?? 0).toFixed(2)}</div>
                            </div>

                            <div className="rounded-xl border p-3">
                                <div className="text-xs text-slate-500">Lines</div>
                                <div className="font-medium">{items.length}</div>
                            </div>

                            <div className="md:col-span-3 rounded-xl border p-3">
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                    <span>Receiving Progress</span>
                                    <span>
                    {receivedTotal}/{orderedTotal} received • Remaining {remainingTotal}
                  </span>
                                </div>
                                <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                                    <div className="h-2 bg-emerald-500" style={{ width: `${Math.round(progress * 100)}%` }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="px-4 py-3 border-b flex items-center justify-between">
                            <div className="text-sm font-semibold">Items</div>
                            <div className="flex items-center gap-2">
                                <button
                                    className="rounded-lg px-3 py-2 border hover:bg-slate-50"
                                    onClick={() => setReceiveOpen(true)}
                                    disabled={!selectedId || items.length === 0}
                                >
                                    Receive & Assign
                                </button>
                            </div>
                        </div>

                        <div className="overflow-auto">
                            <table className="w-full text-sm">
                                <thead>
                                <tr className="text-left bg-slate-50">
                                    <th className="p-3">Item</th>
                                    <th className="p-3">UOM</th>
                                    <th className="p-3">Ordered</th>
                                    <th className="p-3">Received</th>
                                    <th className="p-3">Remaining</th>
                                    <th className="p-3">Unit Cost</th>
                                    <th className="p-3">Line Total</th>
                                </tr>
                                </thead>
                                <tbody>
                                {items.map((r) => {
                                    const ordered = Number(r.qty || 0);
                                    const got = Number(recvMap[r.po_item_id] || 0);
                                    const remaining = Math.max(0, ordered - got);
                                    return (
                                        <tr key={r.po_item_id} className="border-t">
                                            <td className="p-3 font-medium">
                                                {r.item_name || '(No Name)'}
                                                {r.item_description ? <div className="text-xs text-slate-500">{r.item_description}</div> : null}
                                            </td>
                                            <td className="p-3">{r.uom}</td>
                                            <td className="p-3">{ordered.toLocaleString()}</td>
                                            <td className="p-3">{got.toLocaleString()}</td>
                                            <td className="p-3">{remaining.toLocaleString()}</td>
                                            <td className="p-3">₱ {Number(r.unit_price).toFixed(2)}</td>
                                            <td className="p-3">₱ {Number(r.line_total ?? Number(r.unit_price) * Number(r.qty)).toFixed(2)}</td>
                                        </tr>
                                    );
                                })}
                                {items.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="p-6 text-center text-slate-500">
                                            {selectedId ? 'No items.' : 'Select a PO.'}
                                        </td>
                                    </tr>
                                )}
                                </tbody>
                            </table>
                        </div>

                        {loading && <div className="px-4 py-3 border-t text-sm">Loading…</div>}
                    </div>
                </div>
            </div>

            {receiveOpen && selectedId && (
                <ReceiveAssignDialog
                    open={receiveOpen}
                    onClose={() => setReceiveOpen(false)}
                    poId={selectedId}
                    poItems={items}
                    currentUserId={currentUserId}
                />
            )}
        </div>
    );
}
