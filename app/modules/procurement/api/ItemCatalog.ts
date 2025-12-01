import { api, ITEMS } from './_base';

export type ItemTemplate = {
    id: number;
    name: string;
    uom?: string | null;
    base_price?: string | null;
    description?: string | null;
};

export type ItemVariant = {
    id: number;
    item_tmpl_id: number;
    name: string;
    list_price?: string | null;
};

export async function listItemTemplates(search = '') {
    const params = new URLSearchParams();
    if (search) {
        params.set('filter', JSON.stringify({
            _or: [{ name: { _contains: search } }, { description: { _contains: search } }],
        }));
    }
    params.set('limit', '200');
    params.set('sort', 'name');
    const json = await api<{data: ItemTemplate[]}>(`${ITEMS}/item_template?${params.toString()}`);
    return json.data ?? [];
}

export async function listItemVariants(item_tmpl_id: number) {
    const params = new URLSearchParams();
    params.set('filter', JSON.stringify({ item_tmpl_id: { _eq: item_tmpl_id } }));
    params.set('limit', '200');
    params.set('sort', 'name');
    const json = await api<{data: ItemVariant[]}>(`${ITEMS}/item_variant?${params.toString()}`);
    return json.data ?? [];
}
export async function getItemTemplateName(id?: number | null): Promise<string> {
    if (!id) return '';
    try {
        const res = await api<{ data: ItemTemplate }>(`${ITEMS}/item_template/${id}`);
        return res.data?.name ?? '';
    } catch {
        return '';
    }
}

export async function getItemVariantName(id?: number | null): Promise<string> {
    if (!id) return '';
    try {
        const res = await api<{ data: ItemVariant }>(`${ITEMS}/item_variant/${id}`);
        return res.data?.name ?? '';
    } catch {
        return '';
    }
}

export async function getItemTemplateUom(id?: number | null): Promise<string> {
    if (!id) return '';
    try {
        const r = await api<{ data: { id: number; uom?: string | null } }>(`${ITEMS}/item_template/${id}`);
        return r?.data?.uom ?? '';
    } catch {
        return '';
    }
}