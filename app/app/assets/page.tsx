'use client';

import React, { useEffect, useMemo, useState } from 'react';

const DIRECTUS = process.env.NEXT_PUBLIC_DIRECTUS_URL as string;

/* ===================== Types ===================== */
type AssignmentAPI = {
    id: number;
    qty_assigned: string | number;
    receiving_item_line_id?: number | {
        po_item_id?: number | { item_name?: string | null; unit_price?: string | number | null };
        item_variant_id?: number | {
            variant_name?: string | null;
            name?: string | null;
            list_price?: string | number | null;
        };
    } | null;
    department_id?: number | { department_id?: number; id?: number; department_name?: string | null; name?: string | null } | null;
    user_id?: number | { user_id?: number; id?: number; user_fname?: string | null; user_lname?: string | null; full_name?: string | null } | null;
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

type Dept = { department_id?: number; id?: number; department_name?: string | null; name?: string | null };
type User = {
    user_id?: number; id?: number;
    full_name?: string | null;
    user_fname?: string | null;
    user_lname?: string | null;
};

/* ===================== Utilities ===================== */
function isObj(v: unknown): v is Record<string, unknown> {
    return !!v && typeof v === 'object';
}
function isPOIObj(v: unknown): v is { item_name?: string | null; unit_price?: string | number | null } {
    return isObj(v) && ('item_name' in v || 'unit_price' in v);
}
function isVarObj(v: unknown): v is { variant_name?: string | null; name?: string | null; list_price?: string | number | null } {
    return isObj(v) && ('variant_name' in v || 'name' in v || 'list_price' in v);
}
function isRILObj(v: unknown): v is {
    po_item_id?: number | { item_name?: string | null; unit_price?: string | number | null };
    item_variant_id?: number | { variant_name?: string | null; name?: string | null; list_price?: string | number | null };
} {
    return isObj(v) && ('po_item_id' in v || 'item_variant_id' in v);
}

function extractItemName(ril: unknown): string {
    if (isRILObj(ril)) {
        const poi = ril.po_item_id;
        if (isPOIObj(poi)) return poi.item_name?.trim() || '(Unnamed Item)';
    }
    return '(Unknown Item)';
}
function extractVariantName(ril: unknown): string | null {
    if (isRILObj(ril)) {
        const v = ril.item_variant_id;
        if (isVarObj(v)) return (v.variant_name ?? v.name ?? '').trim() || null;
    }
    return null;
}
function extractListPrice(ril: unknown): number | null {
    if (isRILObj(ril)) {
        const v = ril.item_variant_id;
        if (isVarObj(v)) {
            const lp = v.list_price;
            if (lp != null && lp !== '') {
                const n = Number(lp);
                if (!Number.isNaN(n)) return n;
            }
        }
        const poi = ril.po_item_id;
        if (isPOIObj(poi)) {
            const up = poi.unit_price;
            if (up != null && up !== '') {
                const n = Number(up);
                if (!Number.isNaN(n)) return n;
            }
        }
    }
    return null;
}
function toId(v: unknown): number | null {
    if (typeof v === 'number') return v;
    if (isObj(v) && 'id' in v && typeof (v as any).id === 'number') return (v as any).id as number;
    if (isObj(v) && 'user_id' in v && typeof (v as any).user_id === 'number') return (v as any).user_id as number;
    if (isObj(v) && 'department_id' in v && typeof (v as any).department_id === 'number') return (v as any).department_id as number;
    return null;
}
function joinName(u: User): string {
    if (u.full_name && u.full_name.trim()) return u.full_name.trim();
    const fn = u.user_fname?.trim() ?? '';
    const ln = u.user_lname?.trim() ?? '';
    const full = [fn, ln].filter(Boolean).join(' ').trim();
    return full || '';
}

/* ===================== Fetchers ===================== */
async function fetchAssignments(): Promise<Row[]> {
    const url = new URL(`${DIRECTUS}/items/item_assignment`);
    url.searchParams.set(
        'fields',
        [
            'id',
            'qty_assigned',
            'assigned_at',
            'receiving_item_line_id.po_item_id.item_name',
            'receiving_item_line_id.po_item_id.unit_price',
            'receiving_item_line_id.item_variant_id.variant_name',
            'receiving_item_line_id.item_variant_id.name',
            'receiving_item_line_id.item_variant_id.list_price',
            'department_id', // ids only
            'user_id',
        ].join(',')
    );
    url.searchParams.set('sort[]', '-id');
    url.searchParams.set('limit', '-1');

    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || 'Failed to load item assignments');
    }
    const json = await res.json();
    const rows: AssignmentAPI[] = json.data ?? [];

    return rows.map((r) => ({
        id: Number(r.id),
        item_name: extractItemName(r.receiving_item_line_id),
        variant: extractVariantName(r.receiving_item_line_id),
        department_id: toId(r.department_id),
        user_id: toId(r.user_id),
        qty: Number(r.qty_assigned ?? 0),
        assigned_at: r.assigned_at ?? null,
        list_price: extractListPrice(r.receiving_item_line_id),
    }));
}

