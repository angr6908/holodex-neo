<template>
  <!-- <div> -->
  <div ref="divRef" class="mb-3" style="height: 30px; max-width: 420px; width: 100%" />
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const emit = defineEmits<{ (e: "onCredentialResponse", val: any): void }>();

const googleUrl = "https://accounts.google.com/gsi/client";
const GOOGLE_CLIENT_ID = "275540829388-87s7f9v2ht3ih51ah0tjkqng8pd8bqo2.apps.googleusercontent.com";

const divRef = ref<HTMLElement | null>(null);
const ready = ref(false);
const pendingTrigger = ref(false);

function loadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = url;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function initGoogleButton() {
  try {
    await loadScript(googleUrl);
    if (!divRef.value || !(window as any).google?.accounts?.id) return;
    (window as any).google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (e: any) => emit("onCredentialResponse", e),
    });
    (window as any).google.accounts.id.renderButton(divRef.value, {
      theme: "outline",
      size: "medium",
      text: t("views.login.with.0"),
      width: divRef.value.clientWidth,
      logo_alignment: "left",
    });
    ready.value = true;
    if (pendingTrigger.value) {
      pendingTrigger.value = false;
      triggerGoogleLogin();
    }
  } catch (e) {
    console.error(e);
  }
}

function triggerGoogleLogin() {
  const root = divRef.value;
  if (!root) {
    pendingTrigger.value = true;
    return false;
  }
  const button = root.querySelector("div[role=button]");
  if (button) {
    (button as HTMLElement).click();
    return true;
  }
  if ((window as any).google?.accounts?.id?.prompt) {
    (window as any).google.accounts.id.prompt();
    return true;
  }
  pendingTrigger.value = !ready.value;
  return false;
}

defineExpose({ triggerGoogleLogin });

onMounted(() => { initGoogleButton(); });
</script>

<style>

</style>
