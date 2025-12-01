'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { listSuppliers, getSupplierById, Supplier } from '../api/suppliers';
import { listItemTemplates, listItemVariants, ItemTemplate, ItemVariant } from '../api/ItemCatalog';
import { createProcurementWithDetails } from '../api/procurement';
import { todayManila } from '../api/_base';
import { uuid } from '../../../lib/uuid';
// 🔌 bring in your ItemsProvider + modals
import { ItemsProvider, useItems } from '../../items/provider/ItemsProvider';
import ItemTemplateModal from '../../items/components/ItemTemplateModal';
import ItemVariantModal from '../../items/components/ItemVariantModal';

type Line = {
    id: string;
    item_template_id?: number | null;
    item_variant_id?: number | null;
    item_name: string;
    item_description?: string;
    uom?: string;
    qty: number;
    unit_price: number;
    total: number;
    variants: ItemVariant[];
};

type SessionUser = {
    user_id?: number;
    user_fname?: string;
    user_mname?: string;
    user_lname?: string;
    user_department: number | { id: number; department_name?: string };
};

function getUserContext(): { encoder_id: number | null; department_id: number | null } {
    try {
        const stored = localStorage.getItem('user');
        if (!stored) return { encoder_id: null, department_id: null };
        const u: SessionUser = JSON.parse(stored);
        const encoder_id = u.user_id ?? null;
        const department_id =
            typeof u.user_department === 'object'
                ? (u.user_department?.id ?? null)
                : (u.user_department ?? null);
        return { encoder_id, department_id };
    } catch {
        return { encoder_id: null, department_id: null };
    }
}

/** Public page component: wraps inner form with ItemsProvider so the modals work */
export default function ProcurementCreateForm() {
    return (
        <ItemsProvider>
            <ProcurementCreateFormInner />
            {/* Your modals live here so they see the provider */}
            <ItemTemplateModal />
            <ItemVariantModal />
        </ItemsProvider>
    );
}