async function fetchDepartmentsMap(): Promise<Record<number, string>> {
    const url = new URL(`${DIRECTUS}/items/department`);
    url.searchParams.set('fields', 'department_id,department_name');
    url.searchParams.set('limit', '-1');

    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || 'Failed to load departments');
    }
    const json = await res.json();
    const data: Dept[] = json.data ?? [];
    const map: Record<number, string> = {};
    for (const d of data) {
        const id = (d.department_id ?? d.id) as number | undefined;
        if (id) map[id] = (d.department_name ?? d.name ?? `#${id}`).toString();
    }
    return map;
}

async function fetchUsersMap(): Promise<Record<number, string>> {
    const url = new URL(`${DIRECTUS}/items/user`);
    url.searchParams.set('fields', 'user_id,user_fname,user_lname');
    url.searchParams.set('limit', '-1');

    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || 'Failed to load users');
    }
    const json = await res.json();
    const data: User[] = json.data ?? [];
    const map: Record<number, string> = {};
    for (const u of data) {
        const id = (u.user_id ?? u.id) as number | undefined;
        if (id) {
            const name = joinName(u) || `#${id}`;
            map[id] = name;
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
    const [err, setErr] = useState<string>('');
    const [search, setSearch] = useState('');

    // expanded groups
    const [open, setOpen] = useState<Record<string, boolean>>({});

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const [assignments, dmap, umap] = await Promise.all([
                    fetchAssignments(),
                    fetchDepartmentsMap(),
                    fetchUsersMap(),
                ]);
                setRows(assignments);
                setDeptMap(dmap);
                setUserMap(umap);
            } catch (e: any) {
                setErr(e?.message || 'Failed to load data');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // enrich names
    const enriched = useMemo(() => {
        return rows.map((r) => ({
            ...r,
            department_name: r.department_id != null ? (deptMap[r.department_id] ?? `#${r.department_id}`) : '—',
            user_name: r.user_id != null ? (userMap[r.user_id] ?? `#${r.user_id}`) : 'Unassigned',
            display_name: r.variant ? `${r.item_name} — ${r.variant}` : r.item_name,
        }));
    }, [rows, deptMap, userMap]);

    // filter
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return enriched;
        return enriched.filter((r) => {
            return (
                r.item_name.toLowerCase().includes(q) ||
                (r.variant ?? '').toLowerCase().includes(q) ||
                r.department_name.toLowerCase().includes(q) ||
                r.user_name.toLowerCase().includes(q)
            );
        });
    }, [enriched, search]);

    // group by display_name (Ballpen — Black)
    const groups = useMemo(() => {
        const map = new Map<string, {
            name: string;
            list_price: number | null;
            total_qty: number;
            rows: typeof enriched;
            deptBreakdown: Record<string, { total: number; entries: typeof enriched }>;
        }>();
        for (const r of filtered) {
            const key = r.display_name;
            const g = map.get(key) ?? {
                name: key,
                list_price: null as number | null,
                total_qty: 0,
                rows: [] as typeof enriched,
                deptBreakdown: {} as Record<string, { total: number; entries: typeof enriched }>,
            };
            g.rows.push(r);
            g.total_qty += r.qty;
            // prefer first non-null list_price
            if (g.list_price == null && r.list_price != null) g.list_price = r.list_price;

            const dname = r.department_name || '—';
            if (!g.deptBreakdown[dname]) g.deptBreakdown[dname] = { total: 0, entries: [] as typeof enriched };
            g.deptBreakdown[dname].total += r.qty;
            g.deptBreakdown[dname].entries.push(r);

            map.set(key, g);
        }
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [filtered]);

    const overallTotalQty = useMemo(() => groups.reduce((t, g) => t + g.total_qty, 0), [groups]);

    const toggle = (key: string) => setOpen((s) => ({ ...s, [key]: !s[key] }));

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Assets and Equipments</h1>
                <div className="flex gap-2">
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search item, variant, department, user…"
                        className="rounded-xl border px-3 py-2 text-sm w-72"
                    />
                </div>
            </div>

            {err && <div className="text-sm rounded border p-2 bg-slate-50">{err}</div>}

            <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b text-sm flex items-center justify-between">
                    <div className="font-semibold">Assignments by Item</div>
                    <div className="text-xs text-slate-600">
                        Items: <b>{groups.length}</b> • Total Qty:{' '}
                        <b>{overallTotalQty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}</b>
                    </div>
                </div>

                <div className="overflow-auto">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="text-left bg-slate-50">
                            <th className="p-3">Item</th>
                            <th className="p-3">List Price</th>
                            <th className="p-3">Total Qty</th>
                            <th className="p-3 w-1/6">Expand</th>
                        </tr>
                        </thead>
                        <tbody>
                        {groups.map((g) => {
                            const isOpen = !!open[g.name];
                            return (
                                <React.Fragment key={g.name}>
                                    <tr className="border-t hover:bg-slate-50/50">
                                        <td className="p-3 font-medium">{g.name}</td>
                                        <td className="p-3">
                                            {g.list_price != null
                                                ? g.list_price.toLocaleString(undefined, { style: 'currency', currency: 'PHP' as any })
                                                : '—'}
                                        </td>
                                        <td className="p-3">
                                            {g.total_qty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                                        </td>
                                        <td className="p-3">
                                            <button
                                                onClick={() => toggle(g.name)}
                                                className="rounded-lg border px-3 py-1 text-xs hover:bg-slate-100"
                                                aria-expanded={isOpen}
                                                aria-controls={`panel-${g.name}`}
                                            >
                                                {isOpen ? 'Hide departments' : 'Show departments'}
                                            </button>
                                        </td>
                                    </tr>

                                    {isOpen && (
                                        <tr className="border-t bg-slate-50/40">
                                            <td colSpan={4} className="p-0" id={`panel-${g.name}`}>
                                                {/* Department breakdown */}
                                                <div className="px-4 py-3 space-y-4">
                                                    {Object.entries(g.deptBreakdown)
                                                        .sort((a, b) => a[0].localeCompare(b[0]))
                                                        .map(([deptName, info]) => (
                                                            <div key={deptName} className="rounded-xl border bg-white shadow-sm">
                                                                <div className="flex items-center justify-between px-4 py-2 border-b">
                                                                    <div className="text-sm font-semibold">
                                                                        {deptName}
                                                                    </div>
                                                                    <div className="text-xs text-slate-600">
                                                                        Dept Qty:{' '}
                                                                        <b>
                                                                            {info.total.toLocaleString(undefined, {
                                                                                minimumFractionDigits: 0,
                                                                                maximumFractionDigits: 4,
                                                                            })}
                                                                        </b>
                                                                    </div>
                                                                </div>
                                                                <div className="overflow-auto">
                                                                    <table className="w-full text-xs">
                                                                        <thead>
                                                                        <tr className="text-left bg-slate-50">
                                                                            <th className="p-2">User</th>
                                                                            <th className="p-2">Qty</th>
                                                                            <th className="p-2">Assigned At</th>
                                                                        </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                        {info.entries
                                                                            .sort((a, b) => (a.assigned_at ?? '').localeCompare(b.assigned_at ?? ''))
                                                                            .map((r) => (
                                                                                <tr key={r.id} className="border-t">
                                                                                    <td className="p-2">{r.user_name}</td>
                                                                                    <td className="p-2">
                                                                                        {r.qty.toLocaleString(undefined, {
                                                                                            minimumFractionDigits: 0,
                                                                                            maximumFractionDigits: 4,
                                                                                        })}
                                                                                    </td>
                                                                                    <td className="p-2">
                                                                                        {r.assigned_at ? new Date(r.assigned_at).toLocaleString() : '—'}
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
                                <td colSpan={4} className="p-6 text-center text-slate-500">No assignments found.</td>
                            </tr>
                        )}
                        {loading && (
                            <tr>
                                <td colSpan={4} className="p-6 text-center text-slate-500">Loading…</td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
