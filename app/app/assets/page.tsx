"use client";

import React, { useEffect, useMemo, useState } from "react";

/* ===================== Types ===================== */
type POItemRef = {
    item_name?: string | null;
    unit_price?: string | number | null;
};

type VariantRef = {
    variant_name?: string | null;
    name?: string | null;
    list_price?: string | number | null;
};

type ReceivingItemLineRef = {
    po_item_id?: number | POItemRef;
    item_variant_id?: number | VariantRef;
};

type DepartmentRef = {
    department_id?: number;
    id?: number;
    department_name?: string | null;
    name?: string | null;
};

type UserRef = {
    user_id?: number;
    id?: number;
    full_name?: string | null;
    user_fname?: string | null;
    user_lname?: string | null;
};

type AssignmentAPI = {
    id: number;
    qty_assigned: string | number;
    receiving_item_line_id?: number | ReceivingItemLineRef | null;
    department_id?: number | DepartmentRef | null;
    user_id?: number | UserRef | null;
    assigned_at?: string | null;
    notes?: string | null;
};

type Row = {
    id: number;
    item_name: string;
    variant: string | null;
    department_id: number | null;
    user_id: number | null;
    qty: number;
    assigned_at?: string | null;
    list_price: number | null;
};

type Dept = {
    department_id?: number;
    id?: number;
    department_name?: string | null;
    name?: string | null;
};

type User = {
    user_id?: number;
    id?: number;
    full_name?: string | null;
    user_fname?: string | null;
    user_lname?: string | null;
};

type DirectusListResponse<T> = {
    data?: T[];
};

type EnrichedRow = Row & {
    department_name: string;
    user_name: string;
    display_name: string;
};

type GroupInfo = {
    name: string;
    list_price: number | null;
    total_qty: number;
    rows: EnrichedRow[];
    deptBreakdown: Record<string, { total: number; entries: EnrichedRow[] }>;
};

/* ===================== Utilities ===================== */
function isObj(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}

function isPOIObj(v: unknown): v is POItemRef {
    return isObj(v) && ("item_name" in v || "unit_price" in v);
}

function isVarObj(v: unknown): v is VariantRef {
    return isObj(v) && ("variant_name" in v || "name" in v || "list_price" in v);
}

function isRILObj(v: unknown): v is ReceivingItemLineRef {
    return isObj(v) && ("po_item_id" in v || "item_variant_id" in v);
}

function extractItemName(ril: unknown): string {
    if (isRILObj(ril)) {
        const poi = ril.po_item_id;
        if (isPOIObj(poi)) return poi.item_name?.trim() || "(Unnamed Item)";
    }
    return "(Unknown Item)";
}

function extractVariantName(ril: unknown): string | null {
    if (isRILObj(ril)) {
        const variant = ril.item_variant_id;
        if (isVarObj(variant)) {
            return (variant.variant_name ?? variant.name ?? "").trim() || null;
        }
    }
    return null;
}

function extractListPrice(ril: unknown): number | null {
    if (isRILObj(ril)) {
        const variant = ril.item_variant_id;
        if (isVarObj(variant)) {
            const listPrice = variant.list_price;
            if (listPrice != null && listPrice !== "") {
                const n = Number(listPrice);
                if (!Number.isNaN(n)) return n;
            }
        }

        const poi = ril.po_item_id;
        if (isPOIObj(poi)) {
            const unitPrice = poi.unit_price;
            if (unitPrice != null && unitPrice !== "") {
                const n = Number(unitPrice);
                if (!Number.isNaN(n)) return n;
            }
        }
    }

    return null;
}

function toId(v: unknown): number | null {
    if (typeof v === "number") return v;

    if (isObj(v)) {
        if ("id" in v && typeof v.id === "number") return v.id;
        if ("user_id" in v && typeof v.user_id === "number") return v.user_id;
        if ("department_id" in v && typeof v.department_id === "number") {
            return v.department_id;
        }
    }

    return null;
}

function joinName(user: User): string {
    if (user.full_name && user.full_name.trim()) return user.full_name.trim();

    const firstName = user.user_fname?.trim() ?? "";
    const lastName = user.user_lname?.trim() ?? "";
    const full = [firstName, lastName].filter(Boolean).join(" ").trim();

    return full || "";
}

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

function formatPhp(value: number): string {
    return value.toLocaleString("en-PH", {
        style: "currency",
        currency: "PHP",
    });
}

