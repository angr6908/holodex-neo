<template>
  <div class="flex min-h-[60vh] items-center justify-center">
    <div v-if="processing" class="text-sm text-[color:var(--color-muted-foreground)]">
      Logging in...
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, getCurrentInstance } from "vue";
import { useRouter } from "vue-router";
import api from "@/utils/backend-api";
import { useAppStore } from "@/stores/app";
import { useFavoritesStore } from "@/stores/favorites";

const router = useRouter();
const { proxy } = getCurrentInstance()!;
const appStore = useAppStore();
const favoritesStore = useFavoritesStore();

const processing = ref(false);

onMounted(async () => {
  const params = new URL(window.location.href).searchParams;
  const service = params.get("service");
  if (service === "discord" && window.location.hash) {
    processing.value = true;
    try {
      const hash = window.location.hash.substring(1);
      const discordAuthParams = new URLSearchParams(hash);
      const accessToken = discordAuthParams.get("access_token");
      const resp = await api.login(
        appStore.userdata.jwt,
        accessToken,
        "discord",
      );
      appStore.setUser(resp.data);
      proxy?.$gtag?.event("login", {
        event_label: "discord",
      });
      favoritesStore.resetFavorites();
    } catch (e) {
      console.error("Discord login failed:", e);
    }
  }
  router.replace("/");
});
</script>
