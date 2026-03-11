"use client";

import React, {
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";
import { ItemsAPI } from "../api";

type BaseRecord = Record<string, unknown>;

type ItemTemplate = BaseRecord & {
    id: number;
    name?: string;
    uom?: string;
    base_price?: number;
    is_active?: boolean;
};

type ItemAttribute = BaseRecord & {
    id: number;
    name?: string;
};

type ItemAttributeValue = BaseRecord & {
    id: number;
    name?: string;
    attribute_id?: number;
};

type ItemVariant = BaseRecord & {
    id: number;
    item_tmpl_id?: number;
    name?: string;
};

type VariantAttributeRelation = BaseRecord & {
    id: number;
    item_variant_id?: number;
    item_attribute_value_id?: number;
};

type TemplateLine = BaseRecord & {
    id: number;
    item_tmpl_id?: number;
    attribute_id?: number;
};

type CreateResponse<T> = {
    data?: T;
};

type ModalType = null | "template" | "attribute" | "value" | "variant";

type VariantCreateInput = BaseRecord & {
    item_tmpl_id: number;
};

type ItemsContextValue = {
    templates: ItemTemplate[];
    items: ItemTemplate[];
    attributes: ItemAttribute[];
    attributeValues: ItemAttributeValue[];
    variants: ItemVariant[];
    variantAttributeRelations: VariantAttributeRelation[];
    loading: boolean;
    activeModal: ModalType;
    setActiveModal: React.Dispatch<React.SetStateAction<ModalType>>;
    addTemplate: (data: BaseRecord) => Promise<void>;
    updateTemplate: (id: number, data: BaseRecord) => Promise<void>;
    updateVariant: (id: number, data: BaseRecord) => Promise<void>;
    addItem: (data: BaseRecord) => Promise<void>;
    addAttribute: (data: BaseRecord) => Promise<void>;
    addAttributeValue: (data: BaseRecord) => Promise<void>;
    addVariant: (variant: VariantCreateInput, valueIds: number[]) => Promise<void>;
};

const ItemsContext = createContext<ItemsContextValue | undefined>(undefined);

export const ItemsProvider = ({
                                  children,
                              }: {
    children: React.ReactNode;
}) => {
    const [templates, setTemplates] = useState<ItemTemplate[]>([]);
    const [attributes, setAttributes] = useState<ItemAttribute[]>([]);
    const [attributeValues, setAttributeValues] = useState<ItemAttributeValue[]>([]);
    const [variants, setVariants] = useState<ItemVariant[]>([]);
    const [variantAttributeRelations, setVariantAttributeRelations] = useState<
        VariantAttributeRelation[]
    >([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [activeModal, setActiveModal] = useState<ModalType>(null);

    const fetchAll = async (): Promise<void> => {
        setLoading(true);

        try {
            const [tmpl, attr, values, varnts, rels] = await Promise.all([
                ItemsAPI.getTemplates(),
                ItemsAPI.getAttributes(),
                ItemsAPI.getAttributeValues(),
                ItemsAPI.getVariants(),
                ItemsAPI.getVariantRelations(),
            ]);

            setTemplates(tmpl as ItemTemplate[]);
            setAttributes(attr as ItemAttribute[]);
            setAttributeValues(values as ItemAttributeValue[]);
            setVariants(varnts as ItemVariant[]);
            setVariantAttributeRelations(rels as VariantAttributeRelation[]);
        } finally {
            setLoading(false);
        }
    };

    const updateVariant = async (id: number, data: BaseRecord): Promise<void> => {
        await ItemsAPI.updateVariant(id, data);
        await fetchAll();
    };

    const updateTemplate = async (id: number, data: BaseRecord): Promise<void> => {
        await ItemsAPI.updateTemplate(id, data);
        await fetchAll();
    };

    const addTemplate = async (data: BaseRecord): Promise<void> => {
        await ItemsAPI.createTemplate(data);
        await fetchAll();
    };

    const addAttribute = async (data: BaseRecord): Promise<void> => {
        await ItemsAPI.createAttribute(data);
        await fetchAll();
    };

    const addAttributeValue = async (data: BaseRecord): Promise<void> => {
        await ItemsAPI.createAttributeValue(data);
        await fetchAll();
    };

    const addVariant = async (
        variant: VariantCreateInput,
        valueIds: number[]
    ): Promise<void> => {
        const newVariantResponse = (await ItemsAPI.createVariant(
            variant
        )) as CreateResponse<ItemVariant>;

        const variantId = newVariantResponse.data?.id;

        if (typeof variantId !== "number") {
            throw new Error("Failed to create variant");
        }

        for (const valueId of valueIds) {
            const attrValue = (await ItemsAPI.getAttributeValue(
                valueId
            )) as ItemAttributeValue | null;

            const attributeId = attrValue?.attribute_id;

            if (typeof attributeId !== "number") {
                continue;
            }

            const line = (await ItemsAPI.getTemplateLine(
                variant.item_tmpl_id,
                attributeId
            )) as TemplateLine | null;

            let lineId = line?.id;

            if (typeof lineId !== "number") {
                const newLineResponse = (await ItemsAPI.createTemplateLine({
                    item_tmpl_id: variant.item_tmpl_id,
                    attribute_id: attributeId,
                })) as CreateResponse<TemplateLine>;

                lineId = newLineResponse.data?.id;
            }

            if (typeof lineId !== "number") {
                continue;
            }

            await ItemsAPI.createTemplateValue({
                attribute_line_id: lineId,
                item_attribute_value_id: valueId,
            });

            await ItemsAPI.createVariantRelation({
                item_variant_id: variantId,
                item_attribute_value_id: valueId,
            });
        }

        await fetchAll();
    };

    useEffect(() => {
        void fetchAll();
    }, []);

    const contextValue: ItemsContextValue = {
        templates,
        items: templates,
        attributes,
        attributeValues,
        variants,
        variantAttributeRelations,
        loading,
        activeModal,
        setActiveModal,
        addTemplate,
        updateTemplate,
        updateVariant,
        addItem: addTemplate,
        addAttribute,
        addAttributeValue,
        addVariant,
    };

    return (
        <ItemsContext.Provider value={contextValue}>
            {children}
        </ItemsContext.Provider>
    );
};

export const useItems = (): ItemsContextValue => {
    const context = useContext(ItemsContext);

    if (!context) {
        throw new Error("useItems must be used within an ItemsProvider");
    }

    return context;
};