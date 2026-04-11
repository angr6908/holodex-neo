import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { jwtDecode } from "jwt-decode";
import { sendTokenToExtension, setCookieJWT } from "@/utils/messaging";
import backendApi from "@/utils/backend-api";
import { useFavoritesStore } from "./favorites";
import { useHomeStore } from "./home";

export const useAppStore = defineStore("app", () => {
    // ── State ──
    const firstVisit = ref(true);
    const showOrgTip = ref(true);
    const showUpdateDetails = ref(false);
    const firstVisitMugen = ref(true);
    const lastShownInstallPrompt = ref(0);

    const userdata = ref<{ user: any; jwt: string | null }>({
        user: null,
        jwt: null,
    });

    const isMobile = ref(true);
    const currentGridSize = ref(0);

    const currentOrg = ref<{ name: string; short: string }>({ name: "Hololive", short: "Holo" });
    const selectedHomeOrgs = ref<string[]>(["Hololive"]);
    const orgFavorites = ref([
        { name: "All Vtubers", short: "Vtuber" },
        { name: "Hololive", short: "Holo" },
        { name: "Nijisanji", short: "Niji" },
        { name: "Independents", short: "Indie" },
    ]);

    const activeSockets = ref(0);
    const showExtension = ref(false);
    const navDrawer = ref(false);

    const videoCardMenu = ref<any>(null);
    const showVideoCardMenu = ref(false);
    const reportVideo = ref<any>(null);
    const TPCookieEnabled = ref<number | boolean | null>(null);
    const TPCookieAlertDismissed = ref(false);

    const visibilityState = ref<string | null>(null);
    const windowWidth = ref(typeof window !== "undefined" ? window.innerWidth : 1440);
    const uploadPanel = ref(false);
    const reloadTrigger = ref<{ source?: string; consumed?: boolean; timestamp: number } | null>(null);

    // ── Getters ──
    const isLoggedIn = computed(() => userdata.value?.jwt);
    const isSuperuser = computed(() => {
        const role = userdata.value?.user?.role;
        return role === "admin" || role === "editor";
    });

    // ── Actions (formerly mutations) ──
    function setShowUpdatesDetail(payload: boolean) {
        showUpdateDetails.value = payload;
    }

    function $reset() {
        firstVisit.value = true;
        showOrgTip.value = true;
        showUpdateDetails.value = false;
        firstVisitMugen.value = true;
        lastShownInstallPrompt.value = 0;
        userdata.value = { user: null, jwt: null };
        isMobile.value = true;
        currentGridSize.value = 0;
        currentOrg.value = { name: "Hololive", short: "Holo" };
        selectedHomeOrgs.value = ["Hololive"];
        orgFavorites.value = [
            { name: "All Vtubers", short: "Vtuber" },
            { name: "Hololive", short: "Holo" },
            { name: "Nijisanji", short: "Niji" },
            { name: "Independents", short: "Indie" },
        ];
        activeSockets.value = 0;
        showExtension.value = false;
        navDrawer.value = false;
        videoCardMenu.value = null;
        showVideoCardMenu.value = false;
        reportVideo.value = null;
        TPCookieEnabled.value = null;
        TPCookieAlertDismissed.value = false;
        visibilityState.value = null;
        windowWidth.value = typeof window !== "undefined" ? window.innerWidth : 1440;
        uploadPanel.value = false;
        reloadTrigger.value = null;
    }

    function setCurrentOrg(val: { name: string; short: string }) {
        currentOrg.value = val;
        if ((selectedHomeOrgs.value?.length || 0) <= 1) {
            selectedHomeOrgs.value = val?.name && val.name !== "All Vtubers"
                ? [val.name]
                : [];
        }
        // Cancel stale in-flight requests and invalidate cache
        try {
            const home = useHomeStore();
            home.cancelInflight();
            home.lastLiveUpdate = 0;
        } catch { /* home store may not be initialised yet */ }
    }

    function setSelectedHomeOrgs(orgs: (string | { name?: string })[]) {
        selectedHomeOrgs.value = [...new Set(
            (orgs || [])
                .map((org) => (typeof org === "string" ? org : org?.name))
                .filter((name): name is string => !!name && name !== "All Vtubers"),
        )];
        try {
            const home = useHomeStore();
            home.cancelInflight();
            home.lastLiveUpdate = 0;
        } catch { /* ignore */ }
    }

    function toggleSelectedHomeOrg(org: string | { name?: string }) {
        const name = typeof org === "string" ? org : org?.name;
        if (!name || name === "All Vtubers") {
            selectedHomeOrgs.value = [];
        } else if (selectedHomeOrgs.value.includes(name)) {
            selectedHomeOrgs.value = selectedHomeOrgs.value.filter((value) => value !== name);
        } else {
            selectedHomeOrgs.value = [...selectedHomeOrgs.value, name];
        }
        try {
            const home = useHomeStore();
            home.cancelInflight();
            home.lastLiveUpdate = 0;
        } catch { /* ignore */ }
    }

    function setIsMobile(val: boolean) {
        isMobile.value = val;
    }

    function setWindowWidth(val: number) {
        windowWidth.value = val;
    }

    function setNavDrawer(val: boolean) {
        navDrawer.value = val;
    }

    function setReportVideo(val: any) {
        reportVideo.value = val;
    }

    function setUser({ user, jwt }: { user: any; jwt: string | null }) {
        userdata.value.user = user;
        userdata.value.jwt = jwt;
        setCookieJWT(jwt as string);
    }

    function setVisited() {
        firstVisit.value = false;
    }

    function setOrgTip() {
        showOrgTip.value = false;
    }

    function setVisitedMugen() {
        firstVisitMugen.value = false;
    }

    function setCurrentGridSize(size: number) {
        currentGridSize.value = size;
    }

    function installPromptShown() {
        lastShownInstallPrompt.value = new Date().getTime();
    }

    function incrementActiveSockets() {
        activeSockets.value += 1;
    }

    function decrementActiveSockets() {
        activeSockets.value -= 1;
    }

    function setShowExtension(show: boolean) {
        showExtension.value = show;
    }

    function setVideoCardMenu(obj: any) {
        videoCardMenu.value = obj;
    }

    function setShowVideoCardMenu(show: boolean) {
        showVideoCardMenu.value = show;
    }

    function setTPCookieEnabled(enabled: number | boolean | null) {
        TPCookieEnabled.value = enabled;
    }

    function setTPCookieAlertDismissed(dismissed: boolean) {
        TPCookieAlertDismissed.value = dismissed;
    }

    function toggleFavoriteOrg(org: { name: string; short: string }) {
        const favIndex = orgFavorites.value.findIndex((x) => x.name === org.name);
        if (favIndex >= 0) {
            orgFavorites.value.splice(favIndex, 1);
        } else {
            orgFavorites.value.push(org);
        }
    }

    function shiftOrgFavorites({ org, up = true }: { org: { name: string; short: string }; up?: boolean }) {
        const favIndex = orgFavorites.value.findIndex((x) => x.name === org.name);
        if (up && favIndex === 0) return;
        if (!up && favIndex === orgFavorites.value.length - 1) return;
        const replaceIndex = up ? favIndex - 1 : favIndex + 1;
        const temp = orgFavorites.value[replaceIndex];
        orgFavorites.value.splice(replaceIndex, 1, org);
        orgFavorites.value.splice(favIndex, 1, temp);
    }

    function setVisiblityState(val: string | null) {
        visibilityState.value = val;
    }

    function setUploadPanel(obj: any) {
        uploadPanel.value = obj;
    }

    // ── Async Actions ──

    async function logout() {
        setUser({ user: null, jwt: null });
        const favorites = useFavoritesStore();
        favorites.resetFavorites();
    }

    async function loginCheck() {
        if (userdata.value.jwt) {
            const { exp } = jwtDecode<{ exp: number }>(userdata.value.jwt);
            const dist = exp - Date.now() / 1000;
            if (dist < 0) {
                await logout();
            } else {
                sendTokenToExtension(userdata.value.jwt);
                setCookieJWT(userdata.value.jwt);
            }
        }
    }

    async function loginVerify(opts?: { bounceToLogin?: boolean }) {
        const { bounceToLogin = false } = opts || {};
        await loginCheck();
        if (userdata.value && userdata.value.jwt) {
            const valid = await backendApi.loginIsValid(userdata.value.jwt);
            if (valid && valid.status === 200) {
                setUser(valid.data);
            } else if (valid && valid.status === 401) {
                await logout();
                if (bounceToLogin) {
                    window.location.href = "/user";
                }
            } else {
                console.error("Login credentials did not respond with a good message? Maybe server is down.");
            }
        }
    }

    async function reloadCurrentPage(consumed?: any) {
        reloadTrigger.value = {
            ...(consumed || {}),
            timestamp: Date.now(),
        };
        return consumed;
    }

    return {
        // state
        firstVisit,
        showOrgTip,
        showUpdateDetails,
        firstVisitMugen,
        lastShownInstallPrompt,
        userdata,
        isMobile,
        currentGridSize,
        currentOrg,
        selectedHomeOrgs,
        orgFavorites,
        activeSockets,
        showExtension,
        navDrawer,
        videoCardMenu,
        showVideoCardMenu,
        reportVideo,
        TPCookieEnabled,
        TPCookieAlertDismissed,
        visibilityState,
        windowWidth,
        uploadPanel,
        reloadTrigger,
        // getters
        isLoggedIn,
        isSuperuser,
        // actions
        setShowUpdatesDetail,
        $reset,
        setCurrentOrg,
        setSelectedHomeOrgs,
        toggleSelectedHomeOrg,
        setIsMobile,
        setWindowWidth,
        setNavDrawer,
        setReportVideo,
        setUser,
        setVisited,
        setOrgTip,
        setVisitedMugen,
        setCurrentGridSize,
        installPromptShown,
        incrementActiveSockets,
        decrementActiveSockets,
        setShowExtension,
        setVideoCardMenu,
        setShowVideoCardMenu,
        setTPCookieEnabled,
        setTPCookieAlertDismissed,
        toggleFavoriteOrg,
        shiftOrgFavorites,
        setVisiblityState,
        setUploadPanel,
        logout,
        loginCheck,
        loginVerify,
        reloadCurrentPage,
    };
}, {
    persist: {
        key: "holodex-v2-app",
        pick: [
            "firstVisit",
            "showOrgTip",
            "showUpdateDetails",
            "firstVisitMugen",
            "lastShownInstallPrompt",
            "userdata",
            "currentOrg",
            "selectedHomeOrgs",
            "orgFavorites",
            "currentGridSize",
            "TPCookieEnabled",
            "TPCookieAlertDismissed",
        ],
    },
});
