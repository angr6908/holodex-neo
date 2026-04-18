import { createRouter, createWebHistory } from "vue-router";
import { loadLanguageAsync } from "@/plugins/app-i18n";
import { musicdexURL } from "@/utils/consts";
import HomeFave from "../views/HomeFave.vue";
import { useSettingsStore } from "@/stores/settings";
import { useAppStore } from "@/stores/app";
import { useOrgsStore } from "@/stores/orgs";


const Channel = () => import("../views/Channel.vue");
const ChannelVideos = () => import("../views/channel_views/ChannelVideos.vue");
const ChannelAbout = () => import("../views/channel_views/ChannelAbout.vue");
const Watch = () => import("../views/Watch.vue");
const Search = () => import("../views/Search.vue");
const Library = () => import("../views/Library.vue");
const NotFound = () => import("../views/NotFound.vue");
const User = () => import("../views/LoginCallback.vue");
const EditVideo = () => import("../views/EditVideo.vue");
const MultiView = () => import("../views/MultiView.vue");
const AddPlaceholderStream = () => import("../views/AddPlaceholderStream.vue");
const AddChannelRequest = () => import("../views/AddChannelRequest.vue");

const Extension = () => import("../views/Extension.vue");

const TLClient = () => import("../views/TLClient.vue");
const TLScriptEditor = () => import("../views/TLScriptEditor.vue");
const TLManager = () => import("../views/TLScriptManager.vue");
const RelayBotSetting = () => import("../views/RelayBotSetting.vue");

const routes = [
    {
        path: "/",
        name: "home",
        component: HomeFave,
    },
    {
        // Backwards compatibility with old home
        path: "/home",
        redirect(to) {
            const { hash, params, query } = to;
            return {
                name: "home",
                hash,
                params,
                query,
            };
        },
    },
    {
        // Redirect old archive/clips routes to home
        path: "/archive",
        redirect: "/",
    },
    {
        path: "/clips",
        redirect: "/",
    },
    {
        // Redirect old favorites routes to home
        path: "/favorites/:pathMatch(.*)*",
        redirect: "/",
    },
    {
        path: "/channel/:id",
        component: Channel,
        children: [
            {
                path: "clips",
                name: "channel_clips",
                component: ChannelVideos,
            },
            {
                path: "collabs",
                name: "channel_collabs",
                component: ChannelVideos,
            },
            {
                path: "about",
                name: "channel_about",
                component: ChannelAbout,
            },
            {
                path: "music",
                name: "channel_music",
                beforeEnter(to) {
                    window.location.replace(`${musicdexURL}/channel/${to.params.id}`);
                },
            },
            {
                path: "",
                name: "channel",
                component: ChannelVideos,
            },
        ],
    },
    {
        // Redirect old channels route to home
        path: "/channels",
        redirect: "/",
    },
    {
        // Backwards compat redirect from old /channel/ list page
        path: "/channel/",
        redirect: "/",
    },
    {
        name: "watch",
        path: "/watch/:id?",
        component: Watch,
    },
    {
        name: "edit_video",
        path: "/edit/video/:id/:tab?",
        component: EditVideo,
    },
    {
        name: "add_placeholder",
        path: "/add_placeholder",
        component: AddPlaceholderStream,
    },
    {
        name: "multiview",
        path: "/multiview/:layout?",
        component: MultiView,
    },
    {
        name: "library",
        path: "/library",
        component: Library,
    },
    {
        name: "about",
        path: "/about",
        redirect: "/",
    },
    {
        name: "search",
        path: "/search",
        component: Search,
    },
    {
        // Redirect old settings route to home (settings is now a nav dropdown)
        path: "/settings",
        redirect: "/",
    },
    {
        name: "login-callback",
        path: "/login",
        component: User,
    },
    {
        path: "/user",
        redirect: "/",
    },
    {
        name: "extension",
        path: "/extension",
        component: Extension,
    },
    {
        name: "tlclient",
        path: "/tlclient",
        component: TLClient,
    },
    {
        name: "scripteditor",
        path: "/scripteditor",
        component: TLScriptEditor,
    },
    {
        name: "scriptmanager",
        path: "/scriptmanager",
        component: TLManager,
    },
    {
        name: "relaybotsetting",
        path: "/relaybot",
        component: RelayBotSetting,
    },
    {
        path: "/404",
        component: NotFound,
    },
    {
        path: "/addChannel",
        component: AddChannelRequest,
    },
    {
        path: "/:pathMatch(.*)*",
        component: NotFound,
    },
];

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
    scrollBehavior(to, from, savedPosition) {
        const appStore = useAppStore();
        if (!appStore.isMobile && !savedPosition && to.path === from.path) {
            appStore.reloadCurrentPage();
        }
        if (to.path === from.path) {
            return savedPosition;
        }
        return savedPosition || { left: 0, top: 0 };
    },
});

router.beforeEach((to, from, next) => {
    if (!from.path.match(/^\/watch/)) to.meta.prevPath = from.fullPath;

    if (from.query.lang) {
        to.query.lang = from.query.lang;
    }
    const queryLang = to.query.lang;
    const settingsStore = useSettingsStore();
    const appStore = useAppStore();
    const orgsStore = useOrgsStore();
    const actualLang = queryLang || settingsStore.lang;
    const queryOrg = to.query.org;

    if (queryOrg && appStore.currentOrg.name !== queryOrg) {
        orgsStore.fetchOrgs().then(() => {
            const overrideOrg = orgsStore.orgs.find((o) => o.name === queryOrg);
            if (overrideOrg) appStore.setCurrentOrg(overrideOrg);
        });
    }

    if (actualLang !== "en") {
        loadLanguageAsync(actualLang).then(() => next());
    } else { next(); }
});

export default router;
