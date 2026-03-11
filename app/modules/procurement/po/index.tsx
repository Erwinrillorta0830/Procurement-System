"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type PurchaseOrder = {
    purchase_order_id: number;
    purchase_order_no: string;
    supplier_name: number;
    date: string;
    time?: string | null;
    total_amount?: number | null;
    inventory_status?: number | null;
};

type Supplier = {
    supplier_id: number;
    supplier_name: string;
};

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

type Dept = {
    department_id: number;
    department_name: string;
};

type User = {
    user_id: number;
    user_fname?: string;
    user_lname?: string;
    full_name: string;
    user_department: number | null;
};

type ReceivingHeaderRow = {
    id: number;
};

type ReceivingLineRow = {
    po_item_id: number;
    qty_received: number;
};

type DirectusListResponse<T> = {
    data?: T[];
};

type DirectusItemResponse<T> = {
    data?: T;
};

const INVENTORY_STATUS = { PARTIAL: 5, FULL: 6 } as const;
const PO_STATUS_FIELD = "inventory_status";

function statusLabel(code?: number | null): string {
    if (code === INVENTORY_STATUS.FULL) return "Fully Received";
    if (code === INVENTORY_STATUS.PARTIAL) return "Partially Received";
    return "Open";
}

function statusClass(code?: number | null): string {
    if (code === INVENTORY_STATUS.FULL) {
        return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    }
    if (code === INVENTORY_STATUS.PARTIAL) {
        return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    }
    return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
}

function normalizePoNo(val: string | number | null | undefined): string {
    if (val == null) return "";
    const text = String(val).trim();
    const digits = text.replace(/\D+/g, "");
    if (digits.length) return digits.replace(/^0+/, "") || "0";
    return text;
}

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`/api/items/${path.replace(/^\/+/, "")}`, {
        ...init,
        cache: "no-store",
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
        },
    });

    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || `Request failed (${response.status})`);
    }

    return (await response.json()) as T;
}

// --- Data fetchers ------------------------------------------------------------

async function listPurchaseOrders(limit = 300): Promise<PurchaseOrder[]> {
    const json = await fetchJson<DirectusListResponse<PurchaseOrder>>(
        `purchase_order?sort[]=-purchase_order_id&limit=${limit}`
    );
    return json.data ?? [];
}

async function listProcurementPoNos(): Promise<{ idSet: Set<number>; strSet: Set<string> }> {
    const params = new URLSearchParams();
    params.set("fields", "po_no");
    params.set("limit", "-1");
    params.set("filter", JSON.stringify({ po_no: { _nnull: true } }));

    const json = await fetchJson<DirectusListResponse<{ po_no: number | string }>>(
        `procurement?${params.toString()}`
    );

    const rows = json.data ?? [];
    const idSet = new Set<number>();
    const strSet = new Set<string>();

    for (const row of rows) {
        const numericValue = Number(row.po_no);
        if (!Number.isNaN(numericValue)) idSet.add(numericValue);

        const normalized = normalizePoNo(row.po_no);
        if (normalized) strSet.add(normalized);
    }

    return { idSet, strSet };
}

async function getPOHeader(poId: number): Promise<PurchaseOrder | null> {
    try {
        const json = await fetchJson<DirectusItemResponse<PurchaseOrder>>(
            `purchase_order/${poId}`
        );
        return json.data ?? null;
    } catch {
        return null;
    }
}

async function getSupplierById(id: number): Promise<Supplier | null> {
    try {
        const json = await fetchJson<DirectusItemResponse<Supplier>>(`suppliers/${id}`);
        return json.data ?? null;
    } catch {
        return null;
    }
}

async function getPOItems(poId: number): Promise<POItem[]> {
    const params = new URLSearchParams();
    params.set("filter", JSON.stringify({ purchase_order_id: { _eq: poId } }));
    params.set("sort[]", "line_no");
    params.set("limit", "-1");

    const json = await fetchJson<DirectusListResponse<POItem>>(
        `purchase_order_items?${params.toString()}`
    );
    return json.data ?? [];
}

async function listReceivingsByPO(poId: number): Promise<ReceivingHeaderRow[]> {
    const params = new URLSearchParams();
    params.set("fields", "id");
    params.set("limit", "-1");
    params.set("filter", JSON.stringify({ purchase_order_id: { _eq: poId } }));

    const json = await fetchJson<DirectusListResponse<{ id: number | string }>>(
        `receiving?${params.toString()}`
    );

    return (json.data ?? []).map((row) => ({
        id: Number(row.id),
    }));
}

