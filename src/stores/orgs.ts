import { defineStore } from "pinia";
import { ref } from "vue";
import api from "@/utils/backend-api";

export const useOrgsStore = defineStore("orgs", () => {
    // ── State ──
    const orgs = ref<any[]>([]);

    // ── Actions ──
    async function fetchOrgs() {
        // Stale-while-revalidate: if persisted orgs exist, show them instantly
        // and refresh in the background. Only block on the network call when
        // there's no cached data at all.
        if (orgs.value.length > 0) {
            // Background refresh — don't block rendering
            api.orgs().then((freshOrgs: any[]) => {
                const sorted = freshOrgs.sort(
                    (a: any, b: any) => a.name.toLowerCase().charCodeAt(0) - b.name.toLowerCase().charCodeAt(0),
                );
                const withAll = [{ name: "All Vtubers", short: "Vtuber", name_jp: null }, ...sorted];
                // Only update if data actually changed to avoid re-renders
                if (JSON.stringify(withAll.map((o: any) => o.name)) !== JSON.stringify(orgs.value.map((o: any) => o.name))) {
                    orgs.value = withAll;
                }
            }).catch(() => { /* keep persisted data on error */ });
            return;
        }
        // No cached data — must wait for the network
        orgs.value = [
            { name: "All Vtubers", short: "Vtuber", name_jp: null },
            ...(await api.orgs()).sort(
                (a: any, b: any) => a.name.toLowerCase().charCodeAt(0) - b.name.toLowerCase().charCodeAt(0),
            ),
        ];
    }

    function setOrgs(newOrgs: any[]) {
        orgs.value = newOrgs;
    }

    return {
        orgs,
        fetchOrgs,
        setOrgs,
    };
}, {
    persist: {
        key: "holodex-v2-orgs",
        pick: ["orgs"],
    },
});
