type JsonObject = Record<string, unknown>;

type DirectusListResponse<T> = {
    data?: T[];
};

type DirectusItemResponse<T> = {
    data?: T;
};

async function request<T>(
    input: string,
    init?: RequestInit
): Promise<T> {
    const res = await fetch(`/api/items${input}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
        },
        cache: "no-store",
    });

    const text = await res.text();

    let json: unknown = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        json = text;
    }

    if (!res.ok) {
        const message =
            typeof json === "object" &&
            json !== null &&
            "errors" in json
                ? JSON.stringify(json)
                : `Request failed with status ${res.status}`;

        throw new Error(message);
    }

    return json as T;
}

async function getList<T>(path: string): Promise<T[]> {
    const res = await request<DirectusListResponse<T>>(path, {
        method: "GET",
    });
    return Array.isArray(res.data) ? res.data : [];
}

async function getItem<T>(path: string): Promise<T | null> {
    const res = await request<DirectusItemResponse<T>>(path, {
        method: "GET",
    });
    return (res.data ?? null) as T | null;
}

async function post<TResponse, TPayload extends JsonObject>(
    path: string,
    payload: TPayload
): Promise<TResponse> {
    return request<TResponse>(path, {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

async function patch<TResponse, TPayload extends JsonObject>(
    path: string,
    payload: TPayload
): Promise<TResponse> {
    return request<TResponse>(path, {
        method: "PATCH",
        body: JSON.stringify(payload),
    });
}

export const ItemsAPI = {
    // Templates
    getTemplates: async () => {
        return getList<JsonObject>("/item_template");
    },

    createTemplate: async (payload: JsonObject) => {
        return post<JsonObject, JsonObject>("/item_template", payload);
    },

    // Attributes
    getAttributes: async () => {
        return getList<JsonObject>("/item_attribute");
    },

    createAttribute: async (payload: JsonObject) => {
        return post<JsonObject, JsonObject>("/item_attribute", payload);
    },

    // Attribute Values
    getAttributeValues: async () => {
        return getList<JsonObject>("/item_attribute_value");
    },

    getAttributeValue: async (id: number) => {
        return getItem<JsonObject>(`/item_attribute_value/${id}`);
    },

    createAttributeValue: async (payload: JsonObject) => {
        return post<JsonObject, JsonObject>("/item_attribute_value", payload);
    },

    // Template → Attribute line
    getTemplateLine: async (templateId: number, attributeId: number) => {
        const params = new URLSearchParams({
            "filter[item_tmpl_id][_eq]": String(templateId),
            "filter[attribute_id][_eq]": String(attributeId),
        });

        const rows = await getList<JsonObject>(`/item_attribute_template_line?${params.toString()}`);
        return rows[0] ?? null;
    },

    createTemplateLine: async (payload: JsonObject) => {
        return post<JsonObject, JsonObject>("/item_attribute_template_line", payload);
    },

    // Template → Attribute value
    createTemplateValue: async (payload: JsonObject) => {
        return post<JsonObject, JsonObject>("/item_attribute_template_value", payload);
    },

    // Variants
    getVariants: async () => {
        return getList<JsonObject>("/item_variant");
    },

    createVariant: async (payload: JsonObject) => {
        return post<JsonObject, JsonObject>("/item_variant", payload);
    },

    // Variant → Attribute Value Relations
    createVariantRelation: async (payload: JsonObject) => {
        return post<JsonObject, JsonObject>("/item_attribute_value_item_variant_rel", payload);
    },

    getVariantRelations: async () => {
        return getList<JsonObject>("/item_attribute_value_item_variant_rel");
    },

    updateTemplate: async (id: number, payload: JsonObject) => {
        return patch<JsonObject, JsonObject>(`/item_template/${id}`, payload);
    },

    updateVariant: async (id: number, payload: JsonObject) => {
        return patch<JsonObject, JsonObject>(`/item_variant/${id}`, payload);
    },
};