async function listReceivingLinesByReceivingIds(
    receivingIds: number[]
): Promise<ReceivingLineRow[]> {
    if (!receivingIds.length) return [];

    const params = new URLSearchParams();
    params.set("limit", "-1");
    params.set("filter", JSON.stringify({ receiving_id: { _in: receivingIds } }));
    params.set("fields", "po_item_id,qty_received");

    const json = await fetchJson<
        DirectusListResponse<{ po_item_id: number | string; qty_received: number | string | null }>
    >(`receiving_item_lines?${params.toString()}`);

    return (json.data ?? []).map((row) => ({
        po_item_id: Number(row.po_item_id),
        qty_received: Number(row.qty_received || 0),
    }));
}

async function getAlreadyReceivedMap(poId: number): Promise<Record<number, number>> {
    const receivings = await listReceivingsByPO(poId);
    const ids = receivings.map((row) => row.id);
    const lines = await listReceivingLinesByReceivingIds(ids);

    const result: Record<number, number> = {};
    for (const line of lines) {
        result[line.po_item_id] = (result[line.po_item_id] || 0) + Number(line.qty_received || 0);
    }

    return result;
}

async function getDepartments(): Promise<Dept[]> {
    const json = await fetchJson<
        DirectusListResponse<{ department_id: number | string; department_name: string | null }>
    >("department?limit=-1&fields=department_id,department_name");

    return (json.data ?? []).map((row) => ({
        department_id: Number(row.department_id ?? 0),
        department_name: String(row.department_name ?? "Unnamed"),
    }));
}

async function getUsers(): Promise<User[]> {
    const json = await fetchJson<
        DirectusListResponse<{
            user_id: number | string;
            user_department: number | string | null;
            user_fname?: string | null;
            user_lname?: string | null;
            user_email?: string | null;
        }>
    >("user?limit=-1&fields=user_id,user_department,user_fname,user_lname,user_email");

    return (json.data ?? []).map((row) => {
        const fname = row.user_fname ?? "";
        const lname = row.user_lname ?? "";
        const fullName =
            [fname, lname].filter(Boolean).join(" ").trim() ||
            row.user_email ||
            `#${row.user_id ?? ""}`;

        return {
            user_id: Number(row.user_id ?? 0),
            user_fname: fname || undefined,
            user_lname: lname || undefined,
            full_name: fullName,
            user_department:
                row.user_department != null ? Number(row.user_department) : null,
        };
    });
}

async function createReceiving(payload: {
    purchase_order_id: number;
    received_by: number;
    received_date?: string;
    reference_no?: string | null;
    notes?: string | null;
}): Promise<{ id: number }> {
    const json = await fetchJson<DirectusItemResponse<{ id: number }>>("receiving", {
        method: "POST",
        body: JSON.stringify(payload),
    });

    if (!json.data) {
        throw new Error("Failed to create receiving");
    }

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
}): Promise<{ id: number }> {
    const json = await fetchJson<DirectusItemResponse<{ id: number }>>(
        "receiving_item_lines",
        {
            method: "POST",
            body: JSON.stringify(payload),
        }
    );

    if (!json.data) {
        throw new Error("Failed to create receiving line");
    }

    return json.data;
}

async function createAssignments(
    rows: Array<{
        receiving_item_line_id: number;
        department_id: number;
        user_id?: number | null;
        qty_assigned: number;
        assigned_at?: string;
        assigned_by: number;
        notes?: string | null;
    }>
): Promise<unknown[]> {
    if (!rows.length) return [];

    const json = await fetchJson<DirectusListResponse<unknown>>("item_assignment", {
        method: "POST",
        body: JSON.stringify(rows),
    });

    return json.data ?? [];
}

