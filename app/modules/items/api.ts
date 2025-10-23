import { api } from "../../lib/api";

export const ItemsAPI = {
    // Templates
    getTemplates: async () => {
        const res = await api.get("/item_template");
        return res.data.data || [];
    },
    createTemplate: async (payload: any) => {
        const res = await api.post("/item_template", payload);
        return res.data;
    },

    // -------------------
    // Attributes
    // -------------------
    getAttributes: async () => {
        const res = await api.get("/item_attribute");
        return res.data.data || [];
    },
    createAttribute: async (payload: any) => {
        const res = await api.post("/item_attribute", payload);
        return res.data;
    },

    // -------------------
    // Attribute Values
    // -------------------
    getAttributeValues: async () => {
        const res = await api.get("/item_attribute_value");
        return res.data.data || [];
    },
    getAttributeValue: async (id: number) => {
        const res = await api.get(`/item_attribute_value/${id}`);
        return res.data.data || null;
    },
    createAttributeValue: async (payload: any) => {
        const res = await api.post("/item_attribute_value", payload);
        return res.data;
    },

    // -------------------
    // Template → Attribute line
    // -------------------
    getTemplateLine: async (templateId: number, attributeId: number) => {
        const res = await api.get(
            `/item_attribute_template_line?filter[item_tmpl_id][_eq]=${templateId}&filter[attribute_id][_eq]=${attributeId}`
        );
        return res.data.data?.[0] || null;
    },
    createTemplateLine: async (payload: any) => {
        const res = await api.post("/item_attribute_template_line", payload);
        return res.data;
    },

    // -------------------
    // Template → Attribute value
    // -------------------
    createTemplateValue: async (payload: any) => {
        const res = await api.post("/item_attribute_template_value", payload);
        return res.data;
    },

    // -------------------
    // Variants
    // -------------------
    getVariants: async () => {
        const res = await api.get("/item_variant");
        return res.data.data || [];
    },
    createVariant: async (payload: any) => {
        const res = await api.post("/item_variant", payload);
        return res.data;
    },

    // -------------------
    // Variant → Attribute Value Relations
    // -------------------
    createVariantRelation: async (payload: any) => {
        const res = await api.post("/item_attribute_value_item_variant_rel", payload);
        return res.data;
    },
    getVariantRelations: async () => {
        const res = await api.get("/item_attribute_value_item_variant_rel");
        return res.data.data || [];
    },

    updateTemplate: async (id: number, payload: any) => {
        const res = await api.patch(`/item_template/${id}`, payload);
        return res.data;
    },

    updateVariant: async (id: number, payload: any) => {
        const res = await api.patch(`/item_variant/${id}`, payload);
        return res.data;
    },
};