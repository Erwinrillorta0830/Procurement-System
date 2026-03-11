import { api, nowISOManila, todayManila } from "./_base";

export type Procurement = {
    id: number;
    procurement_no: string;
    supplier_id: number;
    lead_date: string | null;
    total_amount: number | null;
    created_at?: string | null;
    updated_at?: string | null;
    encoder_id?: number | null;
    department_id?: number | null;
    po_no?: number | null;
    isApproved?: 0 | 1;
    approved_by?: number | null;
    approved_date?: string | null;
    transaction_type?: "trade" | "non-trade" | null;
    status?: "draft" | "pending" | "approved" | "rejected" | "cancelled" | null;
};

export type ProcurementDetailInput = {
    item_template_id?: number | null;
    item_variant_id?: number | null;
    item_name: string;
    item_description?: string | null;
    uom?: string | null;
    qty: number;
    unit_price: number;
    link?: string | null;
};

export interface Supplier {
    id: number;
    supplier_name: string;
    address?: string;
    contact_person?: string;
    email_address?: string;
}

export type ProcurementDetail = {
    id: number;
    procurement_id: number;
    item_variant_id?: number | null;
    item_template_id?: number | null;
    qty: number;
    unit_price: number;
    total_amount: number;
    date_added: string;
    supplier?: number | null;
    link?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    uom?: string | null;
};

type SupplierTypeItemResponse = {
    data?: {
        supplier_type?: string | null;
    };
};

type SupplierTypeListResponse = {
    data?: Array<{
        supplier_type?: string | null;
    }>;
};

type ProcurementResponse = {
    data: Procurement;
};

type ProcurementListResponse = {
    data: Procurement[];
};

type ProcurementDetailResponse = {
    data: ProcurementDetail;
};

type ProcurementDetailListResponse = {
    data: ProcurementDetail[];
};

type RecomputeDetailRow = {
    total_amount?: number;
    qty?: number;
    unit_price?: number;
};

type RecomputeDetailListResponse = {
    data: RecomputeDetailRow[];
};

type PatchProcurementDetailInput = {
    id: number;
    qty: number;
    unit_price: number;
    uom?: string | null;
};

// ---------- utils ----------
const norm = (value: string | null | undefined): string => (value ?? "").trim();
const up = (value: string | null | undefined): string => norm(value).toUpperCase();

function prefixFromType(typeValue: string | null | undefined): "PRTR" | "PRNT" | "PR" {
    const typeUpper = up(typeValue);
    const isNonTrade =
        /NON[\s_\-–—]*TRADE/.test(typeUpper) ||
        typeUpper === "NON" ||
        typeUpper.startsWith("NON-") ||
        typeUpper.startsWith("NON ");

    if (isNonTrade) return "PRNT";
    if (typeUpper.includes("TRADE")) return "PRTR";
    return "PR";
}

async function resolveTypeAndPrefix(supplierId: number): Promise<{
    supplier_type_raw: string | null;
    prefix: "PRTR" | "PRNT" | "PR";
    transaction_type: "trade" | "non-trade" | null;
}> {
    try {
        const response = await api<SupplierTypeItemResponse>(
            `suppliers/${supplierId}?fields=supplier_type`
        );

        const supplierType = response.data?.supplier_type ?? null;

        if (norm(supplierType)) {
            const prefix = prefixFromType(supplierType);
            const transactionType =
                prefix === "PRNT" ? "non-trade" : prefix === "PRTR" ? "trade" : null;

            return {
                supplier_type_raw: supplierType,
                prefix,
                transaction_type: transactionType,
            };
        }
    } catch {
        // continue to fallback
    }

    try {
        const filter = encodeURIComponent(JSON.stringify({ id: { _eq: supplierId } }));
        const response = await api<SupplierTypeListResponse>(
            `suppliers?filter=${filter}&fields=supplier_type&limit=1`
        );

        const supplierType = response.data?.[0]?.supplier_type ?? null;

        if (norm(supplierType)) {
            const prefix = prefixFromType(supplierType);
            const transactionType =
                prefix === "PRNT" ? "non-trade" : prefix === "PRTR" ? "trade" : null;

            return {
                supplier_type_raw: supplierType,
                prefix,
                transaction_type: transactionType,
            };
        }
    } catch {
        // continue to unknown
    }

    return {
        supplier_type_raw: null,
        prefix: "PR",
        transaction_type: null,
    };
}