async function updatePurchaseOrderStatus(
    poId: number,
    statusCode: number
): Promise<unknown> {
    const json = await fetchJson<DirectusItemResponse<unknown>>(
        `purchase_order/${poId}`,
        {
            method: "PATCH",
            body: JSON.stringify({ [PO_STATUS_FIELD]: statusCode }),
        }
    );

    return json.data;
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
    const [referenceNo, setReferenceNo] = useState("");
    const [notes, setNotes] = useState("");
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
            (poItems || []).map((item) => ({
                key: String(item.po_item_id),
                po_item_id: item.po_item_id,
                item_template_id: item.item_template_id,
                item_variant_id: item.item_variant_id ?? null,
                item_name: item.item_name ?? "Item",
                uom: item.uom,
                ordered_qty: Number(item.qty ?? 0),
                unit_cost: Number(item.unit_price ?? 0),
                currency: item.currency ?? "PHP",
                received_so_far: 0,
                remaining: Number(item.qty ?? 0),
                received_today: 0,
                splits: [],
            })),
        [poItems]
    );

    const [rows, setRows] = useState<Row[]>([]);

    useEffect(() => {
        if (!open) return;

        const load = async (): Promise<void> => {
            const [loadedDepartments, loadedUsers, recMap] = await Promise.all([
                getDepartments(),
                getUsers(),
                getAlreadyReceivedMap(poId),
            ]);

            setDepartments(loadedDepartments);
            setUsers(loadedUsers);

            const computed = baseRows
                .map((row) => {
                    const receivedSoFar = Number(recMap[row.po_item_id] || 0);
                    const remaining = Math.max(0, row.ordered_qty - receivedSoFar);

                    return {
                        ...row,
                        received_so_far: receivedSoFar,
                        remaining,
                        received_today: 0,
                        splits: [],
                    };
                })
                .filter((row) => row.remaining > 0);

            setRows(computed);
            setReceivedMap(recMap);
        };

        void load();
    }, [open, poId, baseRows]);

    function patchRow(
        key: string,
        patch: Partial<
            Row & {
            received_today: number;
        }
        >
    ): void {
        setRows((prev) =>
            prev.map((row) => {
                if (row.key !== key) return row;

                const next = { ...row, ...patch };

                if (patch.received_today !== undefined) {
                    const value = Number(patch.received_today || 0);
                    next.received_today = Math.max(0, Math.min(row.remaining, value));
                }

                return next;
            })
        );
    }

    function addSplit(key: string): void {
        setRows((prev) =>
            prev.map((row) =>
                row.key === key
                    ? {
                        ...row,
                        splits: [
                            ...row.splits,
                            {
                                department_id: departments[0]?.department_id ?? 0,
                                user_id: null,
                                qty: 0,
                            },
                        ],
                    }
                    : row
            )
        );
    }

    function updateSplit(key: string, idx: number, patch: Partial<Split>): void {
        setRows((prev) =>
            prev.map((row) => {
                if (row.key !== key) return row;

                const old = row.splits[idx];
                const nextSplit: Split = {
                    ...old,
                    ...patch,
                    qty: Number(patch.qty ?? old.qty),
                };

                if (patch.department_id != null && nextSplit.user_id != null) {
                    const chosenUser = users.find((user) => user.user_id === nextSplit.user_id);
                    if (
                        chosenUser &&
                        Number(chosenUser.user_department ?? -1) !==
                        Number(patch.department_id)
                    ) {
                        nextSplit.user_id = null;
                    }
                }

                const nextSplits = row.splits.map((split, i) =>
                    i === idx ? nextSplit : split
                );

                return { ...row, splits: nextSplits };
            })
        );
    }

    function removeSplit(key: string, idx: number): void {
        setRows((prev) =>
            prev.map((row) =>
                row.key === key
                    ? { ...row, splits: row.splits.filter((_, i) => i !== idx) }
                    : row
            )
        );
    }

    const valid = useMemo(() => {
        for (const row of rows) {
            if (row.received_today > row.remaining) return false;
            if (row.received_today < 0) return false;

            const sum = row.splits.reduce((total, split) => total + (Number(split.qty) || 0), 0);
            if (sum !== Number(row.received_today || 0)) return false;
        }
        return true;
    }, [rows]);

    const hasWork = useMemo(
        () => rows.some((row) => Number(row.received_today) > 0),
        [rows]
    );

    const allItemsFulfilled = rows.length === 0;

    async function handleSave(): Promise<void> {
        try {
            setSaving(true);

            if (!rows.some((row) => row.received_today > 0)) {
                alert("Nothing to receive.");
                return;
            }

            const header = await createReceiving({
                purchase_order_id: poId,
                received_by: currentUserId,
                reference_no: referenceNo || undefined,
                notes: notes || undefined,
            });

            for (const row of rows) {
                if (!row.received_today || row.received_today <= 0) continue;

                const qtyToSave = Math.max(
                    0,
                    Math.min(row.remaining, Number(row.received_today))
                );

                const receivingLine = await createReceivingLine({
                    receiving_id: header.id,
                    po_item_id: row.po_item_id,
                    item_template_id: row.item_template_id,
                    ...(row.item_variant_id ? { item_variant_id: row.item_variant_id } : {}),
                    uom: row.uom,
                    qty_received: qtyToSave,
                    unit_cost: Number(row.unit_cost),
                    currency: row.currency ?? "PHP",
                });

                const assignments = row.splits.map((split) => ({
                    receiving_item_line_id: receivingLine.id,
                    department_id: Number(split.department_id),
                    user_id: split.user_id ? Number(split.user_id) : null,
                    qty_assigned: Number(split.qty),
                    assigned_by: currentUserId,
                }));

                if (assignments.length) {
                    await createAssignments(assignments);
                }
            }

            const latestMap = await getAlreadyReceivedMap(poId);
            const combined: Record<number, number> = { ...receivedMap };

            for (const [key, value] of Object.entries(latestMap)) {
                combined[Number(key)] = Number(value);
            }

            const allFulfilled = (poItems || []).every((item) => {
                const ordered = Number(item.qty || 0);
                const got = Number(combined[item.po_item_id] || 0);
                return got >= ordered;
            });

            await updatePurchaseOrderStatus(
                poId,
                allFulfilled ? INVENTORY_STATUS.FULL : INVENTORY_STATUS.PARTIAL
            );

            onClose();
        } catch (error: unknown) {
            alert(getErrorMessage(error, "Failed to save receiving"));
        } finally {
            setSaving(false);
        }
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-5xl rounded-2xl border bg-white shadow-xl">
                <div className="flex items-center justify-between border-b px-5 py-4">
                    <div className="text-base font-semibold">Receive &amp; Assign Items</div>
                    <button
                        className="text-slate-500 hover:text-slate-700"
                        onClick={onClose}
                        type="button"
                    >
                        ✕
                    </button>
                </div>

                <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
                        <div className="rounded-xl border bg-slate-50 p-4 text-sm">
                            All items in this PO are fully received. There’s nothing left to
                            receive.
                        </div>
                    )}

                    {!allItemsFulfilled &&
                        rows.map((row) => (
                            <div key={row.key} className="rounded-2xl border p-4 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div className="font-medium">
                                        {row.item_name || "Item"}{" "}
                                        <span className="text-xs text-slate-500">
                                            • {row.uom}
                                        </span>
                                    </div>
                                    <div className="space-x-3 text-xs text-slate-600">
                                        <span>
                                            Ordered: <b>{row.ordered_qty}</b>
                                        </span>
                                        <span>
                                            Received: <b>{row.received_so_far}</b>
                                        </span>
                                        <span>
                                            Remaining: <b>{row.remaining}</b>
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                                    <div>
                                        <label className="text-sm">Qty Received</label>
                                        <input
                                            type="number"
                                            min={0}
                                            max={row.remaining}
                                            step="0.0001"
                                            className="mt-1 w-full rounded-lg border px-3 py-2"
                                            value={row.received_today}
                                            onChange={(e) => {
                                                const value = Number(e.target.value || 0);
                                                const clamped = Math.max(
                                                    0,
                                                    Math.min(row.remaining, value)
                                                );
                                                patchRow(row.key, { received_today: clamped });
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
                                            value={row.unit_cost}
                                            onChange={(e) =>
                                                patchRow(row.key, {
                                                    unit_cost: Number(e.target.value),
                                                })
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm">Currency</label>
                                        <input
                                            className="mt-1 w-full rounded-lg border px-3 py-2"
                                            value={row.currency ?? "PHP"}
                                            onChange={(e) =>
                                                patchRow(row.key, {
                                                    currency: e.target.value,
                                                })
                                            }
                                        />
                                    </div>
                                    <div className="flex items-end justify-end">
                                        <button
                                            className="rounded-lg border px-3 py-2 hover:bg-slate-50"
                                            onClick={() => addSplit(row.key)}
                                            disabled={row.remaining <= 0}
                                            type="button"
                                        >
                                            Add Split
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-3 space-y-2">
                                    {row.splits.map((split, idx) => {
                                        const filteredUsers = users.filter(
                                            (user) =>
                                                Number(user.user_department ?? -1) ===
                                                Number(split.department_id)
                                        );

                                        return (
                                            <div
                                                key={idx}
                                                className="grid grid-cols-1 items-end gap-3 md:grid-cols-6"
                                            >
                                                <div className="md:col-span-2">
                                                    <label className="text-sm">
                                                        Department
                                                    </label>
                                                    <select
                                                        className="mt-1 w-full rounded-lg border px-3 py-2"
                                                        value={split.department_id}
                                                        onChange={(e) =>
                                                            updateSplit(row.key, idx, {
                                                                department_id: Number(
                                                                    e.target.value
                                                                ),
                                                            })
                                                        }
                                                    >
                                                        {departments.map((department) => (
                                                            <option
                                                                key={department.department_id}
                                                                value={
                                                                    department.department_id
                                                                }
                                                            >
                                                                {
                                                                    department.department_name
                                                                }
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div className="md:col-span-2">
                                                    <label className="text-sm">
                                                        User (optional)
                                                    </label>
                                                    <select
                                                        className="mt-1 w-full rounded-lg border px-3 py-2"
                                                        value={split.user_id ?? ""}
                                                        onChange={(e) =>
                                                            updateSplit(row.key, idx, {
                                                                user_id: e.target.value
                                                                    ? Number(
                                                                        e.target.value
                                                                    )
                                                                    : null,
                                                            })
                                                        }
                                                    >
                                                        <option value="">Unassigned</option>
                                                        {filteredUsers.map((user) => (
                                                            <option
                                                                key={user.user_id}
                                                                value={user.user_id}
                                                            >
                                                                {user.full_name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="text-sm">Qty</label>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={row.received_today}
                                                        step="0.0001"
                                                        className="mt-1 w-full rounded-lg border px-3 py-2"
                                                        value={split.qty}
                                                        onChange={(e) => {
                                                            const value = Number(
                                                                e.target.value || 0
                                                            );
                                                            updateSplit(row.key, idx, {
                                                                qty: Math.max(
                                                                    0,
                                                                    Math.min(
                                                                        row.received_today,
                                                                        value
                                                                    )
                                                                ),
                                                            });
                                                        }}
                                                    />
                                                </div>

                                                <div className="flex justify-end">
                                                    <button
                                                        className="rounded-lg px-3 py-2 hover:bg-slate-50"
                                                        onClick={() =>
                                                            removeSplit(row.key, idx)
                                                        }
                                                        type="button"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="mt-2 text-xs text-slate-500">
                                    Sum of splits must equal Qty Received. You cannot receive
                                    beyond Remaining.
                                </div>
                            </div>
                        ))}
                </div>

                <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
                    <button
                        className="rounded-lg px-3 py-2 hover:bg-slate-50"
                        onClick={onClose}
                        type="button"
                    >
                        Cancel
                    </button>
                    <button
                        className="rounded-lg bg-black px-3 py-2 text-white disabled:opacity-50"
                        disabled={!valid || !hasWork || saving || allItemsFulfilled}
                        onClick={handleSave}
                        title={allItemsFulfilled ? "All items fully received" : undefined}
                        type="button"
                    >
                        {saving ? "Saving…" : "Save Receiving"}
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
    const [err, setErr] = useState<string>("");
    const [receiveOpen, setReceiveOpen] = useState(false);

    const [statusFilter, setStatusFilter] = useState<"ALL" | "PARTIAL" | "FULL">("ALL");

    const currentUserId = 223;

    useEffect(() => {
        const load = async (): Promise<void> => {
            try {
                setLoading(true);

                const { idSet, strSet } = await listProcurementPoNos();
                const list = await listPurchaseOrders(300);

                const filtered = list.filter((po) => {
                    const byId = idSet.has(Number(po.purchase_order_id));
                    if (byId) return true;

                    return strSet.has(normalizePoNo(po.purchase_order_no));
                });

                setPOs(filtered);
                setSelectedId(filtered.length ? filtered[0].purchase_order_id : null);

                const supplierIds = Array.from(
                    new Set(filtered.map((po) => po.supplier_name).filter(Boolean))
                ) as number[];

                const map: Record<number, Supplier> = {};
                await Promise.all(
                    supplierIds.map(async (supplierId) => {
                        const supplier = await getSupplierById(supplierId);
                        if (supplier) map[supplierId] = supplier;
                    })
                );

                setSupMap(map);
            } catch (error: unknown) {
                setErr(getErrorMessage(error, "Failed to load POs"));
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, []);

    useEffect(() => {
        const loadDetails = async (): Promise<void> => {
            if (!selectedId) {
                setItems([]);
                setPoHeader(null);
                setRecvMap({});
                return;
            }

            try {
                setLoading(true);

                const [header, loadedItems, receivedMap] = await Promise.all([
                    getPOHeader(selectedId),
                    getPOItems(selectedId),
                    getAlreadyReceivedMap(selectedId),
                ]);

                setPoHeader(header);
                setItems(loadedItems);
                setRecvMap(receivedMap);
            } catch (error: unknown) {
                setErr(getErrorMessage(error, "Failed to load PO details"));
            } finally {
                setLoading(false);
            }
        };

        void loadDetails();
    }, [selectedId]);

    const totalAmountSum = useMemo(
        () => pos.reduce((total, po) => total + Number(po.total_amount || 0), 0),
        [pos]
    );

    const filteredPos = useMemo(() => {
        if (statusFilter === "ALL") return pos;
        if (statusFilter === "FULL") {
            return pos.filter((po) => po.inventory_status === INVENTORY_STATUS.FULL);
        }
        return pos.filter((po) => po.inventory_status === INVENTORY_STATUS.PARTIAL);
    }, [pos, statusFilter]);

    const orderedTotal = useMemo(
        () => items.reduce((total, row) => total + Number(row.qty || 0), 0),
        [items]
    );

    const receivedTotal = useMemo(
        () =>
            items.reduce(
                (total, row) =>
                    total +
                    Math.min(
                        Number(row.qty || 0),
                        Number(recvMap[row.po_item_id] || 0)
                    ),
                0
            ),
        [items, recvMap]
    );

    const remainingTotal = Math.max(0, orderedTotal - receivedTotal);
    const progress = orderedTotal > 0 ? Math.min(1, receivedTotal / orderedTotal) : 0;

    return (
        <div className="space-y-4 p-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Purchase Orders</h1>
                <Link href="/app/procurement" className="rounded-xl border px-3 py-2">
                    Back to Procurements
                </Link>
            </div>

            {err && <div className="rounded border bg-slate-50 p-2 text-sm">{err}</div>}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b px-4 py-3">
                        <div className="text-sm font-semibold">
                            POs (Linked to Procurement)
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={statusFilter}
                                onChange={(e) =>
                                    setStatusFilter(
                                        e.target.value as "ALL" | "PARTIAL" | "FULL"
                                    )
                                }
                                className="rounded-lg border px-2 py-1 text-xs"
                                title="Filter by status"
                            >
                                <option value="ALL">All</option>
                                <option value="PARTIAL">Partial</option>
                                <option value="FULL">Full</option>
                            </select>
                        </div>
                    </div>

                    <ul className="max-h-[420px] divide-y overflow-auto">
                        {filteredPos.map((po) => {
                            const active = selectedId === po.purchase_order_id;
                            const supplier = supMap[po.supplier_name];

                            return (
                                <li
                                    key={po.purchase_order_id}
                                    className={`cursor-pointer px-4 py-3 hover:bg-slate-50 ${
                                        active ? "bg-slate-50" : ""
                                    }`}
                                    onClick={() => setSelectedId(po.purchase_order_id)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 font-medium">
                                            {po.purchase_order_no}
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-[10px] ${statusClass(
                                                    po.inventory_status
                                                )}`}
                                            >
                                                {statusLabel(po.inventory_status)}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            ₱ {Number(po.total_amount || 0).toFixed(2)}
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        {po.date} {po.time ? `· ${po.time}` : ""} ·{" "}
                                        {supplier?.supplier_name ?? `#${po.supplier_name}`}
                                    </div>
                                </li>
                            );
                        })}
                        {filteredPos.length === 0 && (
                            <li className="px-4 py-6 text-sm text-slate-500">
                                {loading
                                    ? "Loading…"
                                    : "No POs linked to Procurement."}
                            </li>
                        )}
                    </ul>

                    <div className="border-t px-4 py-2 text-xs text-slate-600">
                        Count: <b>{filteredPos.length}</b> · Total:{" "}
                        <b>₱ {totalAmountSum.toFixed(2)}</b>
                    </div>
                </div>

                <div className="space-y-4 lg:col-span-2">
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b px-4 py-4">
                            <div className="flex items-center gap-3">
                                <div className="text-lg font-semibold">
                                    {poHeader?.purchase_order_no ?? "—"}
                                </div>
                                <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] ${statusClass(
                                        poHeader?.inventory_status
                                    )}`}
                                >
                                    {statusLabel(poHeader?.inventory_status)}
                                </span>
                            </div>
                            <div className="text-sm text-slate-600">
                                {poHeader?.date ?? "—"}{" "}
                                {poHeader?.time ? `· ${poHeader.time}` : ""}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
                            <div className="rounded-xl border p-3">
                                <div className="text-xs text-slate-500">Supplier</div>
                                <div className="font-medium">
                                    {poHeader?.supplier_name != null
                                        ? supMap[poHeader.supplier_name]?.supplier_name ??
                                        `#${poHeader.supplier_name}`
                                        : "—"}
                                </div>
                            </div>

                            <div className="rounded-xl border p-3">
                                <div className="text-xs text-slate-500">Total Amount</div>
                                <div className="font-medium">
                                    ₱ {Number(poHeader?.total_amount ?? 0).toFixed(2)}
                                </div>
                            </div>

                            <div className="rounded-xl border p-3">
                                <div className="text-xs text-slate-500">Lines</div>
                                <div className="font-medium">{items.length}</div>
                            </div>

                            <div className="rounded-xl border p-3 md:col-span-3">
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                    <span>Receiving Progress</span>
                                    <span>
                                        {receivedTotal}/{orderedTotal} received • Remaining{" "}
                                        {remainingTotal}
                                    </span>
                                </div>
                                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                    <div
                                        className="h-2 bg-emerald-500"
                                        style={{
                                            width: `${Math.round(progress * 100)}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b px-4 py-3">
                            <div className="text-sm font-semibold">Items</div>
                            <div className="flex items-center gap-2">
                                <button
                                    className="rounded-lg border px-3 py-2 hover:bg-slate-50"
                                    onClick={() => setReceiveOpen(true)}
                                    disabled={!selectedId || items.length === 0}
                                    type="button"
                                >
                                    Receive &amp; Assign
                                </button>
                            </div>
                        </div>

                        <div className="overflow-auto">
                            <table className="w-full text-sm">
                                <thead>
                                <tr className="bg-slate-50 text-left">
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
                                {items.map((item) => {
                                    const ordered = Number(item.qty || 0);
                                    const received = Number(
                                        recvMap[item.po_item_id] || 0
                                    );
                                    const remaining = Math.max(
                                        0,
                                        ordered - received
                                    );

                                    return (
                                        <tr key={item.po_item_id} className="border-t">
                                            <td className="p-3 font-medium">
                                                {item.item_name || "(No Name)"}
                                                {item.item_description ? (
                                                    <div className="text-xs text-slate-500">
                                                        {item.item_description}
                                                    </div>
                                                ) : null}
                                            </td>
                                            <td className="p-3">{item.uom}</td>
                                            <td className="p-3">
                                                {ordered.toLocaleString()}
                                            </td>
                                            <td className="p-3">
                                                {received.toLocaleString()}
                                            </td>
                                            <td className="p-3">
                                                {remaining.toLocaleString()}
                                            </td>
                                            <td className="p-3">
                                                ₱ {Number(item.unit_price).toFixed(2)}
                                            </td>
                                            <td className="p-3">
                                                ₱{" "}
                                                {Number(
                                                    item.line_total ??
                                                    Number(item.unit_price) *
                                                    Number(item.qty)
                                                ).toFixed(2)}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {items.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="p-6 text-center text-slate-500"
                                        >
                                            {selectedId ? "No items." : "Select a PO."}
                                        </td>
                                    </tr>
                                )}
                                </tbody>
                            </table>
                        </div>

                        {loading && (
                            <div className="border-t px-4 py-3 text-sm">Loading…</div>
                        )}
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