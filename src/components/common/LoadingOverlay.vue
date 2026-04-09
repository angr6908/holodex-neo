<template>
  <div v-if="isLoading || showError" class="loading-overlay" :class="`loading-overlay--${variant}`">
    <div v-if="isLoading && !showError" class="loading-overlay__panel">
      <div class="loading-overlay__spinner" aria-hidden="true" />
      <div v-if="label" class="loading-overlay__label">
        {{ label }}
      </div>
    </div>
    <div v-if="showError || showNotFound" class="loading-overlay__feedback">
      <ApiErrorMessage v-if="showError" />
      <NotFound v-if="showNotFound" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import ApiErrorMessage from "./ApiErrorMessage.vue";

const NotFound = defineAsyncComponent(() => import("@/views/NotFound.vue"));

withDefaults(defineProps<{
  isLoading?: boolean;
  showError?: boolean;
  showNotFound?: boolean;
  variant?: string;
  label?: string;
}>(), {
  isLoading: true,
  showError: false,
  showNotFound: false,
  variant: "default",
  label: "",
});
</script>

<style scoped>
.loading-overlay {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: center;
}

.loading-overlay--default {
    min-height: 12rem;
    padding: 2.5rem 1.5rem;
}

.loading-overlay--watch {
    min-height: auto;
}

.loading-overlay__panel {
    display: inline-flex;
    align-items: center;
    gap: 0.875rem;
    border-radius: 1rem;
    border: 1px solid var(--color-border);
    background: var(--surface-elevated);
    padding: 0.9rem 1.1rem;
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
}

.loading-overlay__spinner {
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 999px;
    border: 2px solid color-mix(in srgb, var(--color-border) 85%, transparent);
    border-top-color: var(--color-primary);
    animation: loading-spinner 0.8s linear infinite;
}

.loading-overlay__feedback {
    width: 100%;
}

.loading-overlay__label {
    font-size: 0.94rem;
    font-weight: 500;
    color: var(--color-foreground);
    letter-spacing: 0.01em;
}

@keyframes loading-spinner {
    to {
        transform: rotate(360deg);
      }
}
</style>