function ProcurementCreateFormInner() {
    // Supplier state
    const [supplierSearch, setSupplierSearch] = useState('');
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [supplierId, setSupplierId] = useState<number | 0>(0);
    const [supplier, setSupplier] = useState<Supplier | null>(null);

    // Lead date
    const [leadDate, setLeadDate] = useState<string>(todayManila());

    // Items catalog (server-side search)
    const [tmplSearch, setTmplSearch] = useState('');
    const [templates, setTemplates] = useState<ItemTemplate[]>([]);

    // Lines
    const [lines, setLines] = useState<Line[]>([]);

    // Meta
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string>('');

    // 🧩 from ItemsProvider so we can open modals and detect close → refresh variants
    const { activeModal, setActiveModal } = useItems();
    const prevModal = useRef(activeModal);

    const grandTotal = useMemo(
        () => lines.reduce((a, b) => a + Number(b.total || 0), 0),
        [lines]
    );

    // Load suppliers
    useEffect(() => {
        (async () => {
            const data = await listSuppliers(supplierSearch);
            setSuppliers(data);
        })();
    }, [supplierSearch]);

    // Load item templates (server-side filter)
    useEffect(() => {
        (async () => {
            const data = await listItemTemplates(tmplSearch);
            setTemplates(data);
        })();
    }, [tmplSearch]);

    // When supplier changes, fetch details
    useEffect(() => {
        if (!supplierId) {
            setSupplier(null);
            return;
        }
        (async () => {
            const s = await getSupplierById(supplierId);
            setSupplier(s);
        })();
    }, [supplierId]);

    // ⟳ When the Variant modal just closed, refresh variants for any selected templates
    useEffect(() => {
        const was = prevModal.current;
        const now = activeModal;
        prevModal.current = activeModal;

        if (was === 'variant' && now === null) {
            // refresh variants for all lines that have a template selected
            (async () => {
                const updates = await Promise.all(
                    lines.map(async (ln) => {
                        if (!ln.item_template_id) return ln;
                        const variants = await listItemVariants(ln.item_template_id);
                        // If the previously selected variant is gone, clear it
                        const hasPrev = ln.item_variant_id
                            ? variants.some((v) => v.id === ln.item_variant_id)
                            : true;
                        const unit_price =
                            hasPrev && ln.item_variant_id
                                ? Number(variants.find((v) => v.id === ln.item_variant_id)?.list_price ?? ln.unit_price)
                                : ln.unit_price;

                        return {
                            ...ln,
                            variants,
                            unit_price,
                            total: Number(unit_price || 0) * Number(ln.qty || 0),
                            item_variant_id: hasPrev ? ln.item_variant_id : null,
                        };
                    })
                );
                setLines(updates);
            })();
        }
    }, [activeModal, lines]);

    function addEmptyLine() {
        setLines((prev) => [
            ...prev,
            {
                id: uuid(),
                item_template_id: undefined,
                item_variant_id: undefined,
                item_name: '',
                item_description: '',
                uom: '',
                qty: 1,
                unit_price: 0,
                total: 0,
                variants: [],
            },
        ]);
    }

    async function onPickTemplate(lineId: string, tmplId: number) {
        if (!tmplId) {
            // reset line
            setLines((prev) =>
                prev.map((ln) =>
                    ln.id === lineId
                        ? {
                            ...ln,
                            item_template_id: undefined,
                            item_variant_id: undefined,
                            item_name: '',
                            item_description: '',
                            uom: '',
                            unit_price: 0,
                            total: 0,
                            variants: [],
                        }
                        : ln
                )
            );
            return;
        }

        const tmpl = templates.find((t) => t.id === tmplId);
        const variants = await listItemVariants(tmplId);

        setLines((prev) =>
            prev.map((ln) => {
                if (ln.id !== lineId) return ln;
                const price = variants.length ? 0 : Number(tmpl?.base_price ?? 0);
                return {
                    ...ln,
                    item_template_id: tmplId,
                    item_variant_id: undefined,
                    item_name: tmpl?.name ?? '',
                    item_description: tmpl?.description ?? '',
                    uom: tmpl?.uom ?? '',
                    unit_price: price,
                    total: price * (ln.qty || 0),
                    variants,
                };
            })
        );
    }

    function onPickVariant(lineId: string, variantId: number) {
        setLines((prev) =>
            prev.map((ln) => {
                if (ln.id !== lineId) return ln;
                if (!variantId) {
                    const price = Number(
                        templates.find((t) => t.id === ln.item_template_id)?.base_price ?? 0
                    );
                    return {
                        ...ln,
                        item_variant_id: null,
                        item_name: ln.item_name, // keep template name
                        unit_price: price,
                        total: price * (ln.qty || 0),
                    };
                }
                const v = ln.variants.find((x) => x.id === variantId);
                const price = Number(v?.list_price ?? 0);
                return {
                    ...ln,
                    item_variant_id: variantId,
                    item_name: v?.name ?? ln.item_name,
                    unit_price: price,
                    total: price * (ln.qty || 0),
                };
            })
        );
    }

    function onQtyChange(lineId: string, qty: number) {
        setLines((prev) =>
            prev.map((ln) =>
                ln.id === lineId ? { ...ln, qty, total: Number(ln.unit_price || 0) * (qty || 0) } : ln
            )
        );
    }

    function onPriceChange(lineId: string, price: number) {
        setLines((prev) =>
            prev.map((ln) =>
                ln.id === lineId
                    ? { ...ln, unit_price: price, total: (price || 0) * Number(ln.qty || 0) }
                    : ln
            )
        );
    }

    function onDescChange(lineId: string, desc: string) {
        setLines((prev) => prev.map((ln) => (ln.id === lineId ? { ...ln, item_description: desc } : ln)));
    }

    function removeLine(lineId: string) {
        setLines((prev) => prev.filter((ln) => ln.id !== lineId));
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setMessage('');
        if (!supplierId) {
            setMessage('Please select a supplier.');
            return;
        }
        if (lines.length === 0) {
            setMessage('Please add at least one item line.');
            return;
        }
        const { encoder_id, department_id } = getUserContext();

        setBusy(true);
        try {
            const payloadItems = lines.map((ln) => ({
                item_template_id: ln.item_template_id ?? null,
                item_variant_id: ln.item_variant_id ?? null,
                item_name: ln.item_name,
                item_description: ln.item_description ?? '',
                uom: ln.uom ?? '',
                qty: Number(ln.qty || 0),
                unit_price: Number(ln.unit_price || 0),
            }));

            const out = await createProcurementWithDetails({
                supplier_id: supplierId,
                lead_date: leadDate || undefined,
                encoder_id,
                department_id,
                transaction_type: 'trade',
                status: 'pending',
                items: payloadItems,
            });

            setMessage(`Saved! Procurement #${out.procurement_no} created.`);
            setLines([]);
        } catch (err: any) {
            setMessage(err?.message ?? 'Failed to save procurement.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <form onSubmit={onSubmit} className="space-y-6">
            {/* SUPPLIER */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="px-4 py-3 border-b text-sm font-semibold">Supplier</div>
                <div className="p-4 grid gap-3 md:grid-cols-2">
                    <div className="grid gap-2">
                        <label className="text-xs text-slate-500">Search Supplier</label>
                        <input
                            className="rounded-xl border px-3 py-2"
                            placeholder="Type to search supplier…"
                            value={supplierSearch}
                            onChange={(e) => setSupplierSearch(e.target.value)}
                        />
                        <select
                            className="rounded-xl border px-3 py-2"
                            value={supplierId || 0}
                            onChange={(e) => setSupplierId(Number(e.target.value))}
                        >
                            <option value={0}>Select supplier</option>
                            {suppliers.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.supplier_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid gap-2">
                        <label className="text-xs text-slate-500">Lead Date (Manila)</label>
                        <input
                            type="date"
                            className="rounded-xl border px-3 py-2"
                            value={leadDate}
                            onChange={(e) => setLeadDate(e.target.value)}
                        />
                    </div>

                    <div className="md:col-span-2 rounded-xl border p-3 bg-slate-50 grid md:grid-cols-3 gap-3">
                        <Info label="Address" value={supplier?.address || ''} />
                        <Info label="Email" value={supplier?.email_address || ''} />
                        <Info label="Phone" value={supplier?.phone_number || ''} />
                        <Info label="TIN" value={supplier?.tin_number || ''} />
                        <Info label="Payment Terms" value={supplier?.payment_terms || ''} />
                        <Info label="Supplier Type" value={supplier?.supplier_type || ''} />
                    </div>
                </div>
            </div>

            {/* ITEMS */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                    <div className="text-sm font-semibold">Items</div>
                    <div className="flex items-center gap-2">
                        <input
                            className="rounded-xl border px-3 py-1 text-sm"
                            placeholder="Search item templates…"
                            value={tmplSearch}
                            onChange={(e) => setTmplSearch(e.target.value)}
                        />
                        <button
                            type="button"
                            onClick={() => setActiveModal('template')}
                            className="rounded-xl px-3 py-2 border"
                            title="Create new item template"
                        >
                            + New Item
                        </button>
                        <button
                            type="button"
                            onClick={addEmptyLine}
                            className="rounded-xl px-3 py-2 bg-emerald-600 text-white"
                        >
                            Add Line
                        </button>
                    </div>
                </div>

                <div className="overflow-auto">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="text-left bg-slate-50">
                            <th className="p-3">Item Template</th>
                            <th className="p-3">Variant (if any)</th>
                            <th className="p-3">Item Name</th>
                            <th className="p-3">Description</th>
                            <th className="p-3">UOM</th>
                            <th className="p-3">Qty</th>
                            <th className="p-3">List Price</th>
                            <th className="p-3">Total</th>
                            <th className="p-3"></th>
                        </tr>
                        </thead>
                        <tbody>
                        {lines.map((ln) => (
                            <tr key={ln.id} className="border-t">
                                <td className="p-3 min-w-56">
                                    <select
                                        className="rounded-xl border px-3 py-2 w-full"
                                        value={ln.item_template_id || 0}
                                        onChange={(e) => onPickTemplate(ln.id, Number(e.target.value))}
                                    >
                                        <option value={0}>Select template</option>
                                        {templates.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.name}
                                            </option>
                                        ))}
                                    </select>
                                </td>

                                <td className="p-3 min-w-56">
                                    {ln.item_template_id ? (
                                        <div className="flex items-center gap-2">
                                            {ln.variants.length > 0 ? (
                                                <select
                                                    className="rounded-xl border px-3 py-2 w-full"
                                                    value={ln.item_variant_id || 0}
                                                    onChange={(e) => onPickVariant(ln.id, Number(e.target.value))}
                                                >
                                                    <option value={0}>Select variant</option>
                                                    {ln.variants.map((v) => (
                                                        <option key={v.id} value={v.id}>
                                                            {v.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <span className="text-slate-400">—</span>
                                            )}
                                            <button
                                                type="button"
                                                className="rounded-xl px-2 py-2 border text-xs"
                                                onClick={() => setActiveModal('variant')}
                                                title="Add Variant for selected template"
                                            >
                                                + Add Variant
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="text-slate-400">—</span>
                                    )}
                                </td>

                                <td className="p-3">
                                    <input
                                        className="rounded-xl border px-3 py-2 w-52"
                                        value={ln.item_name}
                                        onChange={(e) =>
                                            setLines((prev) =>
                                                prev.map((x) => (x.id === ln.id ? { ...x, item_name: e.target.value } : x))
                                            )
                                        }
                                    />
                                </td>
                                <td className="p-3">
                                    <input
                                        className="rounded-xl border px-3 py-2 w-72"
                                        value={ln.item_description || ''}
                                        onChange={(e) => onDescChange(ln.id, e.target.value)}
                                    />
                                </td>
                                <td className="p-3">
                                    <input
                                        className="rounded-xl border px-3 py-2 w-28"
                                        value={ln.uom || ''}
                                        onChange={(e) =>
                                            setLines((prev) =>
                                                prev.map((x) => (x.id === ln.id ? { ...x, uom: e.target.value } : x))
                                            )
                                        }
                                    />
                                </td>
                                <td className="p-3">
                                    <input
                                        type="number"
                                        min={1}
                                        className="rounded-xl border px-3 py-2 w-24"
                                        value={ln.qty}
                                        onChange={(e) => onQtyChange(ln.id, Number(e.target.value))}
                                    />
                                </td>
                                <td className="p-3">
                                    <input
                                        type="number"
                                        step="0.01"
                                        min={0}
                                        className="rounded-xl border px-3 py-2 w-28"
                                        value={ln.unit_price}
                                        onChange={(e) => onPriceChange(ln.id, Number(e.target.value))}
                                    />
                                </td>
                                <td className="p-3 font-medium">₱ {ln.total.toFixed(2)}</td>
                                <td className="p-3">
                                    <button
                                        type="button"
                                        className="rounded-xl px-3 py-2 bg-rose-600 text-white"
                                        onClick={() => removeLine(ln.id)}
                                    >
                                        Remove
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {lines.length === 0 && (
                            <tr>
                                <td colSpan={9} className="p-6 text-center text-slate-500">
                                    No lines yet. Click <b>Add Line</b> to start.
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>

                <div className="px-4 py-3 border-t flex items-center justify-between">
                    <div className="text-sm text-slate-500">
                        Grand Total: <b>₱ {grandTotal.toFixed(2)}</b>
                    </div>
                    <button
                        type="submit"
                        className="rounded-xl px-4 py-2 bg-blue-600 text-white disabled:opacity-50"
                        disabled={busy}
                    >
                        {busy ? 'Saving…' : 'Save Procurement'}
                    </button>
                </div>
            </div>

            {message && (
                <div
                    className={`rounded-xl border p-3 ${
                        message.startsWith('Saved') ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
                    }`}
                >
                    <div className="text-sm">{message}</div>
                </div>
            )}
        </form>
    );
}

function Info({ label, value }: { label: string; value: string }) {
    return (
        <div className="text-sm">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
            <div className="font-medium text-slate-800">{value || '—'}</div>
        </div>
    );
}
