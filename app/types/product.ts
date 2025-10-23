export interface ProductAttribute {
    name: string;
    values: string[] | string; // ✅ allow both
}

export interface ProductFormData {
    name: string;
    uom: string;
    base_price: number;
    attributes: ProductAttribute[];
}
