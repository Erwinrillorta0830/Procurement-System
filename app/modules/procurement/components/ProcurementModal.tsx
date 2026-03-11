"use client";

import * as React from "react";
import {
    getProcurement,
    getProcurementDetails,
    approveProcurementServer,
    updateProcurementDetail,
    recomputeProcurementTotal,
    type Procurement,
    type ProcurementDetail,
    createProcurementDetail,
    deleteProcurementDetail,
} from "../api/procurement";
import { api } from "../api/_base";
import { getSupplierById, type Supplier } from "../api/suppliers";
import {
    getItemTemplateName,
    getItemVariantName,
    getItemTemplateUom,
    listItemTemplates,
    listItemVariants,
    type ItemTemplate,
    type ItemVariant,
} from "../api/ItemCatalog";
import { listUnits, type Unit } from "../api/units";
import { generatePOFromProcurement } from "../api/purchaseOrder";
import POModal from "./POModal";
import { printNodeWithIframe } from "../../../lib/printNodeWithIframe";

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

type ProcurementLookupResponse = {
    data?: Procurement[];
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
    const [supplier, setSupplier] = React.useState<SupplierExtras | null>(null);
    const [units, setUnits] = React.useState<Unit[]>([]);
    const [busy, setBusy] = React.useState(false);
    const [msg, setMsg] = React.useState("");
    const [error, setError] = React.useState<string | null>(null);

    const [itemNames, setItemNames] = React.useState<Record<number, string>>({});
    const [variantNames, setVariantNames] = React.useState<Record<number, string>>({});
    const [drafts, setDrafts] = React.useState<Record<number, Draft>>({});
    const [tmplUoms, setTmplUoms] = React.useState<Record<number, string>>({});

    const [poModalOpen, setPoModalOpen] = React.useState(false);
    const [poIdForModal, setPoIdForModal] = React.useState<number | null>(null);
    const [poNumber, setPoNumber] = React.useState<string>("");

    const printRef = React.useRef<HTMLDivElement>(null);

    const approved =
        Boolean(master?.isApproved) || master?.status === "approved" || Boolean(master?.po_no);

    React.useEffect(() => {
        const run = async (): Promise<void> => {
            const loadedUnits = await listUnits();
            setUnits(loadedUnits);
        };

        void run();
    }, []);

    React.useEffect(() => {
        if (open) {
            void load();
        }
    }, [open, id, procurementNo]);

    async function resolveHeaderIdByNo(procurementNumber: string): Promise<number | null> {
        try {
            const params = new URLSearchParams();
            params.set("filter[procurement_no][_eq]", procurementNumber);
            params.set("limit", "1");

            const response = await api<ProcurementLookupResponse>(
                `procurement?${params.toString()}`
            );

            const row = Array.isArray(response.data) ? response.data[0] : undefined;
            return row?.id ?? null;
        } catch {
            return null;
        }
    }

    async function load(): Promise<void> {
        try {
            setError(null);
            setMsg("");
            setPoNumber("");
            setTmplUoms({});

            let headerId = id ?? null;

            if (!headerId && procurementNo) {
                headerId = await resolveHeaderIdByNo(procurementNo);
                if (!headerId) {
                    throw new Error("Procurement not found.");
                }
            }

            const loadedMaster = await getProcurement(Number(headerId));
            setMaster(loadedMaster);

            if (loadedMaster?.po_no) {
                const poNoStr = await fetchPONumberById(Number(loadedMaster.po_no));
                setPoNumber(poNoStr);
            }

            const loadedDetails = await getProcurementDetails(Number(headerId));
            setDetails(loadedDetails);

            await Promise.all([
                loadNames(loadedDetails),
                hydrateUoms(loadedDetails),
                loadTemplateUoms(loadedDetails),
            ]);

            if (loadedMaster?.supplier_id) {
                const loadedSupplier = (await getSupplierById(
                    loadedMaster.supplier_id
                )) as SupplierExtras;
                setSupplier(loadedSupplier);
            } else {
                setSupplier(null);
            }
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Failed to load procurement."));
        }
    }

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

    async function loadTemplateUoms(currentDetails: ProcurementDetail[]): Promise<void> {
        const neededTemplateIds = Array.from(
            new Set(
                currentDetails
                    .filter(
                        (line) =>
                            !line.uom && typeof line.item_template_id === "number"
                    )
                    .map((line) => line.item_template_id)
                    .filter((value): value is number => typeof value === "number")
            )
        );

        if (neededTemplateIds.length === 0) {
            setTmplUoms({});
            return;
        }

        const pairs = await Promise.all(
            neededTemplateIds.map(async (templateId) => {
                const uom = await getItemTemplateUom(templateId);
                return [templateId, uom] as const;
            })
        );

        setTmplUoms(Object.fromEntries(pairs));
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

        setDrafts(clones);
    }

    const canApprove = Boolean(master) && !master?.isApproved && master?.status !== "approved";
    const canGeneratePO = Boolean(master?.isApproved) && !master?.po_no;

    async function onApprove(): Promise<void> {
        const uid = getCurrentUserId();

        if (!uid) {
            setMsg("No logged-in user found.");
            return;
        }

        setBusy(true);
        setMsg("");

        try {
            await approveProcurementServer(Number(master?.id), uid);
            await load();
            setMsg("Approved successfully.");
        } catch (err: unknown) {
            setMsg(getErrorMessage(err, "Failed to approve"));
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
                procurement_id: Number(master?.id),
                encoder_id: encoderId,
                approver_id: master?.approved_by ?? encoderId,
                receiver_id: null,
                default_tax_rate: 12,
                create_items: true,
            });

            await load();
            setMsg(`PO created: ${out.purchase_order_no}`);
        } catch (err: unknown) {
            setMsg(getErrorMessage(err, "Failed to generate PO."));
        } finally {
            setBusy(false);
        }
    }

    function updateDraftRow(rowId: number, patch: Partial<Draft>): void {
        setDrafts((prev) => {
            const cur = prev[rowId] || {
                qty: 0,
                unit_price: 0,
                total: 0,
                uom: "",
                dirty: false,
            };

            const next: Draft = { ...cur, ...patch };

            if (patch.qty !== undefined || patch.unit_price !== undefined) {
                const qty = patch.qty !== undefined ? patch.qty : cur.qty;
                const unitPrice =
                    patch.unit_price !== undefined ? patch.unit_price : cur.unit_price;

                next.total = Number(qty || 0) * Number(unitPrice || 0);
                next.dirty = true;
            }

            if (patch.uom !== undefined && patch.uom !== cur.uom) {
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

            await recomputeProcurementTotal(line.procurement_id);
            await load();
            setMsg(`Saved line #${line.id}.`);
        } catch (err: unknown) {
            setMsg(getErrorMessage(err, "Failed to save line."));
            updateDraftRow(line.id, { saving: false });
        }
    }

    const [addOpen, setAddOpen] = React.useState(false);
    const [tmplSearch, setTmplSearch] = React.useState("");
    const [tmplList, setTmplList] = React.useState<ItemTemplate[]>([]);
    const [addTmplId, setAddTmplId] = React.useState<number | 0>(0);
    const [variantList, setVariantList] = React.useState<ItemVariant[]>([]);
    const [addVariantId, setAddVariantId] = React.useState<number | 0>(0);
    const [addUom, setAddUom] = React.useState("");
    const [addQty, setAddQty] = React.useState<number>(1);
    const [addPrice, setAddPrice] = React.useState<number>(0);
    const addTotal = Number(addQty || 0) * Number(addPrice || 0);
    const [addBusy, setAddBusy] = React.useState(false);

    React.useEffect(() => {
        const run = async (): Promise<void> => {
            if (!addOpen) return;
            const data = await listItemTemplates(tmplSearch || "");
            setTmplList(data);
        };

        void run();
    }, [tmplSearch, addOpen]);

    React.useEffect(() => {
        const run = async (): Promise<void> => {
            if (!addOpen || !addTmplId) {
                setVariantList([]);
                setAddVariantId(0);
                setAddUom("");
                return;
            }

            const tmpl = tmplList.find((item) => item.id === addTmplId);
            setAddUom(tmpl?.uom || "");

            const variants = await listItemVariants(addTmplId);
            setVariantList(variants);

            if (variants.length === 0) {
                setAddVariantId(0);
                setAddPrice(Number(tmpl?.base_price || 0));
            } else {
                setAddVariantId(0);
                setAddPrice(0);
            }
        };

        void run();
    }, [addOpen, addTmplId, tmplList]);

    React.useEffect(() => {
        if (!addOpen) return;

        if (!addVariantId) {
            const tmpl = tmplList.find((item) => item.id === addTmplId);
            setAddPrice(Number(tmpl?.base_price || 0));
            return;
        }

        const variant = variantList.find((item) => item.id === addVariantId);
        setAddPrice(Number(variant?.list_price || 0));
    }, [addOpen, addVariantId, addTmplId, tmplList, variantList]);

    async function doAddLine(): Promise<void> {
        if (!master?.id) return;

        if (!addTmplId) {
            setMsg("Select an item template to add.");
            return;
        }

        setAddBusy(true);
        setMsg("");

        try {
            await createProcurementDetail({
                procurement_id: Number(master.id),
                item_template_id: addTmplId || null,
                item_variant_id: addVariantId || null,
                uom: addUom || "",
                qty: Number(addQty || 0),
                unit_price: Number(addPrice || 0),
            });

            await recomputeProcurementTotal(Number(master.id));

            setAddOpen(false);
            setAddTmplId(0);
            setAddVariantId(0);
            setVariantList([]);
            setAddUom("");
            setAddQty(1);
            setAddPrice(0);

            await load();
            setMsg("Item added.");
        } catch (err: unknown) {
            setMsg(getErrorMessage(err, "Failed to add item."));
        } finally {
            setAddBusy(false);
        }
    }

    async function doDeleteLine(row: ProcurementDetail): Promise<void> {
        if (!row.id) return;

        if (!window.confirm("Remove this line?")) return;

        try {
            await deleteProcurementDetail(row.id);
            await recomputeProcurementTotal(row.procurement_id);
            await load();
            setMsg(`Removed line #${row.id}.`);
        } catch (err: unknown) {
            setMsg(getErrorMessage(err, "Failed to remove line."));
        }
    }

    const grandTotal =
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

    const supplierName =
        typeof master?.supplier_id === "number"
            ? supplier?.supplier_name ?? `#${master.supplier_id}`
            : supplier?.supplier_name ?? "—";

    const handlePrint = (): void => {
        if (printRef.current) {
            printNodeWithIframe(
                printRef.current,
                `Procurement ${master?.procurement_no ?? ""}`
            );
        }
    };

    return (
        <>
            <div
                className={`fixed inset-0 z-[60] ${open ? "" : "pointer-events-none"}`}
                aria-hidden={!open}
            >
                <div
                    className={`absolute inset-0 bg-black/40 transition-opacity ${
                        open ? "opacity-100" : "opacity-0"
                    }`}
                    onClick={onClose}
                />
                <div
                    className={`absolute left-1/2 top-1/2 w-[min(100vw-24px,1100px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-xl transition-all ${
                        open ? "scale-100 opacity-100" : "scale-95 opacity-0"
                    }`}
                >
                    <div className="flex items-center justify-between border-b px-4 py-3">
                        <div className="font-semibold">
                            Procurement{" "}
                            {master?.procurement_no
                                ? `#${master.procurement_no}`
                                : master?.id
                                    ? `#${master.id}`
                                    : ""}
                        </div>
                        <div className="flex gap-2">
                            {!!master?.po_no && (
                                <button
                                    className="rounded-xl border px-3 py-1.5 text-sm"
                                    onClick={() => {
                                        setPoIdForModal(Number(master.po_no) || null);
                                        setPoModalOpen(true);
                                    }}
                                    type="button"
                                >
                                    View PO
                                </button>
                            )}
                            <button
                                onClick={handlePrint}
                                className="rounded-xl border px-3 py-1.5 text-sm"
                                type="button"
                            >
                                Print
                            </button>
                            <button
                                onClick={onClose}
                                className="rounded-xl border px-3 py-1.5 text-sm"
                                type="button"
                            >
                                Close
                            </button>
                        </div>
                    </div>

                    {(msg || error) && (
                        <div
                            className={`mx-4 mt-3 rounded-xl border p-3 text-sm ${
                                error
                                    ? "border-rose-200 bg-rose-50 text-rose-700"
                                    : msg.toLowerCase().includes("po created") ||
                                    msg.toLowerCase().includes("approved")
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                        : "border-slate-200 bg-slate-50"
                            }`}
                        >
                            {error || msg}
                        </div>
                    )}

                    <div className="max-h-[78vh] overflow-auto p-4">
                        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                            <div className="border-b px-4 py-3 text-sm font-semibold">
                                Header
                            </div>
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
                                <Info label="Supplier" value={supplierName} />
                                <Info
                                    label="Payment Terms"
                                    value={supplier?.payment_terms ?? ""}
                                />
                                <Info label="TIN" value={supplier?.tin_number ?? ""} />
                                <Info label="Email" value={supplier?.email_address ?? ""} />
                                <Info
                                    label="Phone"
                                    value={supplier?.phone_number ?? ""}
                                />
                                <Info label="Address" value={supplier?.address ?? ""} />
                            </div>
                        </div>

                        <div className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm">
                            <div className="flex items-center justify-between border-b px-4 py-3">
                                <div className="text-sm font-semibold">Items</div>
                                {!approved && (
                                    <div className="flex gap-2">
                                        {!addOpen ? (
                                            <button
                                                className="rounded-xl bg-emerald-600 px-3 py-2 text-white"
                                                onClick={() => setAddOpen(true)}
                                                type="button"
                                            >
                                                + Add Item
                                            </button>
                                        ) : (
                                            <button
                                                className="rounded-xl border px-3 py-2"
                                                onClick={() => setAddOpen(false)}
                                                type="button"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {addOpen && !approved && (
                                <div className="grid gap-2 border-b p-3 md:grid-cols-6">
                                    <div className="grid gap-1 md:col-span-2">
                                        <input
                                            className="rounded-xl border px-3 py-2"
                                            placeholder="Search item templates…"
                                            value={tmplSearch}
                                            onChange={(e) => setTmplSearch(e.target.value)}
                                        />
                                        <select
                                            className="rounded-xl border px-3 py-2"
                                            value={addTmplId}
                                            onChange={(e) =>
                                                setAddTmplId(Number(e.target.value))
                                            }
                                        >
                                            <option value={0}>Select template</option>
                                            {tmplList.map((template) => (
                                                <option
                                                    key={template.id}
                                                    value={template.id}
                                                >
                                                    {template.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <select
                                            className="w-full rounded-xl border px-3 py-2"
                                            value={addVariantId}
                                            onChange={(e) =>
                                                setAddVariantId(Number(e.target.value))
                                            }
                                            disabled={
                                                !addTmplId || variantList.length === 0
                                            }
                                        >
                                            <option value={0}>No variant</option>
                                            {variantList.map((variant) => (
                                                <option key={variant.id} value={variant.id}>
                                                    {variant.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <input
                                            className="w-full rounded-xl border px-3 py-2"
                                            placeholder="UOM"
                                            value={addUom}
                                            onChange={(e) => setAddUom(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <input
                                            type="number"
                                            min={1}
                                            className="w-full rounded-xl border px-3 py-2"
                                            value={addQty}
                                            onChange={(e) =>
                                                setAddQty(Number(e.target.value))
                                            }
                                        />
                                    </div>
                                    <div>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min={0}
                                            className="w-full rounded-xl border px-3 py-2"
                                            value={addPrice}
                                            onChange={(e) =>
                                                setAddPrice(Number(e.target.value))
                                            }
                                        />
                                    </div>
                                    <div className="flex items-center justify-between md:col-span-6">
                                        <div className="text-sm text-slate-600">
                                            Total: <b>₱ {addTotal.toFixed(2)}</b>
                                        </div>
                                        <button
                                            onClick={doAddLine}
                                            disabled={addBusy}
                                            className="rounded-xl bg-blue-600 px-4 py-2 text-white"
                                            type="button"
                                        >
                                            {addBusy ? "Adding…" : "Add"}
                                        </button>
                                    </div>
                                </div>
                            )}

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
                                        const uom =
                                            draft?.uom ||
                                            line.uom ||
                                            (line.item_template_id
                                                ? tmplUoms[line.item_template_id]
                                                : "") ||
                                            "";

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
                                                    <input
                                                        className="w-28 rounded-xl border px-3 py-2"
                                                        value={uom}
                                                        onChange={(e) =>
                                                            updateDraftRow(line.id, {
                                                                uom: e.target.value,
                                                            })
                                                        }
                                                        disabled={approved || saving}
                                                    />
                                                </td>
                                                <td className="p-3">
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        className="w-24 rounded-xl border px-3 py-2"
                                                        value={draft?.qty ?? line.qty}
                                                        onChange={(e) =>
                                                            updateDraftRow(line.id, {
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
                                                        className="w-32 rounded-xl border px-3 py-2"
                                                        value={
                                                            draft?.unit_price ??
                                                            line.unit_price
                                                        }
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
                                                        (draft?.qty ?? line.qty ?? 0) *
                                                        (draft?.unit_price ??
                                                            line.unit_price ??
                                                            0)
                                                    ).toFixed(2)}
                                                </td>
                                                <td className="p-3">
                                                    {line.date_added}
                                                </td>
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
                                                        {!approved && (
                                                            <button
                                                                type="button"
                                                                className="rounded-xl bg-rose-600 px-3 py-1 text-white"
                                                                onClick={() =>
                                                                    void doDeleteLine(line)
                                                                }
                                                            >
                                                                Delete
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            className="rounded-xl border px-3 py-1 disabled:opacity-50"
                                                            onClick={() => {
                                                                const existing =
                                                                    drafts[line.id];

                                                                setDrafts((prev) => ({
                                                                    ...prev,
                                                                    [line.id]: {
                                                                        qty: Number(
                                                                            line.qty || 0
                                                                        ),
                                                                        unit_price: Number(
                                                                            line.unit_price ||
                                                                            0
                                                                        ),
                                                                        total: Number(
                                                                            line.total_amount ??
                                                                            Number(
                                                                                line.qty ||
                                                                                0
                                                                            ) *
                                                                            Number(
                                                                                line.unit_price ||
                                                                                0
                                                                            )
                                                                        ),
                                                                        uom:
                                                                            line.uom ??
                                                                            existing?.uom ??
                                                                            "",
                                                                        dirty: false,
                                                                    },
                                                                }));
                                                            }}
                                                            disabled={
                                                                approved ||
                                                                !draft?.dirty ||
                                                                saving
                                                            }
                                                        >
                                                            Revert
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="rounded-xl bg-blue-600 px-3 py-1 text-white disabled:opacity-50"
                                                            onClick={() =>
                                                                void saveRow(line)
                                                            }
                                                            disabled={
                                                                approved ||
                                                                !draft?.dirty ||
                                                                saving
                                                            }
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
                                <b>₱ {Number(grandTotal || 0).toFixed(2)}</b>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between border-t px-4 py-3">
                        <div className="text-sm text-slate-500">
                            {master?.status}
                            {master?.isApproved ? " · Approved" : ""}
                        </div>
                        <div className="flex gap-2">
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
                            <button
                                className="rounded-xl bg-emerald-600 px-3 py-2 text-white disabled:opacity-50"
                                onClick={onApprove}
                                disabled={!canApprove || busy}
                                title={
                                    canApprove
                                        ? "Approve this procurement"
                                        : "Already approved"
                                }
                                type="button"
                            >
                                {busy
                                    ? "Working…"
                                    : master?.isApproved
                                        ? "Approved"
                                        : "Approve"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div
                aria-hidden
                style={{
                    position: "fixed",
                    left: "-200vw",
                    top: 0,
                    width: "210mm",
                    background: "white",
                    padding: 0,
                }}
            >
                <div ref={printRef}>
                    <InvoicePrint
                        title="PROCUREMENT"
                        poNumber={poNumber || ""}
                        master={master}
                        supplier={supplier}
                        details={details}
                        itemNames={itemNames}
                        variantNames={variantNames}
                        uomMap={tmplUoms}
                    />
                </div>
            </div>

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
            <div className="text-[11px] uppercase tracking-wider text-slate-500">
                {label}
            </div>
            <div className="font-medium text-slate-800">{value || "—"}</div>
        </div>
    );
}

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
    supplier: SupplierExtras | null;
    details: ProcurementDetail[];
    itemNames: Record<number, string>;
    variantNames: Record<number, string>;
    uomMap: Record<number, string>;
}) {
    const grand =
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
        <div className="w-a4">
            <header className="mb-3 flex items-start justify-between">
                <div>
                    <div className="h1">{title}</div>
                    {poNumber && <div className="muted">PO No: {poNumber}</div>}
                    <div className="muted">PR No: {master?.procurement_no ?? "—"}</div>
                    <div className="muted">Lead Date: {master?.lead_date ?? "—"}</div>
                    <div className="muted">
                        Status: {master?.status ?? "—"}
                        {master?.isApproved ? " (Approved)" : ""}
                    </div>
                </div>
                <div className="text-right text-sm">
                    <div className="font-semibold">
                        {supplier?.supplier_name ??
                            (master ? `Supplier #${master.supplier_id ?? ""}` : "—")}
                    </div>
                    <div>{supplier?.address}</div>
                    <div>
                        {supplier?.email_address}
                        {supplier?.phone_number
                            ? ` · ${supplier.phone_number}`
                            : ""}
                    </div>
                    <div>
                        {supplier?.tin_number ? `TIN: ${supplier.tin_number}` : ""}
                    </div>
                    <div>
                        {supplier?.payment_terms
                            ? `Terms: ${supplier.payment_terms}`
                            : ""}
                    </div>
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
                {details.map((line) => {
                    const uom =
                        line.uom ||
                        (line.item_template_id
                            ? uomMap[line.item_template_id]
                            : "") ||
                        "—";

                    const total = Number(
                        line.total_amount ??
                        Number(line.qty || 0) * Number(line.unit_price || 0)
                    );

                    return (
                        <tr key={line.id}>
                            <td>
                                {(line.item_template_id &&
                                        itemNames[line.item_template_id]) ||
                                    "—"}
                            </td>
                            <td>
                                {(line.item_variant_id &&
                                        variantNames[line.item_variant_id]) ||
                                    "—"}
                            </td>
                            <td>{uom}</td>
                            <td className="text-right">
                                {Number(line.qty || 0).toFixed(2)}
                            </td>
                            <td className="text-right">
                                ₱ {Number(line.unit_price || 0).toFixed(2)}
                            </td>
                            <td className="text-right">₱ {total.toFixed(2)}</td>
                        </tr>
                    );
                })}
                {details.length === 0 && (
                    <tr>
                        <td
                            colSpan={6}
                            className="py-6 text-center text-slate-500"
                        >
                            No lines.
                        </td>
                    </tr>
                )}
                </tbody>
                <tfoot>
                <tr>
                    <td colSpan={5} className="pt-3 text-right font-semibold">
                        Grand Total
                    </td>
                    <td className="pt-3 text-right font-bold">
                        ₱ {Number(grand || 0).toFixed(2)}
                    </td>
                </tr>
                </tfoot>
            </table>

            <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
                <div>
                    <div className="font-semibold">Prepared By</div>
                    <div className="mt-12 w-56 border-t" />
                </div>
                <div>
                    <div className="font-semibold">Approved By</div>
                    <div className="mt-12 w-56 border-t" />
                </div>
            </div>
        </div>
    );
}