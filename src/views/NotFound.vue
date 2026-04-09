<template>
  <section class="flex min-h-[70vh] items-center justify-center px-4 py-10">
    <UiCard class-name="w-full max-w-lg p-8 text-center">
      <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-2xl font-semibold text-white">
        404
      </div>
      <h1 class="mt-5 text-3xl font-semibold tracking-tight text-white">
        {{ $t("views.notFound.title") }}
      </h1>
      <p class="mt-3 text-sm text-slate-400">
        The page you requested is missing or no longer available.
      </p>
      <UiButton as="router-link" to="/" class-name="mt-6">
        {{ $t("views.notFound.back") }}
      </UiButton>
    </UiCard>
  </section>
</template>

<script setup lang="ts">
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import { useMetaTitle } from "@/composables/useMetaTitle";

defineOptions({ name: "NotFound" });

useMetaTitle(() => "404 Error - Holodex");
</script>