// ---------- API ----------
export async function listSuppliers(): Promise<Supplier[]> {
    const response = await api<{ data?: Supplier[] }>("suppliers");
    return response.data ?? [];
}

export async function createProcurementWithDetails(args: {
    supplier_id: number;
    lead_date?: string | null;
    encoder_id?: number | null;
    department_id?: number | null;
    status?: "draft" | "pending" | "approved" | "rejected" | "cancelled";
    items: ProcurementDetailInput[];
    transaction_type?: "trade" | "non-trade";
}) {
    if (!args.supplier_id) throw new Error("supplier_id is required");
    if (!args.items.length) throw new Error("At least one detail line is required");

    const { supplier_type_raw, prefix, transaction_type } = await resolveTypeAndPrefix(
        args.supplier_id
    );

    const procurement_no = `${prefix}-${new Date().getFullYear()}-${String(
        Math.floor(Math.random() * 999999)
    ).padStart(6, "0")}`;

    const detailTotals = args.items.map(
        (item) => Number(item.qty || 0) * Number(item.unit_price || 0)
    );
    const total_amount = detailTotals.reduce((sum, value) => sum + value, 0);

    const masterResponse = await api<ProcurementResponse>("procurement", {
        method: "POST",
        body: JSON.stringify({
            procurement_no,
            supplier_id: args.supplier_id,
            lead_date: args.lead_date ?? todayManila(),
            total_amount,
            created_at: nowISOManila(),
            updated_at: nowISOManila(),
            encoder_id: args.encoder_id ?? null,
            department_id: args.department_id ?? null,
            isApproved: 0,
            transaction_type,
            status: args.status ?? "pending",
        }),
    });

    const procurement = masterResponse.data;

    const detailsPayload = args.items.map((item) => ({
        procurement_id: procurement.id,
        item_variant_id: item.item_variant_id ?? null,
        item_template_id: item.item_template_id ?? null,
        qty: Number(item.qty || 0),
        unit_price: Number(item.unit_price || 0),
        total_amount: Number(item.qty || 0) * Number(item.unit_price || 0),
        date_added: todayManila(),
        supplier: args.supplier_id,
        link: item.link ?? null,
        created_at: nowISOManila(),
        updated_at: nowISOManila(),
        uom: item.uom ?? null,
    }));

    await api("procurement_details", {
        method: "POST",
        body: JSON.stringify(detailsPayload),
    });

    const recalculatedTotal = detailTotals.reduce((sum, value) => sum + value, 0);

    if (Math.abs(recalculatedTotal - (procurement.total_amount || 0)) > 0.009) {
        await api(`procurement/${procurement.id}`, {
            method: "PATCH",
            body: JSON.stringify({
                total_amount: recalculatedTotal,
                updated_at: nowISOManila(),
            }),
        });
    }

    console.log("[createProcurementWithDetails]", {
        supplier_id: args.supplier_id,
        supplier_type_raw,
        prefix_used: prefix,
        resolved_transaction_type: transaction_type,
        procurement_no,
    });

    return {
        procurement_id: procurement.id,
        procurement_no,
    };
}

