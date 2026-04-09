<template>
  <div class="mv-url-input flex items-center gap-1">
    <Transition
      enter-active-class="animate-in fade-in duration-150"
      leave-active-class="animate-out fade-out duration-100"
      mode="out-in"
    >
      <UiButton
        v-if="!expanded"
        key="trigger"
        type="button"
        size="icon"
        variant="secondary"
        class-name="h-8 w-8 shrink-0 rounded-xl"
        title="Add YouTube / Twitch URL"
        @click="expand"
      >
        <UiIcon :icon="mdiLinkVariant" />
      </UiButton>

      <!-- Expanded state: input bar -->
      <form
        v-else
        key="expanded"
        class="flex items-center gap-1 animate-in fade-in slide-in-from-right-1 duration-150"
        @submit.prevent="handleSubmit"
      >
        <UiButton
          type="button"
          size="icon"
          variant="secondary"
          class-name="h-8 w-8 shrink-0 rounded-xl"
          title="Collapse"
          @click="collapse"
        >
          <UiIcon :icon="mdiChevronLeft" />
        </UiButton>
        <div class="relative flex h-8 min-w-0 flex-1 items-center">
          <UiInput
            ref="inputRef"
            :model-value="url"
            type="text"
            placeholder="YouTube or Twitch URL..."
            :class-name="`h-8 rounded-xl text-sm ${hasError ? 'border-amber-400/50 focus:border-amber-400/60' : ''} ${url ? 'rounded-r-none' : ''}`"
            @update:model-value="url = $event"
            @keydown.esc="collapse"
          />
          <UiButton
            v-if="url"
            type="submit"
            size="icon"
            :variant="hasError ? 'ghost' : 'ghost'"
            :class-name="`h-8 w-8 shrink-0 rounded-l-none rounded-r-xl border border-l-0 ${hasError ? 'border-amber-400/30 text-amber-400 hover:bg-amber-400/12' : 'border-[color:var(--color-light)] text-[color:var(--color-primary)] hover:bg-[color:color-mix(in_srgb,var(--color-primary)_12%,transparent)]'}`"
            title="Confirm"
          >
            <UiIcon :icon="mdiCheck" />
          </UiButton>
        </div>
      </form>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from "vue";
import { mdiLinkVariant, mdiChevronLeft, mdiCheck } from "@mdi/js";
import { getVideoIDFromUrl } from "@/utils/functions";
import { useMultiviewStore } from "@/stores/multiview";
import UiButton from "@/components/ui/button/Button.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiInput from "@/components/ui/input/Input.vue";

defineOptions({ name: "MvUrlInput" });

const emit = defineEmits<{
  (e: "onSuccess", content: any): void;
}>();

const multiviewStore = useMultiviewStore();

const expanded = ref(false);
const url = ref("");
const hasError = ref(false);
const inputRef = ref<InstanceType<typeof UiInput> | null>(null);

watch(url, () => {
  if (hasError.value) hasError.value = false;
});

async function expand() {
  expanded.value = true;
  await nextTick();
  (inputRef.value?.$el as HTMLInputElement)?.focus();
}

function collapse() {
  expanded.value = false;
  url.value = "";
  hasError.value = false;
}

function handleSubmit() {
  const content = getVideoIDFromUrl(url.value);
  if (content?.id) {
    hasError.value = false;
    const isTwitch = content.type === "twitch";
    multiviewStore.addUrlHistory({ twitch: isTwitch, url: url.value });
    emit("onSuccess", content);
    collapse();
  } else {
    hasError.value = true;
  }
}
</script>

<style scoped>
.mv-url-input {
  min-width: 2rem;
}

/* When expanded, take up available space */
.mv-url-input:has(form) {
  min-width: 0;
  max-width: 280px;
}
</style>
