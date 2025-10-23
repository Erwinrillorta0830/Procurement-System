"use client";

import { useState } from "react";
import { useItems } from "../provider/ItemsProvider";
import ItemTemplateModal from "./ItemTemplateModal";
import ItemVariantModal from "./ItemVariantModal";

export default function ItemTemplateList() {
    const {
        templates = [],
        variants = [],
        attributeValues = [],
        variantAttributeRelations = [],
        loading,
        attributes,
        setActiveModal,
    } = useItems();

    const [activeTab, setActiveTab] = useState<"templates" | "variants">("templates");
    const [editTemplate, setEditTemplate] = useState<any>(null);
    const [editVariant, setEditVariant] = useState<any>(null);

    // Helper: get attribute names for a given variant
    const getVariantAttributes = (variantId: number) => {
        const relatedValues = variantAttributeRelations.filter(
            (rel: any) => rel.item_variant_id === variantId
        );

        return relatedValues
            .map((rel: any) => {
                const value = attributeValues.find((v: any) => v.id === rel.item_attribute_value_id);
                if (!value) return null;
                const attr = attributes.find((a: any) => a.id === value.attribute_id);
                return attr ? `${attr.name}: ${value.name}` : value.name;
            })
            .filter(Boolean)
            .join(", ");
    };

    if (loading) return <div className="p-6 text-gray-500">Loading...</div>;

    return (
        <div className="p-6 space-y-6">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
                <button
                    className={`px-4 py-2 -mb-px font-medium ${
                        activeTab === "templates"
                            ? "border-b-2 border-blue-600 text-blue-600"
                            : "text-gray-500 hover:text-gray-700"
                    }`}
                    onClick={() => setActiveTab("templates")}
                >
                    Templates
                </button>
                <button
                    className={`px-4 py-2 -mb-px font-medium ${
                        activeTab === "variants"
                            ? "border-b-2 border-indigo-600 text-indigo-600"
                            : "text-gray-500 hover:text-gray-700"
                    }`}
                    onClick={() => setActiveTab("variants")}
                >
                    Variants
                </button>
            </div>

            {/* Templates Tab */}
            {activeTab === "templates" && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="text-xl font-semibold">Item Templates</h2>
                        <button
                            onClick={() => {
                                setEditTemplate(null);
                                setActiveModal("template");
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                        >
                            + Add Template
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-white shadow rounded-lg overflow-hidden">
                            <thead className="bg-gray-100">
                            <tr>
                                <th className="px-6 py-3 text-left text-gray-700 font-medium uppercase tracking-wider">
                                    Name
                                </th>
                                <th className="px-6 py-3 text-left text-gray-700 font-medium uppercase tracking-wider">
                                    UOM
                                </th>
                                <th className="px-6 py-3 text-left text-gray-700 font-medium uppercase tracking-wider">
                                    Base Price
                                </th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                            {templates.length > 0 ? (
                                templates.map((t: any) => (
                                    <tr
                                        key={t.id}
                                        className="hover:bg-gray-50 cursor-pointer transition"
                                        onClick={() => {
                                            setEditTemplate(t);
                                            setActiveModal("template");
                                        }}
                                    >
                                        <td className="px-6 py-4">{t.name}</td>
                                        <td className="px-6 py-4">{t.uom || "-"}</td>
                                        <td className="px-6 py-4">
                                            ₱{t.base_price ? Number(t.base_price).toFixed(2) : "0.00"}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={3} className="text-center py-8 text-gray-500">
                                        No templates found.
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Variants Tab */}
            {activeTab === "variants" && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="text-xl font-semibold">Variants</h2>
                        <button
                            onClick={() => {
                                setEditVariant(null);
                                setActiveModal("variant");
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded"
                        >
                            + Add Variant
                        </button>
                    </div>

                    {variants.length === 0 ? (
                        <p className="text-gray-500">No variants found.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full bg-white shadow rounded-lg overflow-hidden">
                                <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-6 py-3 text-left text-gray-700 font-medium uppercase tracking-wider">
                                        Name
                                    </th>
                                    <th className="px-6 py-3 text-left text-gray-700 font-medium uppercase tracking-wider">
                                        Price
                                    </th>
                                    <th className="px-6 py-3 text-left text-gray-700 font-medium uppercase tracking-wider">
                                        Attributes
                                    </th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                {variants.map((v: any) => (
                                    <tr
                                        key={v.id}
                                        className="hover:bg-gray-50 cursor-pointer transition"
                                        onClick={() => {
                                            setEditVariant(v);
                                            setActiveModal("variant");
                                        }}
                                    >
                                        <td className="px-6 py-4">{v.name}</td>
                                        <td className="px-6 py-4">
                                            ₱{v.list_price ? Number(v.list_price).toFixed(2) : "0.00"}
                                        </td>
                                        <td className="px-6 py-4">{getVariantAttributes(v.id) || "-"}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Modals */}
            <ItemTemplateModal template={editTemplate} />
            <ItemVariantModal variant={editVariant} />
        </div>
    );
}
