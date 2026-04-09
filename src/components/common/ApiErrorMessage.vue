<template>
  <div class="mx-auto w-full max-w-xl px-3 text-center sm:px-4">
    <div class="space-y-3 py-2">
      <div class="flex justify-center">
        <UiButton
          variant="outline"
          size="sm"
          as="a"
          href="/"
          class-name="rounded-lg px-3"
        >
          <UiIcon :icon="icons.mdiRefresh" size="sm" />
          <span>Refresh</span>
        </UiButton>
      </div>
      <div class="text-2xl font-semibold tracking-tight text-[color:var(--color-foreground)]">
        {{ $t("component.apiError.title") }}
      </div>
      <p class="mx-auto max-w-[34rem] text-sm leading-6 text-[color:var(--color-muted-foreground)]">
        {{ $t("component.apiError.textBeforeTwitter") }}
        <a href="https://twitter.com/holodex" rel="noopener noreferrer" class="font-medium text-[color:var(--color-primary)] no-underline hover:underline">@holodex</a>
        {{ $t("component.apiError.textAfterTwitter") }}
        <a href="https://discord.gg/jctkgHBt4b" rel="noopener noreferrer" class="font-medium text-[color:var(--color-primary)] no-underline hover:underline">Discord</a>{{ $t("component.apiError.afterAboutPageHyperlink") }}
      </p>
      <p class="mx-auto text-xs leading-5 text-[color:var(--color-muted-foreground)]">
        Tip: Hard Refresh/Clear Cache: <code class="rounded px-1.5 py-0.5 text-[color:var(--color-foreground)]">CTRL + SHIFT + R</code>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import UiButton from "@/components/ui/button/Button.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
</script>
