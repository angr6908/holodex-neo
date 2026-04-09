<template>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6 md:pt-12">
    <UiCard class-name="overflow-hidden p-0">
      <div class="grid gap-0 md:grid-cols-2">
        <div class="border-b border-white/10 p-4 md:border-b-0 md:border-r md:p-6">
          <img
            src="/img/holodex-plus/holodex-plus-screenshot.webp"
            alt="Holodex Plus screenshot"
            class="h-full w-full rounded-[calc(var(--radius)+4px)] object-cover"
          >
        </div>
        <div class="p-4 md:p-6">
          <div class="mb-4 flex items-center gap-3">
            <img src="/img/holodex-plus/holodex-plus-icon.png" alt="Holodex Plus" class="h-8 w-8 rounded-lg">
            <div class="text-2xl font-semibold text-white">
              {{ $t("views.extension.title") }}
            </div>
          </div>

          <div class="mb-2 text-lg font-medium text-slate-100">
            {{ $t("views.extension.features") }}
          </div>
          <ul class="space-y-2 text-sm text-slate-300">
            <li>{{ $t("views.extension.featureset.one") }}</li>
            <li>{{ $t("views.extension.featureset.two") }}</li>
            <li>{{ $t("views.extension.featureset.three") }}</li>
            <li>{{ $t("views.extension.featureset.four") }}</li>
          </ul>

          <div class="mt-6 flex flex-wrap justify-center gap-3 md:justify-start">
            <a href="https://chrome.google.com/webstore/detail/holodex-plus/mjcecbpccklceljomllkhilglcdcncbh" title="Chrome Webstore" class="inline-flex">
              <img
                src="/img/holodex-plus/chrome-webstore.png"
                alt="Chrome Webstore"
                class="max-h-[50px] max-w-[180px] rounded-xl object-contain"
              >
            </a>
            <a
              href="https://addons.mozilla.org/firefox/addon/holodex-plus/"
              title="Firefox Extension"
              class="inline-flex"
            >
              <img
                src="/img/holodex-plus/firefox-amo.png"
                alt="Firefox Add-ons"
                class="max-h-[50px] max-w-[145px] rounded-xl object-contain"
              >
            </a>
            <UiButton
              as="a"
              class-name="h-[50px] rounded-xl bg-violet-600 px-4 text-white hover:brightness-110"
              target="_blank"
              href="https://github.com/HolodexNet/Holodex-Plus"
              title="Github Download"
            >
              <UiIcon :icon="mdiGithub" />
              Install<br>from Github
            </UiButton>
          </div>
        </div>
      </div>
    </UiCard>

    <UiCard class-name="overflow-hidden p-0">
      <div class="grid gap-0 md:grid-cols-2">
        <div class="border-b border-white/10 p-4 md:border-b-0 md:border-r md:p-6">
          <img
            src="https://files.raycast.com/ynzdcq6vupr1rptcwz2qd3j323f1"
            alt="Raycast extension screenshot"
            class="h-full w-full rounded-[calc(var(--radius)+4px)] object-cover"
          >
        </div>
        <div class="p-4 md:p-6">
          <div class="mb-4 flex items-center gap-3">
            <img
              src="https://imgproxy.raycast.com/RNu0jpnAtWUnMiJAdLuIvB7-gpQ5ohNPGiR3td1FigI/rs:fill:64:64/dpr:2/aHR0cHM6Ly9maWxl/cy5yYXljYXN0LmNv/bS9vb2NlNzNybGFi/a2Z5M3QwZm5weWQ1/ZnVodzZz"
              alt="Raycast"
              class="h-8 w-8 rounded-lg"
            >
            <div class="text-2xl font-semibold text-white">
              Raycast Extension
            </div>
          </div>

          <div class="mb-2 text-lg font-medium text-slate-100">
            {{ $t("views.extension.features") }}
          </div>
          <ul class="space-y-2 text-sm text-slate-300">
            <li>Show ongoing live streams</li>
            <li>Search archives</li>
            <li>Search clips</li>
            <li>Search channels</li>
          </ul>

          <div class="mt-6 flex flex-wrap justify-center gap-3 md:justify-start">
            <UiButton
              as="a"
              class-name="h-[50px] rounded-xl bg-violet-600 px-4 text-white hover:brightness-110"
              target="_blank"
              href="https://www.raycast.com/uetchy/holodex"
              title="Get it on Raycast Store"
            >
              <img
                src="https://www.raycast.com/assets/static/favicon.b9532cc.628b74797b5186d6caec6476f06179e0.png"
                alt="Raycast"
                class="mr-2 h-8 w-8 rounded-md"
              >
              Get it on<br>Raycast Store
            </UiButton>
            <UiButton
              as="a"
              class-name="h-[50px] rounded-xl bg-violet-600 px-4 text-white hover:brightness-110"
              target="_blank"
              href="https://github.com/HolodexNet/raycast-holodex"
              title="Download Source Code"
            >
              <UiIcon :icon="mdiGithub" />
              Install<br>from Github
            </UiButton>
          </div>
        </div>
      </div>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import { mdiGithub } from "@mdi/js";
import { useMetaTitle } from "@/composables/useMetaTitle";

defineOptions({ name: "Extension" });

const { t } = useI18n();

useMetaTitle(() => `${t("views.extension.title")} - Holodex`);
</script>
