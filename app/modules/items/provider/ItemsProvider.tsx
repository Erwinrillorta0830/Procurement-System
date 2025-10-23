"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { ItemsAPI } from "../api";

const ItemsContext = createContext<any>(null);

export const ItemsProvider = ({ children }: { children: React.ReactNode }) => {
    const [templates, setTemplates] = useState([]);
    const [attributes, setAttributes] = useState([]);
    const [attributeValues, setAttributeValues] = useState([]);
    const [variants, setVariants] = useState([]);
    const [variantAttributeRelations, setVariantAttributeRelations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeModal, setActiveModal] = useState<null | "template" | "attribute" | "value" | "variant">(null);

    const fetchAll = async () => {
        setLoading(true);
        const [tmpl, attr, values, varnts, rels] = await Promise.all([
            ItemsAPI.getTemplates(),
            ItemsAPI.getAttributes(),
            ItemsAPI.getAttributeValues(),
            ItemsAPI.getVariants(),
            ItemsAPI.getVariantRelations() // <-- fetch item_attribute_value_item_variant_rel

        ]);
        setTemplates(tmpl);
        setAttributes(attr);
        setAttributeValues(values);
        setVariants(varnts);
        setVariantAttributeRelations(rels); // save relations
        setLoading(false);
    };
    const updateVariant = async (id: number, data: any) => {
        await ItemsAPI.updateVariant(id, data);
        await fetchAll(); // refresh state
    };


    const updateTemplate = async (id: number, data: any) => {
        await ItemsAPI.updateTemplate(id, data);
        await fetchAll();
    };

    const addTemplate = async (data: any) => {
        await ItemsAPI.createTemplate(data);
        await fetchAll();
    };

    const addAttribute = async (data: any) => {
        await ItemsAPI.createAttribute(data);
        await fetchAll();
    };

    const addAttributeValue = async (data: any) => {
        await ItemsAPI.createAttributeValue(data);
        await fetchAll();
    };


    const addVariant = async (variant: any, valueIds: number[]) => {
        try {
            // 1️⃣ Create the variant
            const newVariant = await ItemsAPI.createVariant(variant);
            const variantId = newVariant.data?.id;

            if (!variantId) throw new Error("Failed to create variant");

            // 2️⃣ Loop through each selected attribute value
            for (const valueId of valueIds) {
                // 2a: Get the attribute_id for this value
                const attrValue = await ItemsAPI.getAttributeValue(valueId);
                const attributeId = attrValue?.attribute_id;

                if (!attributeId) continue; // skip if missing

                // 2b: Check if template-attribute line exists
                let line = await ItemsAPI.getTemplateLine(variant.item_tmpl_id, attributeId);
                let lineId = line?.id;

                // 2c: If line doesn't exist, create it
                if (!lineId) {
                    const newLine = await ItemsAPI.createTemplateLine({
                        item_tmpl_id: variant.item_tmpl_id,
                        attribute_id: attributeId,
                    });
                    lineId = newLine.data?.id;
                }

                // 2d: Create template-value link
                await ItemsAPI.createTemplateValue({
                    attribute_line_id: lineId,
                    item_attribute_value_id: valueId,
                });

                // 2e: Link variant to value
                await ItemsAPI.createVariantRelation({
                    item_variant_id: variantId,
                    item_attribute_value_id: valueId,
                });
            }

            // 3️⃣ Refresh all data
            await fetchAll();
        } catch (err) {
            console.error("Error adding variant with attribute relations:", err);
        }
    };


    useEffect(() => {
        fetchAll();
    }, []);

    return (
        <ItemsContext.Provider
            value={{
                templates,
                items: templates, // alias for backward compatibility
                attributes,
                attributeValues,
                variants,
                loading,
                activeModal,
                setActiveModal,
                addTemplate,
                variantAttributeRelations, // <-- added here
                updateTemplate,
                updateVariant,
                addItem: addTemplate, // alias for backward compatibility
                addAttribute,
                addAttributeValue,
                addVariant,
            }}
        >
            {children}
        </ItemsContext.Provider>
    );
};

export const useItems = () => useContext(ItemsContext);
