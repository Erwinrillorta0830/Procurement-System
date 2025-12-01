"use client";

import { useEffect, useMemo, useState } from "react";
import { useItems } from "../provider/ItemsProvider";
import ItemTemplateModal from "./ItemTemplateModal";
import ItemVariantModal from "./ItemVariantModal";

/* Simple inline icons */
function IconEdit(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M16.862 3.487a2.1 2.1 0 0 1 2.97 2.97L8.44 17.85l-4.02.503.503-4.02L16.862 3.487zM15 5l4 4" />
        </svg>
    );
}
function IconTrash(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6v-.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V6m-8 0l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13M10 11v6M14 11v6" />
        </svg>
    );
}
function IconSearch(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z" />
        </svg>
    );
}
function IconX(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12" />
        </svg>
    );
}

export default function ItemTemplateList() {
    const {
        templates = [],
        variants = [],
        attributeValues = [],
        variantAttributeRelations = [],
        loading,
        attributes,
        setActiveModal,
    } = useItems() as any;

    const [activeTab, setActiveTab] = useState<"templates" | "variants">("templates");
    const [editTemplate, setEditTemplate] = useState<any>(null);
    const [editVariant, setEditVariant] = useState<any>(null);

    // local state for variants (for optimistic delete)
    const [localVariants, setLocalVariants] = useState<any[]>([]);
    const [variantQuery, setVariantQuery] = useState("");
    const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        setLocalVariants(variants || []);
    }, [variants]);

    // attributes label for a variant
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

    const filteredVariants = useMemo(() => {
        if (!variantQuery.trim()) return localVariants;
        const q = variantQuery.toLowerCase();
        return localVariants.filter((v: any) => {
            const name = (v?.name || "").toLowerCase();
            const attrs = getVariantAttributes(v.id).toLowerCase();
            return name.includes(q) || attrs.includes(q);
        });
    }, [variantQuery, localVariants, variantAttributeRelations, attributeValues, attributes]);

    // barebones Directus delete (always called; no UI conditions)
    async function tryDeleteDirectus(variantId: number) {
        const DIRECTUS = process.env.NEXT_PUBLIC_DIRECTUS_URL;
        if (!DIRECTUS) {
            alert("Missing NEXT_PUBLIC_DIRECTUS_URL");
            return;
        }
        // Adjust if your collection name differs
        const res = await fetch(`${DIRECTUS}/items/item_variant/${variantId}`, { method: "DELETE" });
        if (!res.ok) {
            const msg = await res.text().catch(() => "");
            throw new Error(msg || `Failed to delete (HTTP ${res.status})`);
        }
    }

    async function handleConfirmDelete() {
        if (!confirmDelete) return;
        setIsDeleting(true);
        try {
            await tryDeleteDirectus(confirmDelete.id);
            setLocalVariants((prev) => prev.filter((v) => v.id !== confirmDelete.id));
            setConfirmDelete(null);
        } catch (err: any) {
            console.error(err);
            alert(err?.message || "Delete failed.");
        } finally {
            setIsDeleting(false);
        }
    }

    if (loading) return <div className="p-6 text-gray-500">Loading...</div>;

    return (
        <div className="p-6 space-y-6">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
                <button
                    className={`px-4 py-2 -mb-px font-medium ${
                        activeTab === "templates" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"
                    }`}
                    onClick={() => setActiveTab("templates")}
                >
                    Templates
                </button>
                <button
                    className={`px-4 py-2 -mb-px font-medium ${
                        activeTab === "variants" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-500 hover:text-gray-700"
                    }`}
                    onClick={() => setActiveTab("variants")}
                >
                    Variants
                </button>
            </div>

            {/* TEMPLATES TAB — this was missing before */}
            {activeTab === "templates" && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="text-xl font-semibold">Item Templates</h2>
                        <button
                            onClick={() => {
                                setEditTemplate(null);
                                setActiveModal("template");
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-sm transition"
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

            {/* VARIANTS TAB */}
            {activeTab === "variants" && (
                <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <h2 className="text-xl font-semibold">Variants</h2>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    value={variantQuery}
                                    onChange={(e) => setVariantQuery(e.target.value)}
                                    placeholder="Search variants or attributes..."
                                    className="pl-9 pr-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <button
                                onClick={() => {
                                    setEditVariant(null);
                                    setActiveModal("variant");
                                }}
                                className="inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow-sm transition"
                            >
                                + Add Variant
                            </button>
                        </div>
                    </div>

                    {filteredVariants.length === 0 ? (
                        <p className="text-gray-500">No variants found.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-[820px] w-full bg-white shadow rounded-lg overflow-hidden">
                                <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-6 py-3 text-left text-gray-700 font-medium uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-3 text-left text-gray-700 font-medium uppercase tracking-wider">Price</th>
                                    <th className="px-6 py-3 text-left text-gray-700 font-medium uppercase tracking-wider">Attributes</th>
                                    {/* Always-visible Actions column with reserved width */}
                                    <th className="px-6 py-3 text-right text-gray-700 font-medium uppercase tracking-wider w-[160px] whitespace-nowrap">
                                        Actions
                                    </th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                {filteredVariants.map((v: any) => (
                                    <tr key={v.id} className="hover:bg-gray-50 transition">
                                        <td
                                            className="px-6 py-4 cursor-pointer"
                                            onClick={() => {
                                                setEditVariant(v);
                                                setActiveModal("variant");
                                            }}
                                        >
                                            {v.name}
                                        </td>
                                        <td className="px-6 py-4">
                                            ₱{v.list_price ? Number(v.list_price).toFixed(2) : "0.00"}
                                        </td>
                                        <td className="px-6 py-4">{getVariantAttributes(v.id) || "-"}</td>
                                        {/* Unconditional, plain, always-rendered buttons */}
                                        <td className="px-6 py-4 text-right">
                                            <div className="inline-flex items-center gap-2">
                                                <button
                                                    className="p-2 rounded-md hover:bg-gray-100 text-gray-700"
                                                    title="Edit"
                                                    onClick={() => {
                                                        setEditVariant(v);
                                                        setActiveModal("variant");
                                                    }}
                                                >
                                                    <IconEdit className="w-5 h-5" />
                                                </button>

                                            </div>
                                        </td>
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

            {/* Confirm Delete Modal */}
            {confirmDelete && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
                    <div className="bg-white w-full max-w-md rounded-xl shadow-xl p-6">
                        <div className="flex items-start justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">Delete Variant</h3>
                            <button
                                className="p-2 rounded-md hover:bg-gray-100"
                                onClick={() => setConfirmDelete(null)}
                                title="Close"
                            >
                                <IconX className="w-5 h-5" />
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
