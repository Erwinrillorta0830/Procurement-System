'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_ROOT = (process.env.NEXT_PUBLIC_DIRECTUS_URL?.replace(/\/$/, '') || 'http://100.126.246.124:8060');
const SUPPLIERS_API = `${API_ROOT}/items/suppliers`;
const PAYMENT_TERMS_API = `${API_ROOT}/items/payment_terms`;

type PaymentTerm = { id: number; payment_name: string; payment_days?: number | null };

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

export default function CreateSupplierPage() {
    const router = useRouter();

    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [form, setForm] = useState<FormState>({
        supplier_name: '',
        supplier_shortcut: '',
        contact_person: '',
        phone_number: '',
        email_address: '',
        address: '',
        city: '',
        state_province: '',
        country: 'Philippines',
        postal_code: '',
        payment_terms: '',
        delivery_terms: 'Delivery',
        tin_number: '',
        notes_or_comments: '',
        preferred_communication_method: '',
        isActive: true,
    });

    const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([]);
    const [ptLoading, setPtLoading] = useState(true);
    const [ptError, setPtError] = useState<string | null>(null);

    const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setPtLoading(true);
                setPtError(null);
                const res = await fetch(`${PAYMENT_TERMS_API}?${new URLSearchParams({ sort: 'payment_name', limit: '100' })}`, { cache: 'no-store' });
                if (!res.ok) throw new Error(`Failed to load payment terms (${res.status})`);
                const json = await res.json();
                const data: PaymentTerm[] = json?.data ?? [];
                if (!cancelled) {
                    setPaymentTerms(data);
                    if (!form.payment_terms && data.length > 0) {
                        setForm((prev) => ({ ...prev, payment_terms: data[0].payment_name }));
                    }
                }
            } catch (e: any) {
                if (!cancelled) setPtError(e?.message || 'Failed to load payment terms');
            } finally {
                if (!cancelled) setPtLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setErr(null);

        const required = (v: string) => v.trim().length > 0;
        if (!required(form.supplier_name)) return setErr('Supplier name is required.');
        if (!required(form.supplier_shortcut)) return setErr('Supplier shortcut is required.');
        if (!required(form.contact_person)) return setErr('Contact person is required.');
        if (!required(form.payment_terms)) return setErr('Payment terms is required.');

        try {
            setSaving(true);

            const payload = {
                // Force NON-TRADE (uneditable)
                supplier_type: 'NON-TRADE',
                supplier_name: form.supplier_name,
                supplier_shortcut: form.supplier_shortcut,
                contact_person: form.contact_person,
                phone_number: form.phone_number || '0',
                email_address: form.email_address || 'N/A',
                address: form.address,
                city: form.city,
                state_province: form.state_province,
                country: form.country || 'Philippines',
                postal_code: form.postal_code,
                payment_terms: form.payment_terms,
                delivery_terms: form.delivery_terms || 'Delivery',
                tin_number: form.tin_number,
                notes_or_comments: form.notes_or_comments,
                preferred_communication_method: form.preferred_communication_method,
                isActive: form.isActive ? 1 : 0,
                date_added: new Date().toISOString().slice(0, 10),
            };

            const res = await fetch(SUPPLIERS_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const t = await res.text();
                throw new Error(`Create failed (${res.status}): ${t}`);
            }

            router.push('/app/supplier');
        } catch (e: any) {
            setErr(e?.message || 'Failed to create supplier');
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="p-4 md:p-6">
            <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-semibold text-slate-800">Create Supplier (Non-Trade)</h2>
                <div className="ml-auto">
                    <button
                        onClick={() => router.push('/app/supplier')}
                        className="px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 outline-none focus:ring-2 ring-blue-500"
                    >
                        ← Back to list
                    </button>
                </div>
            </div>

            <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-4 md:p-6 grid md:grid-cols-2 gap-4">
                {err && <div className="md:col-span-2 px-3 py-2 rounded-md bg-red-50 border border-red-200 text-red-700">{err}</div>}

                {/* Info banner: fixed type */}
                <div className="md:col-span-2 px-3 py-2 rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-sm">
                    Supplier Type is locked to <strong>NON-TRADE</strong> for Procurement.
                </div>

                {/* Left */}
                <div className="grid gap-3">
                    <div>
                        <label className="block text-sm text-slate-700 mb-1">Supplier Name *</label>
                        <input
                            value={form.supplier_name}
                            onChange={(e) => set('supplier_name', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm text-slate-700 mb-1">Shortcut *</label>
                            <input
                                value={form.supplier_shortcut}
                                onChange={(e) => set('supplier_shortcut', e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-700 mb-1">Supplier Type</label>
                            <input
                                value="NON-TRADE"
                                readOnly
                                className="w-full bg-slate-100 border border-slate-300 rounded-md px-3 py-2 text-slate-600"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm text-slate-700 mb-1">Contact Person *</label>
                            <input
                                value={form.contact_person}
                                onChange={(e) => set('contact_person', e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-700 mb-1">Phone</label>
                            <input
                                value={form.phone_number}
                                onChange={(e) => set('phone_number', e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm text-slate-700 mb-1">Email</label>
                            <input
                                type="email"
                                value={form.email_address}
                                onChange={(e) => set('email_address', e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-700 mb-1">TIN No.</label>
                            <input
                                value={form.tin_number}
                                onChange={(e) => set('tin_number', e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Right */}
                <div className="grid gap-3">
                    <div>
                        <label className="block text-sm text-slate-700 mb-1">Address</label>
                        <input
                            value={form.address}
                            onChange={(e) => set('address', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-sm text-slate-700 mb-1">City</label>
                            <input
                                value={form.city}
                                onChange={(e) => set('city', e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-700 mb-1">State/Province</label>
                            <input
                                value={form.state_province}
                                onChange={(e) => set('state_province', e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-700 mb-1">Postal Code</label>
                            <input
                                value={form.postal_code}
                                onChange={(e) => set('postal_code', e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm text-slate-700 mb-1">Payment Terms *</label>
                            <select
                                value={form.payment_terms}
                                onChange={(e) => set('payment_terms', e.target.value)}
                                disabled={ptLoading || !!ptError}
                                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 outline-none focus:ring-2 ring-blue-500 disabled:opacity-60"
                                required
                            >
                                {ptLoading && <option>Loading…</option>}
                                {ptError && <option value="">Failed to load</option>}
                                {!ptLoading && !ptError && paymentTerms.length === 0 && <option value="">No options</option>}
                                {!ptLoading &&
                                    !ptError &&
                                    paymentTerms.map((pt) => (
                                        <option key={pt.id} value={pt.payment_name}>
                                            {pt.payment_name}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm text-slate-700 mb-1">Delivery Terms</label>
                            <input
                                value={form.delivery_terms}
                                onChange={(e) => set('delivery_terms', e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-slate-700 mb-1">Preferred Communication</label>
                        <input
                            value={form.preferred_communication_method}
                            onChange={(e) => set('preferred_communication_method', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                        />
                    </div>

                    <div className="grid grid-cols-2 items-center gap-3">
                        <div className="col-span-1">
                            <label className="block text-sm text-slate-700 mb-1">Active</label>
                            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={form.isActive}
                                    onChange={(e) => set('isActive', e.target.checked)}
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                Active supplier
                            </label>
                        </div>
                    </div>
                </div>

                <div className="md:col-span-2">
                    <label className="block text-sm text-slate-700 mb-1">Notes</label>
                    <textarea
                        value={form.notes_or_comments}
                        onChange={(e) => set('notes_or_comments', e.target.value)}
                        rows={3}
                        className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 outline-none focus:ring-2 ring-blue-500"
                    />
                </div>

                <div className="md:col-span-2 flex items-center justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onClick={() => router.push('/app/supplier')}
                        className="px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 outline-none focus:ring-2 ring-blue-500"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white outline-none focus:ring-2 ring-blue-500"
                    >
                        {saving ? 'Saving…' : 'Save Supplier'}
                    </button>
                </div>
            </form>
        </section>
    );
}
