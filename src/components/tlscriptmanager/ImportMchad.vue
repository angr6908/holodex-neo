<template>
  <div class="space-y-5 p-6">
    <h2 class="text-lg font-semibold text-white">
      Import From Mchad
    </h2>

    <div
      v-if="claimSuccess"
      class="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100"
    >
      Successfully claimed all imported archives from Mchad
    </div>
    <div
      v-if="claimErrorMsg"
      class="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100"
    >
      {{ claimErrorMsg }}
    </div>

    <div class="space-y-4 rounded-[calc(var(--radius)+6px)] border border-white/10 bg-white/4 p-4">
      <div class="grid gap-3 md:grid-cols-2">
        <label class="space-y-2">
          <span class="block text-sm font-medium text-slate-300">Room name</span>
          <UiInput v-model="room" />
        </label>
        <label class="space-y-2">
          <span class="block text-sm font-medium text-slate-300">Password</span>
          <UiInput v-model="pass" type="password" />
        </label>
      </div>
      <UiButton variant="secondary" class-name="w-full" @click="checkAvailable">
        {{ $t("component.mainNav.login") }} to Mchad
      </UiButton>
      <p class="text-sm text-slate-400">
        {{ loginText }}
      </p>
    </div>

    <div class="overflow-hidden rounded-[calc(var(--radius)+6px)] border border-white/10">
      <div class="max-h-[40vh] overflow-auto">
        <table class="min-w-full text-sm">
          <thead class="sticky top-0 bg-slate-950/95 backdrop-blur">
            <tr class="border-b border-white/10 text-left text-slate-300">
              <th class="px-4 py-3 font-medium">
                #
              </th>
              <th class="px-4 py-3 font-medium">
                Video Id
              </th>
              <th class="px-4 py-3 font-medium">
                Entry Length
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(dt, index) in archiveData"
              :key="index"
              class="border-b border-white/8 text-slate-200"
            >
              <td class="px-4 py-3">
                {{ index + 1 }}
              </td>
              <td class="px-4 py-3">
                {{ dt.video_id }}
              </td>
              <td class="px-4 py-3">
                {{ dt.count }}
              </td>
            </tr>
            <tr v-if="archiveData.length === 0">
              <td colspan="3" class="px-4 py-8 text-center text-slate-500">
                No archives loaded yet.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="flex items-center gap-3">
      <UiButton variant="ghost" @click="$emit('close', {upload: false}); resetData()">
        {{ $t("views.watch.uploadPanel.cancelBtn") }}
      </UiButton>
      <UiButton
        variant="destructive"
        class-name="ml-auto"
        :disabled="(archiveData.length === 0) || (working)"
        @click="claimAll"
      >
        {{ working ? "Processing" : "Claim All Archives" }}
      </UiButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiInput from "@/components/ui/input/Input.vue";
import { useAppStore } from "@/stores/app";
import backendApi from "@/utils/backend-api";

defineEmits<{
  (e: "close"): void;
}>();

const appStore = useAppStore();
const userdata = computed(() => appStore.userdata);

const room = ref("");
const pass = ref("");
const loginText = ref("");
const archiveData = ref<any[]>([]);
const working = ref(false);
const claimErrorMsg = ref("");
const claimSuccess = ref(false);

function resetData() {
  room.value = "";
  pass.value = "";
  loginText.value = "";
  archiveData.value = [];
  working.value = false;
  claimSuccess.value = false;
  claimErrorMsg.value = "";
}

async function checkAvailable() {
  try {
    working.value = true;
    if (!(room.value && pass.value)) throw new Error("Missing room or pass");
    const { data } = await backendApi.checkMchadMigrate(room.value, pass.value);
    archiveData.value = data.archives;
    loginText.value = `Found Mchad Id: ${data.mchad_user_id}`;
  } catch (e: any) {
    claimErrorMsg.value = e.message;
  }
  working.value = false;
}

async function claimAll() {
  try {
    working.value = true;
    const res = await backendApi.claimMchadMigrate(userdata.value?.jwt, room.value, pass.value);
    if (res.status === 200) {
      claimSuccess.value = true;
    }
  } catch (error: any) {
    claimErrorMsg.value = error.response?.data?.message || error.message;
  }
  working.value = false;
}
</script>
