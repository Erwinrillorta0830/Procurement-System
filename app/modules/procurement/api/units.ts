// modules/procurement/api/units.ts
import { api, ITEMS } from "./_base";

export type Unit = {
    unit_id: number;
    unit_name: string;
    unit_shortcut?: string | null;
    order?: number | null;
};

export async function listUnits(): Promise<Unit[]> {
    const params = new URLSearchParams();
    params.set("sort", "order");
    params.set("limit", "200");
    const res = await api<{ data: Unit[] }>(`${ITEMS}/units?${params.toString()}`);
    return res.data ?? [];
}
