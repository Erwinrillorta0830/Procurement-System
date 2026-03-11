"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
    getProcurement,
    getProcurementDetails,
    approveProcurementServer,
    updateProcurementDetail,
    recomputeProcurementTotal,
    type Procurement,
    type ProcurementDetail,
} from "../api/procurement";
import { api } from "../api/_base";
import { getSupplierById, type Supplier } from "../api/suppliers";
import {
    getItemTemplateName,
    getItemVariantName,
    getItemTemplateUom,
} from "../api/ItemCatalog";
import { listUnits, type Unit } from "../api/units";
import { generatePOFromProcurement } from "../api/purchaseOrder";

type SessionUser = { user_id?: number };

type SupplierExtras = Supplier & {
    payment_terms?: string;
    tin_number?: string;
    phone_number?: string;
};

type PurchaseOrderLookupResponse = {
    data?: {
        purchase_order_no?: string;
    };
};

type Draft = {
    qty: number;
    unit_price: number;
    total: number;
    uom: string;
    dirty: boolean;
    saving?: boolean;
};

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

async function fetchPONumberById(poId: number): Promise<string> {
    if (!poId) return "";

    try {
        const response = await api<PurchaseOrderLookupResponse>(
            `purchase_order/${poId}?fields=purchase_order_no`
        );
        return response.data?.purchase_order_no ?? "";
    } catch {
        return "";
    }
}

function getCurrentUserId(): number | null {
    try {
        const raw = localStorage.getItem("user");
        if (!raw) return null;

        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null) return null;

        const record = parsed as Record<string, unknown>;
        return typeof record.user_id === "number" ? record.user_id : null;
    } catch {
        return null;
    }
}

