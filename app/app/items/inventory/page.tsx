import { ItemsProvider } from "../../../modules/items/provider/ItemsProvider";
import InventoryTable from "../../../modules/items/components/InventoryTable";

export default function InventoryPage() {
    return (
        <ItemsProvider>
            <InventoryTable />
        </ItemsProvider>
    );
}