/* ===================== Fetchers ===================== */
async function fetchAssignments(): Promise<Row[]> {
    const url = new URL("/api/items/item_assignment", window.location.origin);
    url.searchParams.set(
        "fields",
        [
            "id",
            "qty_assigned",
            "assigned_at",
            "receiving_item_line_id.po_item_id.item_name",
            "receiving_item_line_id.po_item_id.unit_price",
            "receiving_item_line_id.item_variant_id.variant_name",
            "receiving_item_line_id.item_variant_id.name",
            "receiving_item_line_id.item_variant_id.list_price",
            "department_id",
            "user_id",
        ].join(",")
    );
    url.searchParams.set("sort[]", "-id");
    url.searchParams.set("limit", "-1");

    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || "Failed to load item assignments");
    }

    const json = (await response.json()) as DirectusListResponse<AssignmentAPI>;
    const rows = json.data ?? [];

    return rows.map((row) => ({
        id: Number(row.id),
        item_name: extractItemName(row.receiving_item_line_id),
        variant: extractVariantName(row.receiving_item_line_id),
        department_id: toId(row.department_id),
        user_id: toId(row.user_id),
        qty: Number(row.qty_assigned ?? 0),
        assigned_at: row.assigned_at ?? null,
        list_price: extractListPrice(row.receiving_item_line_id),
    }));
}

async function fetchDepartmentsMap(): Promise<Record<number, string>> {
    const url = new URL("/api/items/department", window.location.origin);
    url.searchParams.set("fields", "department_id,department_name");
    url.searchParams.set("limit", "-1");

    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || "Failed to load departments");
    }

    const json = (await response.json()) as DirectusListResponse<Dept>;
    const data = json.data ?? [];
    const map: Record<number, string> = {};

    for (const dept of data) {
        const id = dept.department_id ?? dept.id;
        if (typeof id === "number") {
            map[id] = String(dept.department_name ?? dept.name ?? `#${id}`);
        }
    }

    return map;
}

async function fetchUsersMap(): Promise<Record<number, string>> {
    const url = new URL("/api/items/user", window.location.origin);
    url.searchParams.set("fields", "user_id,user_fname,user_lname");
    url.searchParams.set("limit", "-1");

    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || "Failed to load users");
    }

    const json = (await response.json()) as DirectusListResponse<User>;
    const data = json.data ?? [];
    const map: Record<number, string> = {};

    for (const user of data) {
        const id = user.user_id ?? user.id;
        if (typeof id === "number") {
            map[id] = joinName(user) || `#${id}`;
        }
    }

    return map;
}