export default function ProcurementDetailsPage() {
    const params = useParams<{ id: string }>();
    const id = Number(params?.id);

    const [master, setMaster] = useState<Procurement | null>(null);
    const [details, setDetails] = useState<ProcurementDetail[]>([]);
    const [supplier, setSupplier] = useState<SupplierExtras | null>(null);
    const [units, setUnits] = useState<Unit[]>([]);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState("");

    const [itemNames, setItemNames] = useState<Record<number, string>>({});
    const [variantNames, setVariantNames] = useState<Record<number, string>>({});
    const [poNumber, setPoNumber] = useState<string>("");
    const [drafts, setDrafts] = useState<Record<number, Draft>>({});

    const approved =
        Boolean(master?.isApproved) || master?.status === "approved" || Boolean(master?.po_no);

    async function loadNames(currentDetails: ProcurementDetail[]): Promise<void> {
        const tmplIds = Array.from(
            new Set(
                currentDetails
                    .map((detail) => detail.item_template_id)
                    .filter((value): value is number => typeof value === "number")
            )
        );

        const variantIds = Array.from(
            new Set(
                currentDetails
                    .map((detail) => detail.item_variant_id)
                    .filter((value): value is number => typeof value === "number")
            )
        );

        const tmplEntries = await Promise.all(
            tmplIds.map(async (templateId) => {
                const name = await getItemTemplateName(templateId);
                return [templateId, name] as const;
            })
        );

        const variantEntries = await Promise.all(
            variantIds.map(async (variantId) => {
                const name = await getItemVariantName(variantId);
                return [variantId, name] as const;
            })
        );

        setItemNames(Object.fromEntries(tmplEntries));
        setVariantNames(Object.fromEntries(variantEntries));
    }

    async function hydrateUoms(currentDetails: ProcurementDetail[]): Promise<void> {
        const clones: Record<number, Draft> = {};

        currentDetails.forEach((line) => {
            const total = Number(
                line.total_amount ?? Number(line.qty || 0) * Number(line.unit_price || 0)
            );

            clones[line.id] = {
                qty: Number(line.qty || 0),
                unit_price: Number(line.unit_price || 0),
                total,
                uom: line.uom ?? "",
                dirty: false,
            };
        });

        const missing = currentDetails.filter(
            (line) => !line.uom && typeof line.item_template_id === "number"
        );

        const mapByTemplate = new Map<number, string>();

        await Promise.all(
            missing.map(async (line) => {
                const templateId = line.item_template_id as number;

                if (!mapByTemplate.has(templateId)) {
                    const tmplUom = await getItemTemplateUom(templateId);
                    mapByTemplate.set(templateId, tmplUom || "");
                }

                clones[line.id].uom = mapByTemplate.get(templateId) || "";
            })
        );

        setDrafts(clones);
    }

    async function load(): Promise<void> {
        setMsg("");
        setPoNumber("");

        const loadedMaster = await getProcurement(id);
        setMaster(loadedMaster);

        if (loadedMaster?.po_no) {
            const poNoStr = await fetchPONumberById(Number(loadedMaster.po_no));
            setPoNumber(poNoStr || "");
        }

        const loadedDetails = await getProcurementDetails(id);
        setDetails(loadedDetails);
        await loadNames(loadedDetails);
        await hydrateUoms(loadedDetails);

        if (loadedMaster?.supplier_id) {
            const loadedSupplier = (await getSupplierById(
                loadedMaster.supplier_id
            )) as SupplierExtras;
            setSupplier(loadedSupplier);
        } else {
            setSupplier(null);
        }
    }

    useEffect(() => {
        if (Number.isFinite(id)) {
            void load();
        }
    }, [id]);

    useEffect(() => {
        const run = async (): Promise<void> => {
            const loadedUnits = await listUnits();
            setUnits(loadedUnits);
        };

        void run();
    }, []);

    const canApprove = Boolean(master) && !master?.isApproved && master?.status !== "approved";
    const canGeneratePO = Boolean(master?.isApproved) && !master?.po_no;
    const hasPO = Boolean(master?.po_no);

    async function onApprove(): Promise<void> {
        const uid = getCurrentUserId();
        if (!uid) {
            setMsg("No logged-in user found.");
            return;
        }

        setBusy(true);
        setMsg("");

        try {
            await approveProcurementServer(id, uid);
            await load();
            setMsg("Approved successfully.");
        } catch (error: unknown) {
            setMsg(getErrorMessage(error, "Failed to approve"));
        } finally {
            setBusy(false);
        }
    }

    async function onGeneratePO(): Promise<void> {
        const raw = localStorage.getItem("user");
        let encoderId: number | null = null;

        if (raw) {
            try {
                const parsed: unknown = JSON.parse(raw);
                if (typeof parsed === "object" && parsed !== null) {
                    const record = parsed as Record<string, unknown>;
                    encoderId =
                        typeof record.user_id === "number" ? record.user_id : null;
                }
            } catch {
                encoderId = null;
            }
        }

        setBusy(true);
        setMsg("");

        try {
            const out = await generatePOFromProcurement({
                procurement_id: id,
                encoder_id: encoderId,
                approver_id: master?.approved_by ?? encoderId,
                receiver_id: null,
                default_tax_rate: 12,
                create_items: true,
            });

            await load();
            setMsg(`PO created: ${out.purchase_order_no}`);
        } catch (error: unknown) {
            setMsg(getErrorMessage(error, "Failed to generate PO."));
        } finally {
            setBusy(false);
        }
    }

    function updateDraftRow(rowId: number, patch: Partial<Draft>): void {
        setDrafts((prev) => {
            const current: Draft = prev[rowId] || {
                qty: 0,
                unit_price: 0,
                total: 0,
                uom: "",
                dirty: false,
            };

            const next: Draft = { ...current, ...patch };

            if (patch.qty !== undefined || patch.unit_price !== undefined) {
                const qty = patch.qty !== undefined ? patch.qty : current.qty;
                const unitPrice =
                    patch.unit_price !== undefined ? patch.unit_price : current.unit_price;

                next.total = Number(qty || 0) * Number(unitPrice || 0);
                next.dirty = true;
            }

            if (patch.uom !== undefined && patch.uom !== current.uom) {
                next.dirty = true;
            }

            return { ...prev, [rowId]: next };
        });
    }

    async function saveRow(line: ProcurementDetail): Promise<void> {
        const draft = drafts[line.id];
        if (!draft || !draft.dirty) return;

        updateDraftRow(line.id, { saving: true });

        try {
            await updateProcurementDetail({
                id: line.id,
                qty: draft.qty,
                unit_price: draft.unit_price,
                uom: draft.uom,
            });

            const newTotal = await recomputeProcurementTotal(line.procurement_id);

            setMaster((prev) =>
                prev && prev.id === line.procurement_id
                    ? { ...prev, total_amount: newTotal }
                    : prev
            );

            setMsg(`Saved line #${line.id}. New grand total: ₱ ${newTotal.toFixed(2)}`);

            const fresh = await getProcurementDetails(line.procurement_id);
            setDetails(fresh);

            const freshRow = fresh.find((row) => row.id === line.id);

            if (freshRow) {
                setDrafts((prev) => {
                    const prevDraft = prev[line.id] ?? draft;

                    return {
                        ...prev,
                        [line.id]: {
                            qty: Number(freshRow.qty || 0),
                            unit_price: Number(freshRow.unit_price || 0),
                            total: Number(
                                freshRow.total_amount ??
                                Number(freshRow.qty || 0) *
                                Number(freshRow.unit_price || 0)
                            ),
                            uom: freshRow.uom ?? prevDraft.uom ?? "",
                            dirty: false,
                            saving: false,
                        },
                    };
                });
            } else {
                updateDraftRow(line.id, { saving: false, dirty: false });
            }
        } catch (error: unknown) {
            setMsg(getErrorMessage(error, "Failed to save line."));
            updateDraftRow(line.id, { saving: false });
        }
    }

    function revertRow(line: ProcurementDetail): void {
        const existing = drafts[line.id];

        setDrafts((prev) => ({
            ...prev,
            [line.id]: {
                qty: Number(line.qty || 0),
                unit_price: Number(line.unit_price || 0),
                total: Number(
                    line.total_amount ??
                    Number(line.qty || 0) * Number(line.unit_price || 0)
                ),
                uom: line.uom ?? existing?.uom ?? "",
                dirty: false,
            },
        }));
    }

    const total =
        master?.total_amount ??
        details.reduce(
            (sum, line) =>
                sum +
                Number(
                    line.total_amount ??
                    Number(line.qty || 0) * Number(line.unit_price || 0)
                ),
            0
        );

    return (
        <div className="space-y-4 p-6">
            <div className="flex items-center justify-between">
                <div className="text-2xl font-semibold">Procurement Details</div>
                <div className="flex gap-2">
                    <Link href="/app/procurement" className="rounded-xl border px-3 py-2">
                        Back
                    </Link>
                    <Link
                        href={`/app/procurement/${id}/print`}
                        className="rounded-xl border px-3 py-2"
                    >
                        Print
                    </Link>

                    {canGeneratePO && (
                        <button
                            className="rounded-xl bg-indigo-600 px-3 py-2 text-white disabled:opacity-50"
                            onClick={onGeneratePO}
                            disabled={busy}
                            title="Generate Purchase Order"
                            type="button"
                        >
                            {busy ? "Working…" : "Generate PO"}
                        </button>
                    )}

                    {hasPO && (
                        <Link
                            href={`/app/procurement/po/${master?.po_no}`}
                            className="rounded-xl border px-3 py-2"
                            title="Open this Purchase Order"
                        >
                            View PO
                        </Link>
                    )}

                    <button
                        className="rounded-xl bg-emerald-600 px-3 py-2 text-white disabled:opacity-50"
                        onClick={onApprove}
                        disabled={!canApprove || busy}
                        title={
                            canApprove ? "Approve this procurement" : "Already approved"
                        }
                        type="button"
                    >
                        {busy ? "Working…" : master?.isApproved ? "Approved" : "Approve"}
                    </button>
                </div>
            </div>

            {msg && (
                <div
                    className={`rounded-xl border p-3 ${
                        msg.toLowerCase().includes("approved") ||
                        msg.toLowerCase().includes("po created")
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-slate-200 bg-slate-50"
                    }`}
                >
                    <div className="text-sm">{msg}</div>
                </div>
            )}

            <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                <div className="border-b px-4 py-3 text-sm font-semibold">Header</div>
                <div className="grid gap-3 p-4 text-sm md:grid-cols-3">
                    <Info label="PO No" value={poNumber || ""} />
                    <Info label="PR No" value={master?.procurement_no ?? ""} />
                    <Info label="Lead Date" value={master?.lead_date ?? ""} />
                    <Info
                        label="Status"
                        value={`${master?.status ?? ""}${
                            master?.isApproved ? " (Approved)" : ""
                        }`}
                    />
                    <Info
                        label="Supplier"
                        value={supplier?.supplier_name ?? `#${master?.supplier_id ?? ""}`}
                    />
                    <Info label="Payment Terms" value={supplier?.payment_terms ?? ""} />
                    <Info label="TIN" value={supplier?.tin_number ?? ""} />
                    <Info label="Email" value={supplier?.email_address ?? ""} />
                    <Info label="Phone" value={supplier?.phone_number ?? ""} />
                    <Info label="Address" value={supplier?.address ?? ""} />
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                <div className="border-b px-4 py-3 text-sm font-semibold">Items</div>
                <div className="overflow-auto">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="bg-slate-50 text-left">
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
                        {details.map((line) => {
                            const draft = drafts[line.id];
                            const saving = Boolean(draft?.saving);

                            return (
                                <tr key={line.id} className="border-t">
                                    <td className="p-3">
                                        {(line.item_template_id &&
                                                itemNames[line.item_template_id]) ||
                                            "—"}
                                    </td>
                                    <td className="p-3">
                                        {(line.item_variant_id &&
                                                variantNames[line.item_variant_id]) ||
                                            "—"}
                                    </td>

                                    <td className="min-w-40 p-3">
                                        <select
                                            className="w-full rounded-xl border px-3 py-2"
                                            value={draft?.uom ?? ""}
                                            onChange={(e) =>
                                                updateDraftRow(line.id, {
                                                    uom: e.target.value,
                                                })
                                            }
                                            disabled={approved || saving}
                                        >
                                            <option value="">Select UOM</option>
                                            {units.map((unit) => (
                                                <option
                                                    key={unit.unit_id}
                                                    value={unit.unit_name}
                                                >
                                                    {unit.unit_name}
                                                    {unit.unit_shortcut
                                                        ? ` (${unit.unit_shortcut})`
                                                        : ""}
                                                </option>
                                            ))}
                                        </select>
                                    </td>

                                    <td className="p-3">
                                        <input
                                            type="number"
                                            min={1}
                                            className="w-24 rounded-xl border px-3 py-2"
                                            value={draft?.qty ?? line.qty}
                                            onChange={(e) =>
                                                updateDraftRow(line.id, {
                                                    qty: Number(e.target.value),
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
                                            className="w-32 rounded-xl border px-3 py-2"
                                            value={draft?.unit_price ?? line.unit_price}
                                            onChange={(e) =>
                                                updateDraftRow(line.id, {
                                                    unit_price: Number(
                                                        e.target.value
                                                    ),
                                                })
                                            }
                                            disabled={approved || saving}
                                        />
                                    </td>

                                    <td className="p-3 font-medium">
                                        ₱{" "}
                                        {(
                                            draft?.total ??
                                            (line.total_amount ||
                                                Number(line.qty || 0) *
                                                Number(line.unit_price || 0))
                                        ).toFixed(2)}
                                    </td>

                                    <td className="p-3">{line.date_added}</td>
                                    <td className="p-3">
                                        {line.link ? (
                                            <a
                                                className="text-blue-600 underline"
                                                href={line.link}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                file
                                            </a>
                                        ) : (
                                            "—"
                                        )}
                                    </td>

                                    <td className="p-3">
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                className="rounded-xl border px-3 py-1 disabled:opacity-50"
                                                onClick={() => revertRow(line)}
                                                disabled={
                                                    approved ||
                                                    !draft?.dirty ||
                                                    saving
                                                }
                                                title="Revert changes"
                                            >
                                                Revert
                                            </button>
                                            <button
                                                type="button"
                                                className="rounded-xl bg-blue-600 px-3 py-1 text-white disabled:opacity-50"
                                                onClick={() => void saveRow(line)}
                                                disabled={
                                                    approved ||
                                                    !draft?.dirty ||
                                                    saving
                                                }
                                                title="Save this line"
                                            >
                                                {saving ? "Saving…" : "Save"}
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

                <div className="border-t px-4 py-3 text-right text-sm">
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
            <div className="font-medium text-slate-800">{value || "—"}</div>
        </div>
    );
}