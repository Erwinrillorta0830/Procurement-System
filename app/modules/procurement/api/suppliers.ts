import { api, ITEMS } from './_base';

export type Supplier = {
    id: number;
    supplier_name: string;
    email_address?: string | null;
    phone_number?: string | null;
    address?: string | null;
    supplier_type?: string | null;
    tin_number?: string | null;
    payment_terms?: string | null;
};

export async function listSuppliers(search = '') {
    const params = new URLSearchParams();
    if (search) {
        params.set('filter', JSON.stringify({
            _or: [
                { supplier_name: { _contains: search } },
                { email_address: { _contains: search } },
            ]
        }));
    }
    params.set('limit', '200');
    params.set('sort', 'supplier_name');
    const url = `${ITEMS}/suppliers?${params.toString()}`;
    const json = await api<{data: Supplier[]}>(url);
    return json.data ?? [];
}

export async function getSupplierById(id: number) {
    const json = await api<{data: Supplier}>(`${ITEMS}/suppliers/${id}`);
    return json.data ?? null;
}