/* ===================== Page ===================== */
export default function ItemAssignmentList() {
    const [rows, setRows] = useState<Row[]>([]);
    const [deptMap, setDeptMap] = useState<Record<number, string>>({});
    const [userMap, setUserMap] = useState<Record<number, string>>({});
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [search, setSearch] = useState("");
    const [open, setOpen] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const load = async (): Promise<void> => {
            try {
                setLoading(true);

                const [assignments, departments, users] = await Promise.all([
                    fetchAssignments(),
                    fetchDepartmentsMap(),
                    fetchUsersMap(),
                ]);

                setRows(assignments);
                setDeptMap(departments);
                setUserMap(users);
            } catch (error: unknown) {
                setErr(getErrorMessage(error, "Failed to load data"));
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, []);

    const enriched = useMemo<EnrichedRow[]>(() => {
        return rows.map((row) => ({
            ...row,
            department_name:
                row.department_id != null
                    ? (deptMap[row.department_id] ?? `#${row.department_id}`)
                    : "—",
            user_name:
                row.user_id != null ? (userMap[row.user_id] ?? `#${row.user_id}`) : "Unassigned",
            display_name: row.variant ? `${row.item_name} — ${row.variant}` : row.item_name,
        }));
    }, [rows, deptMap, userMap]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return enriched;

        return enriched.filter((row) => {
            return (
                row.item_name.toLowerCase().includes(q) ||
                (row.variant ?? "").toLowerCase().includes(q) ||
                row.department_name.toLowerCase().includes(q) ||
                row.user_name.toLowerCase().includes(q)
            );
        });
    }, [enriched, search]);

    const groups = useMemo<GroupInfo[]>(() => {
        const map = new Map<string, GroupInfo>();

        for (const row of filtered) {
            const key = row.display_name;

            const existing = map.get(key) ?? {
                name: key,
                list_price: null,
                total_qty: 0,
                rows: [],
                deptBreakdown: {},
            };

            existing.rows.push(row);
            existing.total_qty += row.qty;

            if (existing.list_price == null && row.list_price != null) {
                existing.list_price = row.list_price;
            }

            const deptName = row.department_name || "—";
            if (!existing.deptBreakdown[deptName]) {
                existing.deptBreakdown[deptName] = { total: 0, entries: [] };
            }

            existing.deptBreakdown[deptName].total += row.qty;
            existing.deptBreakdown[deptName].entries.push(row);

            map.set(key, existing);
        }

        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [filtered]);

    const overallTotalQty = useMemo(
        () => groups.reduce((total, group) => total + group.total_qty, 0),
        [groups]
    );

    const toggle = (key: string): void => {
        setOpen((state) => ({ ...state, [key]: !state[key] }));
    };

    return (
        <div className="space-y-4 p-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Assets and Equipments</h1>
                <div className="flex gap-2">
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search item, variant, department, user…"
                        className="w-72 rounded-xl border px-3 py-2 text-sm"
                    />
                </div>
            </div>

            {err && <div className="rounded border bg-slate-50 p-2 text-sm">{err}</div>}

            <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                <div className="flex items-center justify-between border-b px-4 py-3 text-sm">
                    <div className="font-semibold">Assignments by Item</div>
                    <div className="text-xs text-slate-600">
                        Items: <b>{groups.length}</b> • Total Qty:{" "}
                        <b>
                            {overallTotalQty.toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 4,
                            })}
                        </b>
                    </div>
                </div>

                <div className="overflow-auto">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="bg-slate-50 text-left">
                            <th className="p-3">Item</th>
                            <th className="p-3">List Price</th>
                            <th className="p-3">Total Qty</th>
                            <th className="w-1/6 p-3">Expand</th>
                        </tr>
                        </thead>
                        <tbody>
                        {groups.map((group) => {
                            const isOpen = Boolean(open[group.name]);

                            return (
                                <React.Fragment key={group.name}>
                                    <tr className="border-t hover:bg-slate-50/50">
                                        <td className="p-3 font-medium">{group.name}</td>
                                        <td className="p-3">
                                            {group.list_price != null
                                                ? formatPhp(group.list_price)
                                                : "—"}
                                        </td>
                                        <td className="p-3">
                                            {group.total_qty.toLocaleString(undefined, {
                                                minimumFractionDigits: 0,
                                                maximumFractionDigits: 4,
                                            })}
                                        </td>
                                        <td className="p-3">
                                            <button
                                                onClick={() => toggle(group.name)}
                                                className="rounded-lg border px-3 py-1 text-xs hover:bg-slate-100"
                                                aria-expanded={isOpen}
                                                aria-controls={`panel-${group.name}`}
                                                type="button"
                                            >
                                                {isOpen
                                                    ? "Hide departments"
                                                    : "Show departments"}
                                            </button>
                                        </td>
                                    </tr>

                                    {isOpen && (
                                        <tr className="border-t bg-slate-50/40">
                                            <td
                                                colSpan={4}
                                                className="p-0"
                                                id={`panel-${group.name}`}
                                            >
                                                <div className="space-y-4 px-4 py-3">
                                                    {Object.entries(group.deptBreakdown)
                                                        .sort((a, b) =>
                                                            a[0].localeCompare(b[0])
                                                        )
                                                        .map(([deptName, info]) => (
                                                            <div
                                                                key={deptName}
                                                                className="rounded-xl border bg-white shadow-sm"
                                                            >
                                                                <div className="flex items-center justify-between border-b px-4 py-2">
                                                                    <div className="text-sm font-semibold">
                                                                        {deptName}
                                                                    </div>
                                                                    <div className="text-xs text-slate-600">
                                                                        Dept Qty:{" "}
                                                                        <b>
                                                                            {info.total.toLocaleString(
                                                                                undefined,
                                                                                {
                                                                                    minimumFractionDigits: 0,
                                                                                    maximumFractionDigits: 4,
                                                                                }
                                                                            )}
                                                                        </b>
                                                                    </div>
                                                                </div>
                                                                <div className="overflow-auto">
                                                                    <table className="w-full text-xs">
                                                                        <thead>
                                                                        <tr className="bg-slate-50 text-left">
                                                                            <th className="p-2">
                                                                                User
                                                                            </th>
                                                                            <th className="p-2">
                                                                                Qty
                                                                            </th>
                                                                            <th className="p-2">
                                                                                Assigned At
                                                                            </th>
                                                                        </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                        {info.entries
                                                                            .sort((a, b) =>
                                                                                (a.assigned_at ?? "").localeCompare(
                                                                                    b.assigned_at ?? ""
                                                                                )
                                                                            )
                                                                            .map((row) => (
                                                                                <tr
                                                                                    key={row.id}
                                                                                    className="border-t"
                                                                                >
                                                                                    <td className="p-2">
                                                                                        {row.user_name}
                                                                                    </td>
                                                                                    <td className="p-2">
                                                                                        {row.qty.toLocaleString(
                                                                                            undefined,
                                                                                            {
                                                                                                minimumFractionDigits: 0,
                                                                                                maximumFractionDigits: 4,
                                                                                            }
                                                                                        )}
                                                                                    </td>
                                                                                    <td className="p-2">
                                                                                        {row.assigned_at
                                                                                            ? new Date(
                                                                                                row.assigned_at
                                                                                            ).toLocaleString()
                                                                                            : "—"}
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}

                        {!loading && groups.length === 0 && (
                            <tr>
                                <td colSpan={4} className="p-6 text-center text-slate-500">
                                    No assignments found.
                                </td>
                            </tr>
                        )}

                        {loading && (
                            <tr>
                                <td colSpan={4} className="p-6 text-center text-slate-500">
                                    Loading…
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}