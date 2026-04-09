import { createApp } from "vue";
import { createGtag } from "vue-gtag";
import * as icons from "@/utils/icons";
import App from "./App.vue";
import { pinia } from "./stores";
import router from "./router";
import { i18n } from "./plugins/app-i18n";
import "./style.css";

const app = createApp(App);

app.config.performance = ["localhost", "staging.holodex.net"].includes(window.location.hostname);
app.config.globalProperties.icons = icons;

app.use(pinia);
app.use(router);
app.use(i18n);

app.use(createGtag({
    tagId: "UA-178428556-1",
    pageTracker: {
        router,
    },
}));

app.mount("#app");
