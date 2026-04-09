<template>
  <div>
    <div
      v-if="showInstallPrompt"
      class="fixed bottom-4 left-1/2 z-[120] w-[min(92vw,28rem)] -translate-x-1/2 rounded-2xl border border-sky-400/30 bg-sky-500/20 p-4 text-white backdrop-blur"
    >
      <div class="flex items-center">
        <img
          src="https://holodex.net/img/icons/apple-touch-icon-152x152.png"
          style="height: 40px; width: 40px; border-radius: 6px"
        >
        <div class="my-2 ml-2 text-caption">
          {{ $t("component.installPrompt.callToAction") }}
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <UiButton
          variant="ghost"
          size="sm"
          class-name="text-white/70"
          @click="hideInstallPrompt"
        >
          {{ $t("component.installPrompt.notNowBtn") }}
        </UiButton>
        <UiButton variant="secondary" size="sm" @click="install">
          {{ $t("component.installPrompt.installBtn") }}
        </UiButton>
      </div>
    </div>
    <UiDialog :open="iOSInstallDialog" class-name="max-w-[350px] p-0" @update:open="iOSInstallDialog = $event">
      <UiCard class-name="py-4">
        <div style="text-align: center">
          <div>
            <img
              src="https://holodex.net/img/icons/apple-touch-icon-152x152.png"
              style="height: 75px; width: 75px; border-radius: 6px"
            >
          </div>
          <div class="text-h5">
            {{ $t("component.installPrompt.iOS.popup") }}
          </div>
          <div class="my-2 h-px bg-white/10" />
          <div class="mt-3">
            {{ $t("component.installPrompt.iOS.beforeExportIcon") }}
            <UiIcon :icon="mdiExportVariant" class-name="text-[color:var(--color-secondary)]" />
            {{ $t("component.installPrompt.iOS.afterExportIcon") }}
          </div>
        </div>
      </UiCard>
    </UiDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { mdiExportVariant } from "@mdi/js";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiDialog from "@/components/ui/dialog/Dialog.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import { useAppStore } from "@/stores/app";

const appStore = useAppStore();
const deferredPrompt = ref<any>(null);
const iOSInstallDialog = ref(false);

const showInstallPrompt = computed(() => {
  const promptWeekly = new Date().getTime() - appStore.lastShownInstallPrompt > 1000 * 60 * 60 * 24 * 7;
  if (isAppleDevice() && !isStandAlone() && promptWeekly) return true;
  if (deferredPrompt.value && promptWeekly) return true;
  return false;
});

onMounted(() => {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt.value = e;
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt.value = null;
  });
});

async function install() {
  if (deferredPrompt.value) {
    deferredPrompt.value.prompt();
    await deferredPrompt.value.userChoice;
    deferredPrompt.value = null;
  } else {
    iOSInstallDialog.value = true;
  }
}

function hideInstallPrompt() {
  appStore.installPromptShown();
}

function isAppleDevice() {
  return ["iPhone", "iPad", "iPod"].includes(navigator.platform);
}

function isStandAlone() {
  type iOSNavigator = Navigator & { standalone: boolean };
  return (navigator as iOSNavigator).standalone || window.matchMedia("(display-mode: standalone)").matches;
}
</script>
