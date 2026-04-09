import type { App, Plugin } from "vue";
import GridItem from "./GridItem.vue";
import GridLayout from "./GridLayout.vue";

const VueGridLayout: Plugin = {
    install(app: App) {
        app.component("GridLayout", GridLayout);
        app.component("GridItem", GridItem);
    },
};

export default VueGridLayout;
export { GridLayout, GridItem };
