import { ItemsProvider } from "../../../modules/items/provider/ItemsProvider";
import ItemAttributeManager from "../../../modules/items/components/ItemAttributeManager";

export default function ItemAttributesPage() {
    return (
        <ItemsProvider>
            <ItemAttributeManager />
        </ItemsProvider>
    );
}
