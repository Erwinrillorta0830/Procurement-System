"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type PaymentTerm = {
    id: number;
    payment_name: string;
    payment_days?: number | null;
};

type FormState = {
    supplier_name: string;
    supplier_shortcut: string;
    contact_person: string;
    phone_number: string;
    email_address: string;
    address: string;
    city: string;
    state_province: string;
    country: string;
    postal_code: string;
    payment_terms: string;
    delivery_terms: string;
    tin_number: string;
    notes_or_comments: string;
    preferred_communication_method: string;
    isActive: boolean;
};

type DirectusListResponse<T> = {
    data?: T[];
};

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

export default function CreateSupplierPage() {
    const router = useRouter();

    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [form, setForm] = useState<FormState>({
        supplier_name: "",
        supplier_shortcut: "",
        contact_person: "",
        phone_number: "",
        email_address: "",
        address: "",
        city: "",
        state_province: "",
        country: "Philippines",
        postal_code: "",
        payment_terms: "",
        delivery_terms: "Delivery",
        tin_number: "",
        notes_or_comments: "",
        preferred_communication_method: "",
        isActive: true,
    });

    const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([]);
    const [ptLoading, setPtLoading] = useState(true);
    const [ptError, setPtError] = useState<string | null>(null);

    const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    useEffect(() => {
        let cancelled = false;

        const loadPaymentTerms = async (): Promise<void> => {
            try {
                setPtLoading(true);
                setPtError(null);

                const params = new URLSearchParams({
                    sort: "payment_name",
                    limit: "100",
                });

                const response = await fetch(`/api/items/payment_terms?${params.toString()}`, {
                    method: "GET",
                    cache: "no-store",
                });

                if (!response.ok) {
                    throw new Error(`Failed to load payment terms (${response.status})`);
                }

                const json = (await response.json()) as DirectusListResponse<PaymentTerm>;
                const data = Array.isArray(json.data) ? json.data : [];

                if (!cancelled) {
                    setPaymentTerms(data);

                    setForm((prev) => ({
                        ...prev,
                        payment_terms:
                            prev.payment_terms || (data.length > 0 ? data[0].payment_name : ""),
                    }));
                }
            } catch (error: unknown) {
                if (!cancelled) {
                    setPtError(getErrorMessage(error, "Failed to load payment terms"));
                }
            } finally {
                if (!cancelled) {
                    setPtLoading(false);
                }
            }
        };

        void loadPaymentTerms();

        return () => {
            cancelled = true;
        };
    }, []);

    async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
        e.preventDefault();
        setErr(null);

        const required = (value: string): boolean => value.trim().length > 0;

        if (!required(form.supplier_name)) {
            setErr("Supplier name is required.");
            return;
        }

        if (!required(form.supplier_shortcut)) {
            setErr("Supplier shortcut is required.");
            return;
        }

        if (!required(form.contact_person)) {
            setErr("Contact person is required.");
            return;
        }

        if (!required(form.payment_terms)) {
            setErr("Payment terms is required.");
            return;
        }

        try {
            setSaving(true);

            const payload = {
                supplier_type: "NON-TRADE",
                supplier_name: form.supplier_name,
                supplier_shortcut: form.supplier_shortcut,
                contact_person: form.contact_person,
                phone_number: form.phone_number || "0",
                email_address: form.email_address || "N/A",
                address: form.address,
                city: form.city,
                state_province: form.state_province,
                country: form.country || "Philippines",
                postal_code: form.postal_code,
                payment_terms: form.payment_terms,
                delivery_terms: form.delivery_terms || "Delivery",
                tin_number: form.tin_number,
                notes_or_comments: form.notes_or_comments,
                preferred_communication_method: form.preferred_communication_method,
                isActive: form.isActive ? 1 : 0,
                date_added: new Date().toISOString().slice(0, 10),
            };

            const response = await fetch("/api/items/suppliers", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const text = await response.text().catch(() => "");
                throw new Error(`Create failed (${response.status}): ${text}`);
            }

            router.push("/app/supplier");
        } catch (error: unknown) {
            setErr(getErrorMessage(error, "Failed to create supplier"));
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="p-4 md:p-6">
            <div className="mb-4 flex items-center gap-3">
                <h2 className="text-lg font-semibold text-slate-800">
                    Create Supplier (Non-Trade)
                </h2>
                <div className="ml-auto">
                    <button
                        onClick={() => router.push("/app/supplier")}
                        className="rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-slate-800 outline-none hover:bg-slate-200 focus:ring-2 ring-blue-500"
                        type="button"
                    >
                        ← Back to list
                    </button>
                </div>
            </div>

            <form
                onSubmit={onSubmit}
                className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2 md:p-6"
            >
                {err && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700 md:col-span-2">
                        {err}
                    </div>
                )}

                <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 md:col-span-2">
                    Supplier Type is locked to <strong>NON-TRADE</strong> for Procurement.
                </div>

                <div className="grid gap-3">
                    <div>
                        <label className="mb-1 block text-sm text-slate-700">
                            Supplier Name *
                        </label>
                        <input
                            value={form.supplier_name}
                            onChange={(e) => set("supplier_name", e.target.value)}
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-sm text-slate-700">
                                Shortcut *
                            </label>
                            <input
                                value={form.supplier_shortcut}
                                onChange={(e) => set("supplier_shortcut", e.target.value)}
                                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm text-slate-700">
                                Supplier Type
                            </label>
                            <input
                                value="NON-TRADE"
                                readOnly
                                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-slate-600"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-sm text-slate-700">
                                Contact Person *
                            </label>
                            <input
                                value={form.contact_person}
                                onChange={(e) => set("contact_person", e.target.value)}
                                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm text-slate-700">
                                Phone
                            </label>
                            <input
                                value={form.phone_number}
                                onChange={(e) => set("phone_number", e.target.value)}
                                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-sm text-slate-700">
                                Email
                            </label>
                            <input
                                type="email"
                                value={form.email_address}
                                onChange={(e) => set("email_address", e.target.value)}
                                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm text-slate-700">
                                TIN No.
                            </label>
                            <input
                                value={form.tin_number}
                                onChange={(e) => set("tin_number", e.target.value)}
                                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="grid gap-3">
                    <div>
                        <label className="mb-1 block text-sm text-slate-700">
                            Address
                        </label>
                        <input
                            value={form.address}
                            onChange={(e) => set("address", e.target.value)}
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="mb-1 block text-sm text-slate-700">
                                City
                            </label>
                            <input
                                value={form.city}
                                onChange={(e) => set("city", e.target.value)}
                                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm text-slate-700">
                                State/Province
                            </label>
                            <input
                                value={form.state_province}
                                onChange={(e) => set("state_province", e.target.value)}
                                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm text-slate-700">
                                Postal Code
                            </label>
                            <input
                                value={form.postal_code}
                                onChange={(e) => set("postal_code", e.target.value)}
                                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-sm text-slate-700">
                                Payment Terms *
                            </label>
                            <select
                                value={form.payment_terms}
                                onChange={(e) => set("payment_terms", e.target.value)}
                                disabled={ptLoading || Boolean(ptError)}
                                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-2 ring-blue-500 disabled:opacity-60"
                                required
                            >
                                {ptLoading && <option>Loading…</option>}
                                {ptError && <option value="">Failed to load</option>}
                                {!ptLoading && !ptError && paymentTerms.length === 0 && (
                                    <option value="">No options</option>
                                )}
                                {!ptLoading &&
                                    !ptError &&
                                    paymentTerms.map((paymentTerm) => (
                                        <option
                                            key={paymentTerm.id}
                                            value={paymentTerm.payment_name}
                                        >
                                            {paymentTerm.payment_name}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm text-slate-700">
                                Delivery Terms
                            </label>
                            <input
                                value={form.delivery_terms}
                                onChange={(e) => set("delivery_terms", e.target.value)}
                                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm text-slate-700">
                            Preferred Communication
                        </label>
                        <input
                            value={form.preferred_communication_method}
                            onChange={(e) =>
                                set("preferred_communication_method", e.target.value)
                            }
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                        />
                    </div>

                    <div className="grid grid-cols-2 items-center gap-3">
                        <div className="col-span-1">
                            <label className="mb-1 block text-sm text-slate-700">
                                Active
                            </label>
                            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={form.isActive}
                                    onChange={(e) => set("isActive", e.target.checked)}
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                Active supplier
                            </label>
                        </div>
                    </div>
                </div>

                <div className="md:col-span-2">
                    <label className="mb-1 block text-sm text-slate-700">Notes</label>
                    <textarea
                        value={form.notes_or_comments}
                        onChange={(e) => set("notes_or_comments", e.target.value)}
                        rows={3}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                    />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 md:col-span-2">
                    <button
                        type="button"
                        onClick={() => router.push("/app/supplier")}
                        className="rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-slate-800 outline-none hover:bg-slate-200 focus:ring-2 ring-blue-500"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="rounded-md bg-blue-600 px-3 py-2 text-white outline-none hover:bg-blue-700 focus:ring-2 ring-blue-500 disabled:opacity-60"
                    >
                        {saving ? "Saving…" : "Save Supplier"}
                    </button>
                </div>
            </form>
        </section>
    );
}