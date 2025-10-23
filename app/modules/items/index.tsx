import { ItemsProvider } from "./provider/ItemsProvider";
import ItemTemplateList from "./components/ItemTemplateList";

export default function ItemsModule() {
    return (
        <ItemsProvider>
            <ItemTemplateList />
        </ItemsProvider>
    );
}