export async function listProcurements(opts?: {
    search?: string;
    status?: string;
}): Promise<Procurement[]> {
    const params = new URLSearchParams();
    const filter: Record<string, unknown> = {};

    if (opts?.search) {
        filter._or = [
            { procurement_no: { _contains: opts.search } },
            { transaction_type: { _contains: opts.search } },
            { status: { _contains: opts.search } },
        ];
    }

    if (opts?.status && opts.status !== "all") {
        filter.status = { _eq: opts.status };
    }

    if (Object.keys(filter).length > 0) {
        params.set("filter", JSON.stringify(filter));
    }

    params.set("sort", "-created_at");
    params.set("limit", "200");

    const response = await api<ProcurementListResponse>(
        `procurement?${params.toString()}`
    );

    return response.data ?? [];
}

export async function getProcurement(id: number): Promise<Procurement> {
    const response = await api<ProcurementResponse>(`procurement/${id}`);
    return response.data;
}

export async function getProcurementDetails(
    procurement_id: number
): Promise<ProcurementDetail[]> {
    const params = new URLSearchParams();
    params.set("filter", JSON.stringify({ procurement_id: { _eq: procurement_id } }));
    params.set("sort", "id");
    params.set("limit", "500");

    const response = await api<ProcurementDetailListResponse>(
        `procurement_details?${params.toString()}`
    );

    return response.data ?? [];
}

export async function approveProcurementServer(id: number, approved_by: number) {
    return api(`procurement/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
            isApproved: 1,
            status: "approved",
            approved_by,
            approved_date: nowISOManila(),
            updated_at: nowISOManila(),
        }),
    });
}

export async function updateProcurementDetail(
    detail: PatchProcurementDetailInput
) {
    const total_amount = Number(detail.qty || 0) * Number(detail.unit_price || 0);

    const body: {
        qty: number;
        unit_price: number;
        total_amount: number;
        updated_at: string;
        uom?: string | null;
    } = {
        qty: Number(detail.qty || 0),
        unit_price: Number(detail.unit_price || 0),
        total_amount,
        updated_at: nowISOManila(),
    };

    if (detail.uom !== undefined) {
        body.uom = detail.uom;
    }

    return api(`procurement_details/${detail.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
    });
}

export async function createProcurementDetail(input: {
    procurement_id: number;
    item_template_id?: number | null;
    item_variant_id?: number | null;
    uom?: string | null;
    qty: number;
    unit_price: number;
    link?: string | null;
}): Promise<ProcurementDetail> {
    const payload = {
        procurement_id: input.procurement_id,
        item_template_id: input.item_template_id ?? null,
        item_variant_id: input.item_variant_id ?? null,
        uom: input.uom ?? null,
        qty: Number(input.qty || 0),
        unit_price: Number(input.unit_price || 0),
        total_amount: Number(input.qty || 0) * Number(input.unit_price || 0),
        date_added: todayManila(),
        created_at: nowISOManila(),
        updated_at: nowISOManila(),
        link: input.link ?? null,
    };

    const response = await api<ProcurementDetailResponse>("procurement_details", {
        method: "POST",
        body: JSON.stringify(payload),
    });

    return response.data;
}

export async function deleteProcurementDetail(id: number): Promise<boolean> {
    await api(`procurement_details/${id}`, {
        method: "DELETE",
    });

    return true;
}

export async function recomputeProcurementTotal(
    procurement_id: number
): Promise<number> {
    const params = new URLSearchParams();
    params.set("filter", JSON.stringify({ procurement_id: { _eq: procurement_id } }));
    params.set("limit", "500");

    const response = await api<RecomputeDetailListResponse>(
        `procurement_details?${params.toString()}`
    );

    const total = (response.data ?? []).reduce((sum, row) => {
        const lineTotal =
            row.total_amount ?? Number(row.qty || 0) * Number(row.unit_price || 0);
        return sum + Number(lineTotal || 0);
    }, 0);

    await api(`procurement/${procurement_id}`, {
        method: "PATCH",
        body: JSON.stringify({
            total_amount: total,
            updated_at: nowISOManila(),
        }),
    });

    return total;
}