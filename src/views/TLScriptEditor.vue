<template>
  <div
    class="flex h-screen max-h-screen px-3"
    @keydown.ctrl.s.exact.prevent="processLog()"
  >
    <div class="flex h-full w-full flex-col">
      <div class="tl-topbar mb-2 flex min-h-[42px] flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-[color:var(--color-secondary)]/20 px-2 py-2">
        <UiButton variant="outline" size="sm" @click="$router.push('/')">
          <UiIcon :icon="icons.mdiHome" size="sm" />
        </UiButton>

        <UiButton
          variant="outline"
          size="sm"
          @click="
            modalMode = 5;
            modalNexus = true;
          "
        >
          {{ $t("views.tlClient.menu.setting") }}
        </UiButton>
        <UiButton variant="outline" size="sm" @click="processLog()">
          {{ $t("views.scriptEditor.menu.save") }} <code>Ctrl-S</code>
        </UiButton>
        <UiButton
          variant="outline"
          size="sm"
          @click="
            modalMode = 6;
            modalNexus = true;
          "
        >
          {{ $t("views.scriptEditor.menu.exportFile") }}
        </UiButton>
        <UiButton variant="outline" size="sm" @click="importPanelShow = true">
          {{ $t("views.scriptEditor.menu.importFile") }}
        </UiButton>
        <UiButton variant="outline" size="sm" @click="continuousTime()">
          {{ $t("views.scriptEditor.menu.continuousEnd") }}
        </UiButton>
        <UiButton
          variant="outline"
          size="sm"
          @click="
            modalMode = 9;
            modalNexus = true;
          "
        >
          Time Shift
        </UiButton>
        <UiButton
          v-if="videoData && videoData.id === 'custom'"
          variant="outline"
          size="sm"
          @click="
            modalMode = 10;
            modalNexus = true;
            linkInput = activeURLStream;
          "
        >
          Change Custom Link
        </UiButton>
        <UiButton
          variant="destructive"
          size="sm"
          @click="
            modalMode = 7;
            modalNexus = true;
          "
        >
          {{ $t("views.scriptEditor.menu.clearAll") }}
        </UiButton>
      </div>
      <div
        class="flex h-full flex-row items-stretch gap-3"
        style="height: 100%"
        @click="menuBool = false"
      >
        <UiCard
          ref="tableContainer"
          class-name="grow overflow-hidden p-0"
        >
          <table
            class="w-full border-collapse text-sm"
            :fixed-header="!menuBool"
            :height="tableHeightCalculator"
            width="auto"
          >
            <thead @click="selectedEntry = -1">
              <tr>
                <th class="text-left">
                  {{ $t("views.scriptEditor.table.headerStart") }}
                </th>
                <th class="text-left">
                  {{ $t("views.scriptEditor.table.headerEnd") }}
                </th>
                <th class="text-left">
                  {{ $t("views.scriptEditor.table.headerProfile") }}
                </th>
                <th class="text-left" style="width: 100%">
                  {{ $t("views.scriptEditor.table.headerText") }}
                </th>
                <th>
                  <div
                    v-if="!vidPlayer"
                    class="ControlBox flex flex-row items-center gap-2"
                  >
                    <UiButton variant="outline" size="sm" @click="timerTimeStop()">
                      <UiIcon :icon="mdiStop" size="sm" />
                    </UiButton>
                    <span>{{ timerPrint }}</span>
                    <UiButton variant="outline" size="sm" @click="timerTimeStart()">
                      <UiIcon :icon="mdiPlay" size="sm" />
                    </UiButton>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(entry, index) in entries" :key="`entry-${index}`">
                <Entrytr
                  v-if="selectedEntry !== index"
                  :key="index"
                  :time="entry.Time"
                  :duration="entry.Duration"
                  :stext="entry.SText"
                  :profile-name="profile[entry.Profile].Name"
                  :cc="
                    profile[entry.Profile].useCC
                      ? profile[entry.Profile].CC
                      : ''
                  "
                  :oc="
                    profile[entry.Profile].useOC
                      ? profile[entry.Profile].OC
                      : ''
                  "
                  :use-real-time="videoData.id === 'custom'"
                  :real-time="entry.realTime"
                  @click="selectedEntry = index"
                />
                <tr v-if="selectedEntry === index" :key="index">
                  <td>{{ timeStampStart }}</td>
                  <td>{{ timeStampEnd }}</td>
                  <td>
                    <select
                      v-model.number="entry.Profile"
                      class="h-10 w-full rounded-xl border border-white/12 bg-white/6 px-3 text-sm text-white outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
                      @change="logChange(entries[selectedEntry].id)"
                    >
                      <option
                        v-for="item in profileListPicker"
                        :key="item.idx"
                        :value="item.idx"
                        class="bg-slate-900"
                      >
                        {{ item.name }}
                      </option>
                    </select>
                  </td>
                  <td colspan="2">
                    <UiInput
                      v-model="entry.SText"
                      class-name="font-semibold"
                      :style="textStyle2"
                      @change="logChange(entries[selectedEntry].id)"
                    />
                  </td>
                </tr>
                <tr v-if="selectedEntry === index" :key="index + 'control'">
                  <td colspan="5">
                    <div
                      class="flex flex-row justify-around gap-2 py-3"
                    >
                      <UiButton
                        variant="outline"
                        size="sm"
                        @click="
                          modalMode = 4;
                          modalNexus = true;
                        "
                      >
                        {{ $t("views.scriptEditor.table.setAsStart") }}
                      </UiButton>
                      <UiButton variant="destructive" size="sm" @click="deleteEntry()">
                        {{ $t("views.scriptEditor.table.deleteEntry") }}
                      </UiButton>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
          <UiCard
            v-if="profileDisplay"
            class-name="ProfileListCard flex flex-col"
          >
            <span
              v-for="(prf, index) in profile"
              :key="'profilecard' + index"
              :class="{
                'text-[color:var(--color-primary)] font-medium': index === profileIdx,
              }"
            ><span v-if="index === profileIdx">> </span>
              <kbd v-if="index > 0">Ctrl-{{ index }}</kbd>
              <kbd v-if="index == 0">Ctrl-{{ index }} | Shift⇧-Tab↹</kbd>
              {{ " " + prf.Name }}
            </span>
          </UiCard>
        </UiCard>
        <UiCard
          v-if="vidPlayer"
          class-name="flex h-full w-1/2 flex-col p-0"
        >
          <div id="player" class="h-full w-full" />
          <div class="flex flex-row justify-center">
            <EnhancedEntry
              v-if="displayEntry >= 0 && displayEntry < entries.length"
              :stext="entries[displayEntry].SText"
              :cc="
                profile[entries[displayEntry].Profile].useCC
                  ? profile[entries[displayEntry].Profile].CC
                  : ''
              "
              :oc="
                profile[entries[displayEntry].Profile].useOC
                  ? profile[entries[displayEntry].Profile].OC
                  : ''
              "
            />
          </div>
          <div class="flex flex-row justify-center gap-2 px-4 py-3">
            <UiButton variant="outline" size="sm" @click="timerTimeStop()">
              <UiIcon :icon="mdiStop" size="sm" />
            </UiButton>
            <span>{{ timerPrint }}</span>
            <UiButton variant="outline" size="sm" @click="timerTimeStart()">
              <UiIcon :icon="mdiPlay" size="sm" />
            </UiButton>
          </div>
        </UiCard>
      </div>

      <div
        @click="menuBool = false"
        @keydown.up.exact="profileUp()"
        @keydown.down.exact="profileDown(false)"
        @keydown.tab.exact.prevent="profileDown(true)"
        @keydown.shift.tab.exact.prevent="profileJumpToDefault()"
        @keydown.ctrl.0.exact.prevent="profileJump(0)"
        @keydown.ctrl.1.exact.prevent="profileJump(1)"
        @keydown.ctrl.2.exact.prevent="profileJump(2)"
        @keydown.ctrl.3.exact.prevent="profileJump(3)"
        @keydown.ctrl.4.exact.prevent="profileJump(4)"
        @keydown.ctrl.5.exact.prevent="profileJump(5)"
        @keydown.ctrl.6.exact.prevent="profileJump(6)"
        @keydown.ctrl.7.exact.prevent="profileJump(7)"
        @keydown.ctrl.8.exact.prevent="profileJump(8)"
        @keydown.ctrl.9.exact.prevent="profileJump(9)"
        @keydown.ctrl.space="ctrlSpace()"
        @keydown.ctrl.left="ctrlLeft()"
        @keydown.ctrl.right="ctrlRight()"
      >
        <div class="flex items-baseline">
          <UiCard
            class-name="mb-1 flex flex-col pb-[7px]"
          >
            <UiCard class-name="relative">
              <div class="Marker" />

              <div
                ref="TimelineDiv"
                class="TimelineContainer"
                :style="{ scrollBehavior: jumpScrollRender }"
              >
                <UiCard
                  class="TimelineInnerContainer"
                  :style="{ width: 3 * secToPx * secPerBar + 'px' }"
                >
                  <canvas
                    ref="TimeCanvas1"
                    :style="{
                      height: barHeight + 'px',
                      width: secToPx * secPerBar + 'px',
                    }"
                  />
                  <canvas
                    ref="TimeCanvas2"
                    :style="{
                      height: barHeight + 'px',
                      width: secToPx * secPerBar + 'px',
                    }"
                  />
                  <canvas
                    ref="TimeCanvas3"
                    style="margin-right: auto"
                    :style="{
                      height: barHeight + 'px',
                      width: secToPx * secPerBar + 'px',
                    }"
                  />
                </UiCard>

                <div
                  class="flex flex-row"
                  style="margin-left: 40%"
                  :style="{ width: 3 * secToPx * secPerBar + 'px' }"
                  @mouseleave="rulerMouseLeave()"
                  @mouseup="rulerMouseUp()"
                  @mousemove="rulerMouseMove($event)"
                >
                  <template v-for="(idx, index) in timecardIdx" :key="`timecard-${idx}`">
                    <div
                      :style="{ width: cardFiller(index) + 'px' }"
                    />
                    <UiCard
                      class-name="Timecard flex flex-row items-center rounded-lg border border-white/10 p-0 shadow-md"
                      :style="{
                        fontsize: fontSize + 'px',
                        width: cardWidth(index) + 'px',
                      }"
                    >
                      <div
                        style="
                          width: 3px;
                          background-color: transparent;
                          height: 100%;
                          cursor: ew-resize;
                        "
                        @mousedown="rulerMouseDown($event, idx, 0)"
                      />
                      <EnhancedEntry
                        :stext="entries[idx].SText"
                        :cc="
                          profile[entries[idx].Profile].useCC
                            ? profile[entries[idx].Profile].CC
                            : ''
                        "
                        :oc="
                          profile[entries[idx].Profile].useOC
                            ? profile[entries[idx].Profile].OC
                            : ''
                        "
                        class="TimecardText"
                        @mousedown="rulerMouseDown($event, idx, 1)"
                      />
                      <div
                        style="
                          width: 3px;
                          background-color: transparent;
                          height: 100%;
                          cursor: ew-resize;
                        "
                        @mousedown="rulerMouseDown($event, idx, 2)"
                      />
                    </UiCard>
                  </template>
                </div>
              </div>
            </UiCard>
          </UiCard>
        </div>
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div class="flex flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <span class="mt-1 opacity-80">{{ profile[profileIdx].Prefix }}</span>
            <UiInput
              v-model="inputString"
              class-name="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              placeholder="Type TL Here <Enter key to send>"
              @keypress.enter="addEntry()"
            />
            <span class="mt-1 opacity-80">{{ profile[profileIdx].Suffix }}</span>
          </div>

          <UiButton size="lg" class-name="lg:mx-2" @click="addEntry()">
            {{ $t("views.tlClient.tlControl.enterBtn") }}
          </UiButton>
          <UiButton variant="secondary" size="lg" @click="TLSetting = !TLSetting">
            {{
              TLSetting
                ? $t("views.tlClient.tlControl.hideSetting")
                : $t("views.tlClient.tlControl.showSetting")
            }}
            <UiIcon :icon="TLSetting ? mdiCogOff : mdiCog" size="sm" />
          </UiButton>
        </div>
        <UiCard v-if="TLSetting" class-name="mt-2 space-y-5 p-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="text-sm font-semibold text-white">
                Current Profile [{{ profile[profileIdx].Name }}] Settings
              </div>
              <div class="mt-2 text-xs leading-6 text-slate-400">
                <span class="mr-2">While typing in TL box:</span>
                <kbd>Up⇧</kbd> / <kbd>Down⇩</kbd>,
                <kbd>Ctrl+[0~9]</kbd>,
                <kbd>Tab↹</kbd>,
                <kbd>Shift⇧-Tab↹</kbd>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <UiIcon :icon="mdiKeyboard" size="sm" class-name="text-slate-400" />
              <UiButton
                variant="ghost"
                size="icon"
                class-name="h-8 w-8"
                @click="TLSetting = false"
              >
                <UiIcon :icon="icons.mdiClose" size="sm" />
              </UiButton>
            </div>
          </div>
          <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
            <UiInput
              v-model="profile[profileIdx].Prefix"
              class-name="flex-1"
              :placeholder="$t('views.tlClient.tlControl.prefix')"
            />
            <UiInput
              v-model="profile[profileIdx].Suffix"
              class-name="flex-1"
              :placeholder="$t('views.tlClient.tlControl.suffix')"
            />
          </div>
          <div class="flex flex-wrap gap-2">
            <UiButton
              variant="outline"
              size="sm"
              @click="
                modalMode = 1;
                modalNexus = true;
                addProfileNameString = 'Profile ' + profile.length;
              "
            >
              {{ $t("views.tlClient.tlControl.addProfile") }}
            </UiButton>
            <UiButton
              variant="outline"
              size="sm"
              @click="
                modalMode = 2;
                modalNexus = true;
              "
            >
              {{ $t("views.tlClient.tlControl.removeProfile") }}
            </UiButton>
            <UiButton variant="outline" size="sm" @click="shiftProfileUp()">
              {{ $t("views.tlClient.tlControl.shiftUp") }}
            </UiButton>
            <UiButton variant="outline" size="sm" @click="shiftProfileDown()">
              {{ $t("views.tlClient.tlControl.shiftDown") }}
            </UiButton>
          </div>
        </UiCard>
      </div>
    </div>

    <!---------   COLOUR MODAL --------->
    <UiDialog
      :open="colourDialogue"
      class-name="max-w-sm p-0"
      @update:open="!$event ? colourPickerClose() : null"
    >
      <UiCard class-name="space-y-5 p-5">
        <label class="flex flex-col gap-2 text-sm">
          <span class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            {{ colourPick === 1 ? $t("views.tlClient.tlControl.fontColour") : $t("views.tlClient.tlControl.outlineColour") }}
          </span>
          <input
            v-if="colourPick === 1 || colourPick === 2"
            :value="colourPick === 1 ? profile[profileIdx].CC : profile[profileIdx].OC"
            type="color"
            class="h-12 w-full rounded-xl border border-white/10 bg-white/5 p-1"
            @input="
              colourPick === 1
                ? profile[profileIdx].CC = $event.target.value
                : profile[profileIdx].OC = $event.target.value
            "
          >
        </label>
        <div class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-lg font-semibold" :style="textStyle">
          {{ $t("views.tlClient.pangram") }}
        </div>
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="colourPickerClose()">
            {{ $t("views.tlClient.cancelBtn") }}
          </UiButton>
          <UiButton size="sm" @click="colourPickerOK()">
            {{ $t("views.tlClient.okBtn") }}
          </UiButton>
        </div>
      </UiCard>
    </UiDialog>
    <!--========   COLOUR MODAL =======-->

    <!---------   NEXUS MODAL ---------
      1 Add profile
      2 Remove Profile
      3 Load Stream
      4 Set as Start
      5 Setting
      6 Export All
      7 Delete All
      8 Editor Mode
    -->
    <UiDialog
      :open="modalNexus"
      :class-name="modalMode === 7 ? 'max-w-sm p-0' : 'max-w-2xl p-0'"
      @update:open="!$event ? modalNexusOutsideClick() : null"
    >
      <!---------    ADD PROFILE     --------->
      <UiCard v-if="modalMode === 1" class-name="space-y-5 p-5">
        <div class="text-lg font-semibold text-white">
          {{ $t("views.tlClient.addProfilePanel.title") }}
        </div>
        <UiInput
          v-model="addProfileNameString"
          :placeholder="$t('views.tlClient.addProfilePanel.inputLabel')"
        />
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="modalNexus = false">
            {{ $t("views.tlClient.cancelBtn") }}
          </UiButton>

          <UiButton size="sm" @click="addProfile()">
            {{ $t("views.tlClient.okBtn") }}
          </UiButton>
        </div>
      </UiCard>

      <!---------    Remove PROFILE     --------->
      <UiCard v-if="modalMode === 2" class-name="space-y-5 p-5">
        <div class="text-lg font-semibold text-white">
          {{
            $t("views.tlClient.removeProfileTitle") +
              " " +
              profile[profileIdx].Name
          }}.
        </div>
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="modalNexus = false">
            {{ $t("views.tlClient.cancelBtn") }}
          </UiButton>

          <UiButton size="sm" @click="deleteProfile()">
            {{ $t("views.tlClient.okBtn") }}
          </UiButton>
        </div>
      </UiCard>

      <!-------  LOAD VIDEO  ------->
      <UiCard v-if="modalMode === 3" class-name="space-y-5 p-5">
        <div class="text-lg font-semibold text-white">
          {{ $t("views.scriptEditor.loadVideoPanel.title") }}
        </div>
        <UiInput
          v-model="activeURLInput"
          :placeholder="$t('views.scriptEditor.loadVideoPanel.inputLabel')"
        />
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="modalNexus = false">
            {{ $t("views.tlClient.cancelBtn") }}
          </UiButton>

          <UiButton
            size="sm"
            @click="
              loadVideo();
              modalNexus = false;
            "
          >
            {{ $t("views.tlClient.okBtn") }}
          </UiButton>
        </div>
      </UiCard>

      <!-------  SET START ENTRY  ------->
      <UiCard v-if="modalMode === 4" class-name="space-y-5 p-5">
        <div class="text-lg font-semibold text-white" style="word-break: normal">
          {{ $t("views.scriptEditor.setStartTitle") }}
        </div>
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="modalNexus = false">
            {{ $t("views.tlClient.cancelBtn") }}
          </UiButton>
          <UiButton
            size="sm"
            @click="
              setStartEntry();
              modalNexus = false;
            "
          >
            {{ $t("views.tlClient.okBtn") }}
          </UiButton>
        </div>
      </UiCard>

      <!---------    SETTING     --------->
      <UiCard v-if="modalMode === 5" class-name="space-y-5 p-5">
        <div class="text-lg font-semibold text-white">
          {{ $t("views.tlClient.settingPanel.title") }}
        </div>
        <div class="text-sm text-slate-400">
          {{
            $t("views.watch.uploadPanel.usernameText") +
              " : " +
              userdata.user.username +
              " "
          }}
          <a
            class="text-xs underline"
            @click="changeUsernameClick()"
          >{{ $t("views.watch.uploadPanel.usernameChange") }}</a>
        </div>
        <label class="flex flex-col gap-2 text-sm">
          <span class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            {{ $t("views.watch.uploadPanel.tlLang") }}
          </span>
          <select
            v-model="selectedTLLangValue"
            class="h-11 rounded-2xl border border-white/12 bg-white/6 px-3 text-sm text-white outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
            @change="localPrefix = '[' + TLLang.value + '] '"
          >
            <option
              v-for="item in TL_LANGS"
              :key="item.value"
              :value="item.value"
              class="bg-slate-900"
            >
              {{ item.text }} ({{ item.value }})
            </option>
          </select>
        </label>
        <UiInput
          v-model="activeURLStream"
          :placeholder="$t('views.tlClient.settingPanel.mainStreamLink')"
        />
        <div class="flex justify-center">
          <UiButton size="sm" @click="settingOKClick()">
            {{ $t("views.tlClient.okBtn") }}
          </UiButton>
        </div>
      </UiCard>

      <!---------    EXPORT ALL     --------->
      <UiCard v-if="modalMode === 6" class-name="p-0">
        <ExportFile
          :entries="entries"
          :profile="profile"
          :title="userdata.user.username + ' - ' + videoData.title"
        />
      </UiCard>

      <!---------    DELETE ALL     --------->
      <UiCard v-if="modalMode === 7" class-name="space-y-5 p-5">
        <div class="text-lg font-semibold text-white">
          {{ $t("views.scriptEditor.menu.clearAll") }}
        </div>
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="modalNexus = false">
            {{ $t("views.tlClient.cancelBtn") }}
          </UiButton>
          <UiButton
            variant="destructive"
            size="sm"
            @click="
              clearAll();
              modalNexus = false;
            "
          >
            {{ $t("views.tlClient.okBtn") }}
          </UiButton>
        </div>
      </UiCard>

      <!---------    TIME SHIFT    --------->
      <UiCard v-if="modalMode === 9" class-name="space-y-5 p-5">
        <div class="text-lg font-semibold text-white">
          Time Shift
        </div>
        <label class="flex flex-col gap-2 text-sm">
          <span class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Offset</span>
          <div class="flex items-center gap-2">
            <UiInput
              v-model="offsetInput"
              class-name="flex-1"
              type="number"
            />
            <span class="text-slate-400">sec</span>
          </div>
        </label>
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="modalNexus = false">
            {{ $t("views.tlClient.cancelBtn") }}
          </UiButton>
          <UiButton
            size="sm"
            @click="
              modalNexus = false;
              shiftTime();
            "
          >
            {{ $t("views.tlClient.okBtn") }}
          </UiButton>
        </div>
      </UiCard>

      <UiCard v-if="modalMode === 10" class-name="space-y-5 p-5">
        <div class="text-lg font-semibold text-white">
          Change stream link
        </div>
        <UiInput
          v-model="linkInput"
          placeholder="New link"
        />
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="modalNexus = false">
            {{ $t("views.tlClient.cancelBtn") }}
          </UiButton>
          <UiButton size="sm" @click="modalNexus = false">
            {{ $t("views.tlClient.okBtn") }}
          </UiButton>
        </div>
      </UiCard>
    </UiDialog>
    <ImportFile v-model="importPanelShow" @bounceDataBack="processImportData" />
    <!--========   NEXUS MODAL =======-->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import Entrytr from "@/components/tlscripteditor/Entrytr.vue";
import EnhancedEntry from "@/components/tlscripteditor/EnhancedEntry.vue";
import ImportFile from "@/components/tlscripteditor/ImportFile.vue";
import ExportFile from "@/components/tlscripteditor/ExportToFile.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiDialog from "@/components/ui/dialog/Dialog.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiInput from "@/components/ui/input/Input.vue";
import { TL_LANGS, VIDEO_URL_REGEX } from "@/utils/consts";
import { mdiPlay, mdiStop, mdiCog, mdiCogOff, mdiKeyboard } from "@mdi/js";
import { mdiHome, mdiClose } from "@/utils/icons";
import { videoCodeParser } from "@/utils/functions";
import backendApi from "@/utils/backend-api";
import { useAppStore } from "@/stores/app";
import { useMetaTitle } from "@/composables/useMetaTitle";

useMetaTitle(() => "TLScriptEditor - Holodex");

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();

// Template refs
const tableContainer = ref<InstanceType<typeof UiCard> | null>(null);
const TimelineDiv = ref<HTMLDivElement | null>(null);
const TimeCanvas1 = ref<HTMLCanvasElement | null>(null);
const TimeCanvas2 = ref<HTMLCanvasElement | null>(null);
const TimeCanvas3 = ref<HTMLCanvasElement | null>(null);

// Global icons used in template
const icons = { mdiHome, mdiClose };

// Reactive state
const TLSetting = ref(true);
const menuBool = ref(false);
const entries = ref<any[]>([]);
const profile = ref<any[]>([
  {
    Name: "Default",
    Prefix: "",
    Suffix: "",
    useCC: false,
    CC: "#000000",
    useOC: false,
    OC: "#000000",
  },
]);
const profileContainer = ref<any>({});
const profileIdx = ref(0);
const profileDisplay = ref(false);
const profileDisplayTimer = ref<ReturnType<typeof setInterval> | undefined>(undefined);
const inputString = ref("");
const tableHeight = ref(0);
const selectedEntry = ref(-1);
const fontSize = ref(15);
const videoData = ref<any>(undefined);
const transactionLog = ref<any[]>([]);
const loggerTimer = ref<ReturnType<typeof setInterval> | undefined>(undefined);
const colourPick = ref(0);
const colourDialogue = ref(false);
const colourTemp = ref("");
const modalNexus = ref(true);
const modalMode = ref(5);
const addProfileNameString = ref("");
const importPanelShow = ref(false);
const offsetInput = ref<number | string>(0);
const linkInput = ref("");
const TLLang = ref(TL_LANGS[0]);
const activeURLInput = ref("");
const activeURLStream = ref("");
const vidType = ref("");
const vidPlayer = ref(false);
const vidIframeEle = ref<HTMLIFrameElement | null>(null);
const player = ref<any>(null);
const IFOrigin = ref("");
const timerActive = ref(false);
const timerMode = ref(0);
const defaultRefreshRate = ref(1000 / 30);
const timerTime = ref(0);
const refreshRate = ref(33);
const secToPx = ref(100);
const secPerBar = ref(60);
const barHeight = ref(25);
const jumpScroll = ref(true);
const barCount = ref(0);
const displayEntry = ref(0);
const timecardIdx = ref<number[]>([]);
const resizeMode = ref<number | boolean>(false);
const xPos = ref(0);
const editorMode = ref(false);
const timelineActive = ref(false);
const pauseTracker = ref(false);
const localPrefix = ref("");

// Computed
const tableHeightCalculator = computed(() => `${tableHeight.value}px`);

const textStyle = computed(() => ({
  "-webkit-text-fill-color":
    profile.value[profileIdx.value].CC === ""
      ? "unset"
      : profile.value[profileIdx.value].CC,
  "-webkit-text-stroke-color":
    profile.value[profileIdx.value].OC === ""
      ? "unset"
      : profile.value[profileIdx.value].OC,
  "-webkit-text-stroke-width":
    profile.value[profileIdx.value].OC === "" ? "0px" : "1px",
}));

const userdata = computed(() => appStore.userdata);
const timerPrint = computed(() => {
  let timeRaw = timerTime.value;
  let timeString = "";

  let t = Math.floor(timeRaw / 60 / 60 / 1000);
  timeRaw -= t * 60 * 60 * 1000;
  if (t < 10) {
    timeString += `0${t.toString()}`;
  } else {
    timeString += t.toString();
  }
  timeString += ":";

  t = Math.floor(timeRaw / 60 / 1000);
  timeRaw -= t * 60 * 1000;
  if (t < 10) {
    timeString += `0${t.toString()}`;
  } else {
    timeString += t.toString();
  }
  timeString += ":";

  t = Math.floor(timeRaw / 1000);
  timeRaw -= t * 1000;
  if (t < 10) {
    timeString += `0${t.toString()}`;
  } else {
    timeString += t.toString();
  }
  timeString += ".";

  if (timeRaw > 100) {
    timeString += timeRaw.toString().slice(0, 2);
  } else if (timeRaw > 10) {
    timeString += `0${timeRaw.toString().slice(0, 1)}`;
  } else {
    timeString += "00";
  }

  return timeString;
});

const timeStampStart = computed(() => {
  let timeRaw = entries.value[selectedEntry.value].Time;
  let timeString = "";

  let t = Math.floor(timeRaw / 60 / 60 / 1000);
  timeRaw -= t * 60 * 60 * 1000;
  if (t < 10) {
    timeString += `0${t.toString()}`;
  } else {
    timeString += t.toString();
  }
  timeString += ":";

  t = Math.floor(timeRaw / 60 / 1000);
  timeRaw -= t * 60 * 1000;
  if (t < 10) {
    timeString += `0${t.toString()}`;
  } else {
    timeString += t.toString();
  }
  timeString += ":";

  t = Math.floor(timeRaw / 1000);
  timeRaw -= t * 1000;
  if (t < 10) {
    timeString += `0${t.toString()}`;
  } else {
    timeString += t.toString();
  }
  timeString += ".";

  if (timeRaw > 100) {
    timeString += timeRaw.toString().slice(0, 2);
  } else if (timeRaw > 10) {
    timeString += `0${timeRaw.toString().slice(0, 1)}`;
  } else {
    timeString += "00";
  }

  return timeString;
});

const timeStampEnd = computed(() => {
  let timeRaw =
    entries.value[selectedEntry.value].Time +
    entries.value[selectedEntry.value].Duration;
  let timeString = "";

  let t = Math.floor(timeRaw / 60 / 60 / 1000);
  timeRaw -= t * 60 * 60 * 1000;
  if (t < 10) {
    timeString += `0${t.toString()}`;
  } else {
    timeString += t.toString();
  }
  timeString += ":";

  t = Math.floor(timeRaw / 60 / 1000);
  timeRaw -= t * 60 * 1000;
  if (t < 10) {
    timeString += `0${t.toString()}`;
  } else {
    timeString += t.toString();
  }
  timeString += ":";

  t = Math.floor(timeRaw / 1000);
  timeRaw -= t * 1000;
  if (t < 10) {
    timeString += `0${t.toString()}`;
  } else {
    timeString += t.toString();
  }
  timeString += ".";

  if (timeRaw > 100) {
    timeString += timeRaw.toString().slice(0, 2);
  } else if (timeRaw > 10) {
    timeString += `0${timeRaw.toString().slice(0, 1)}`;
  } else {
    timeString += "00";
  }

  return timeString;
});

const textStyle2 = computed(() => ({
  "-webkit-text-fill-color": !profile.value[
    entries.value[selectedEntry.value].Profile
  ].useCC
    ? "unset"
    : profile.value[entries.value[selectedEntry.value].Profile].CC,
  "-webkit-text-stroke-color": !profile.value[
    entries.value[selectedEntry.value].Profile
  ].useOC
    ? "unset"
    : profile.value[entries.value[selectedEntry.value].Profile].OC,
  "-webkit-text-stroke-width": !profile.value[
    entries.value[selectedEntry.value].Profile
  ].useOC
    ? "0px"
    : "1px",
}));

const profileListPicker = computed(() => {
  const profileList: any[] = [];
  for (let i = 0; i < profile.value.length; i += 1) {
    profileList.push({
      idx: i,
      name: profile.value[i].Name,
    });
  }
  return profileList;
});

const selectedTLLangValue = computed({
  get: () => TLLang.value?.value ?? "",
  set: (val: string) => {
    const selected = TL_LANGS.find((item) => item.value === val);
    if (selected) {
      TLLang.value = selected;
    }
  },
});

const jumpScrollRender = computed(() => (jumpScroll.value ? "unset" : "smooth"));

// Methods
function init() {
  checkLoginValidity();
  rerenderTimeline();
  activeURLStream.value = videoCodeParser(route.query.video as string);
  modalNexus.value = true;
  modalMode.value = 5;
  editorMode.value = false;
}

function onResize() {
  tableHeight.value = 0;
  if (!tableContainer.value?.$el) {
    return;
  }
  const checker = setInterval(() => {
    tableHeight.value = tableContainer.value!.$el.clientHeight - 20;
    if (tableHeight.value !== 0) {
      clearInterval(checker);
    }
  }, 33);
}

function addEntry() {
  const dt = {
    id: Date.now(),
    Time: timerTime.value,
    Duration: 3000,
    SText:
      profile.value[profileIdx.value].Prefix +
      inputString.value +
      profile.value[profileIdx.value].Suffix,
    Profile: profileIdx.value,
  };

  let inserted: boolean = false;
  for (let i = 0; i < entries.value.length; i += 1) {
    if (entries.value[i].Time > dt.Time) {
      if (i > 0) {
        entries.value[i - 1].Duration = dt.Time - entries.value[i - 1].Time;
        logChange(entries.value[i - 1].id);
      }

      if (i < entries.value.length) {
        dt.Duration = entries.value[i].Time - dt.Time;
      }

      entries.value.splice(i, 0, dt);
      displayEntry.value = i;
      inserted = true;
      inputString.value = "";
      reloadDisplayCards();
      break;
    }
  }

  if (!inserted) {
    if (entries.value.length !== 0) {
      entries.value[entries.value.length - 1].Duration =
        dt.Time - entries.value[entries.value.length - 1].Time;
      logChange(entries.value[entries.value.length - 1].id);
    }
    entries.value.push(dt);
    displayEntry.value = entries.value.length - 1;
    inputString.value = "";
    reloadDisplayCards();
  }

  transactionLog.value.push({
    type: "Add",
    id: dt.id,
  });
}

function clearAll() {
  displayEntry.value = -1;
  timecardIdx.value = [];
  selectedEntry.value = -1;

  for (; entries.value.length > 0; ) {
    const tempEntries = entries.value.splice(0, 1)[0];
    let checkNew = transactionLog.value.filter(
      (e) => e.id === tempEntries.id,
    );
    if (checkNew.length === 0) {
      transactionLog.value.push({
        type: "Delete",
        id: tempEntries.id,
      });
    } else {
      checkNew = checkNew.filter((e) => e.type === "Change");
      if (checkNew.length === 0) {
        transactionLog.value = transactionLog.value.filter(
          (e) => e.id !== tempEntries.id,
        );
      } else {
        transactionLog.value = transactionLog.value.filter(
          (e) => e.id !== tempEntries.id,
        );
        transactionLog.value.push({
          type: "Delete",
          id: tempEntries.id,
        });
      }
    }
  }

  processLog(false);
  reloadDisplayCards();
}

function continuousTime() {
  displayEntry.value = -1;
  timecardIdx.value = [];
  selectedEntry.value = -1;

  for (let idx = 0; idx < entries.value.length - 1; idx += 1) {
    if (
      entries.value[idx].Time + entries.value[idx].Duration <
      entries.value[idx + 1].Time
    ) {
      entries.value[idx].Duration =
        entries.value[idx + 1].Time - entries.value[idx].Time;
      logChange(entries.value[idx].id);
    }
  }

  processLog(false);
  reloadDisplayCards();
}

function logChange(ID: any) {
  if (transactionLog.value.filter((e) => e.id === ID).length === 0) {
    transactionLog.value.push({
      type: "Change",
      id: ID,
    });
  }
}

function getEntryByID(ID: string) {
  const entry = entries.value.filter((e) => e.id === ID);
  if (entry.length === 0) {
    return undefined;
  }
  return entry[0];
}

function processLog(forget: boolean = false) {
  if (transactionLog.value.length > 0) {
    const logCopy: any[] = [];
    for (; transactionLog.value.length > 0; ) {
      logCopy.push(transactionLog.value.splice(0, 1)[0]);
    }

    const processedLog: any[] = [];
    logCopy.forEach((e) => {
      if (e.type === "Delete") {
        processedLog.push({
          type: "Delete",
          data: {
            id: e.id,
          },
        });
      } else if (e.type === "Change") {
        const entry = getEntryByID(e.id);
        if (entry) {
          processedLog.push({
            type: "Change",
            data: {
              lang: TLLang.value.value,
              id: entry.id,
              name: userdata.value.user.username,
              timestamp: Math.floor(
                videoData.value.start_actual
                  ? videoData.value.start_actual + entry.Time
                  : entry.realTime,
              ),
              message: entry.SText,
              duration: Math.floor(entry.Duration),
            },
          });
        }
      } else if (e.type === "Add") {
        const entry = getEntryByID(e.id);
        if (entry) {
          processedLog.push({
            type: "Add",
            data: {
              tempid: entry.id,
              name: userdata.value.user.username,
              timestamp: Math.floor(
                videoData.value.start_actual
                  ? videoData.value.start_actual + entry.Time
                  : entry.realTime,
              ),
              message: entry.SText,
              duration: Math.floor(entry.Duration),
            },
          });
        }
      }
    });

    const postTLOption = {
      videoId: videoData.value.id,
      jwt: userdata.value.jwt,
      body: processedLog,
      lang: TLLang.value.value,
      override: editorMode.value,
      ...(videoData.value.id === "custom" && {
        custom_video_id: videoData.value.custom_video_id,
      }),
    };
    if (forget) {
      backendApi.postTLLog(postTLOption);
    } else {
      backendApi
        .postTLLog(postTLOption)
        .then(({ status, data }: { status: number; data: any[] }) => {
          if (status === 200) {
            data.forEach((e: any) => {
              if (e.type === "Add") {
                for (
                  let idx = 0;
                  idx < entries.value.length;
                  idx += 1
                ) {
                  if (entries.value[idx].id === e.tempid) {
                    entries.value[idx].id = e.res.id;
                    break;
                  }
                }
                for (
                  let idx = 0;
                  idx < transactionLog.value.length;
                  idx += 1
                ) {
                  if (transactionLog.value[idx].id === e.tempid) {
                    transactionLog.value[idx].id = e.res.id;
                  }
                }
              }
            });
          }
        })
        .catch((err: any) => {
          console.error(err);
           
          alert(`Failed to save: ${err}`);
        });
    }
  }
}

// ----------------------- TIMER CONTROLLER -----------------------
function proceedTimer(lastTime: number) {
  const nowFreeze = Date.now();
  if (!timerActive.value) {
    return;
  }

  switch (timerMode.value) {
    case 0: {
      if (nowFreeze - lastTime < 1000) {
        timerTime.value += nowFreeze - lastTime;
      }
      scrollCalculator();
      break;
    }

    case 1: {
      timerTime.value = player.value.getCurrentTime() * 1000;
      scrollCalculator();
      break;
    }

    default:
      return;
  }
  if (nowFreeze - lastTime < refreshRate.value) {
    setTimeout(() => {
      proceedTimer(nowFreeze);
    }, refreshRate.value - nowFreeze + lastTime);
  } else {
    proceedTimer(nowFreeze);
  }
}

function timerTimeStart() {
  if (vidPlayer.value) {
    switch (vidType.value) {
      case "twitch":
        player.value.play();
        break;

      case "twitch_vod":
        player.value.play();
        break;

      case "twitcast":
        startPing();
        break;

      case "twitcast_vod":
        startPing();
        break;

      case "niconico":
        break;

      case "niconico_vod":
        startPing();
        break;

      case "bilibili":
        break;

      case "bilibili_vod":
        startPing();
        break;

      default:
        player.value.playVideo();
        break;
    }
  } else if (!timerActive.value) {
    timerMode.value = 0;
    refreshRate.value = defaultRefreshRate.value;
    timerActive.value = true;
    proceedTimer(Date.now());
  }
}

function timerTimeStop() {
  if (vidPlayer.value) {
    switch (vidType.value) {
      case "twitch":
        player.value.pause();
        break;

      case "twitch_vod":
        player.value.pause();
        break;

      case "twitcast":
        pausePing();
        break;

      case "twitcast_vod":
        pausePing();
        break;

      case "niconico":
        break;

      case "niconico_vod":
        pausePing();
        break;

      case "bilibili":
        break;

      case "bilibili_vod":
        pausePing();
        break;

      default:
        player.value.pauseVideo();
        break;
    }
  } else if (timerActive.value) {
    timerActive.value = false;
  }
}

function seekVideo(time: number) {
  if (vidPlayer.value) {
    switch (vidType.value) {
      case "twitch":
        // NO
        break;

      case "twitch_vod":
        player.value.seek(timerTime.value / 1000 + time / 1000);
        break;

      case "twitcast":
        // NO
        break;

      case "twitcast_vod":
        timePing(time);
        break;

      case "niconico":
        break;

      case "niconico_vod":
        timePing(time);
        break;

      case "bilibili":
        break;

      case "bilibili_vod":
        timePing(time);
        break;

      default:
        player.value.seekTo(
          player.value.getCurrentTime() + time / 1000,
          true,
        );
        break;
    }
  } else if (timerTime.value + time < 0) {
    timerTime.value = 0;
  } else {
    timerTime.value += time;
  }
}

function ctrlRight() {
  seekVideo(3000);
}

function ctrlLeft() {
  seekVideo(-3000);
}

function ctrlSpace() {
  if (vidPlayer.value) {
    switch (vidType.value) {
      case "twitch":
        if (player.value.isPaused()) {
          timerTimeStart();
        } else {
          timerTimeStop();
        }
        break;

      case "twitch_vod":
        if (player.value.isPaused()) {
          timerTimeStart();
        } else {
          timerTimeStop();
        }
        break;

      case "twitcast":
        switchPing();
        break;

      case "twitcast_vod":
        switchPing();
        break;

      case "niconico":
        break;

      case "niconico_vod":
        switchPing();
        break;

      case "bilibili":
        break;

      case "bilibili_vod":
        switchPing();
        break;

      default:
        if (player.value.getPlayerState() !== 1) {
          timerTimeStart();
        } else if (player.value.getPlayerState() === 1) {
          timerTimeStop();
        }
        break;
    }
  } else if (timerActive.value) {
    timerTimeStop();
  } else {
    timerTimeStart();
  }
}
//= ====================== TIMER CONTROLLER =======================

// ------------------------ PROFILE CONTROLLER ------------------------
function shiftProfileUp() {
  if (profileIdx.value > 1) {
    profileContainer.value = JSON.parse(
      JSON.stringify(profile.value[profileIdx.value - 1]),
    );
    profile.value[profileIdx.value - 1] = profile.value[profileIdx.value];
    profile.value[profileIdx.value] = profileContainer.value;
    profileIdx.value -= 1;
    profileContainer.value = {};
  }
  showProfileList();
}

function shiftProfileDown() {
  if (
    profileIdx.value !== 0 &&
    profileIdx.value < profile.value.length - 1
  ) {
    profileContainer.value = JSON.parse(
      JSON.stringify(profile.value[profileIdx.value + 1]),
    );
    profile.value[profileIdx.value + 1] = profile.value[profileIdx.value];
    profile.value[profileIdx.value] = profileContainer.value;
    profileIdx.value += 1;
    profileContainer.value = {};
  }
  showProfileList();
}

function profileUp() {
  if (profileIdx.value === 0) {
    profileIdx.value = profile.value.length - 1;
  } else {
    profileIdx.value -= 1;
  }
  showProfileList();
}

function profileDown(isTab: boolean) {
  if (profileIdx.value === profile.value.length - 1) {
    profileIdx.value = isTab ? 1 : 0;
  } else {
    profileIdx.value += 1;
  }
  showProfileList();
}

function profileJump(idx: number) {
  if (idx < profile.value.length) {
    profileIdx.value = idx;
  }
  showProfileList();
}

function profileJumpToDefault() {
  profileIdx.value = 0;
  showProfileList();
}

function addProfile() {
  if (addProfileNameString.value.trim() === "") {
    addProfileNameString.value = `Profile ${profile.value.length}`;
  }
  profile.value.push({
    Name: addProfileNameString.value,
    Prefix: "",
    Suffix: "",
    useCC: false,
    CC: "#000000",
    useOC: false,
    OC: "#000000",
  });
  profileIdx.value = profile.value.length - 1;
  modalNexus.value = false;
  showProfileList();
}

function deleteProfile() {
  if (profileIdx.value !== 0) {
    entries.value
      .filter((e) => e.Profile === profileIdx.value)
      .map((e) => {
        e.Profile = 0;
        return e;
      });

    profileIdx.value -= 1;
    profile.value.splice(profileIdx.value + 1, 1);
  }
  modalNexus.value = false;
  showProfileList();
}

function showProfileList() {
  if (!profileDisplay.value) {
    profileDisplay.value = true;
  }

  if (profileDisplayTimer.value) {
    clearInterval(profileDisplayTimer.value);
  }

  profileDisplayTimer.value = setInterval(() => {
    profileDisplay.value = false;
    clearInterval(profileDisplayTimer.value);
  }, 3000);
}

function colourPickerClose() {
  if (colourPick.value === 1) {
    profile.value[profileIdx.value].CC = colourTemp.value;
  } else if (colourPick.value === 2) {
    profile.value[profileIdx.value].OC = colourTemp.value;
  }
  colourDialogue.value = false;
}

function colourPickerOK() {
  colourDialogue.value = false;
}
//= ======================== PROFILE CONTROLLER ========================

// ---------------------- VIDEO CONTROLLER ----------------------
function loadVideo() {
  activeURLStream.value = activeURLInput.value;
  vidPlayer.value = true;
  const checker = setInterval(() => {
    const PlayerDiv = document.getElementById("player");
    if (PlayerDiv) {
      clearInterval(checker);
      if (timerActive.value) {
        timerActive.value = false;
      }
      const ytId = activeURLStream.value.match(VIDEO_URL_REGEX)?.groups?.id;
      if (ytId) {
        loadVideoYT(ytId);
      }
    }
  }, 1000);
}

function unloadVideo() {
  vidPlayer.value = false;
  if (timerActive.value) {
    timerActive.value = false;
  }

  if (vidIframeEle.value) {
    window.removeEventListener("message", (e: any) => {
      iframeVideoListener(e);
    });
  }

  if (
    (vidType.value === "twitch" || vidType.value === "twitch_vod") &&
    (window as any).Twitch
  ) {
    player.value.removeEventListener(
      (window as any).Twitch.Player.PAUSE,
      () => {
        pauseTracker.value = true;
      },
    );

    player.value.removeEventListener(
      (window as any).Twitch.Player.PLAY,
      () => {
        pauseTracker.value = false;
      },
    );

    player.value.removeEventListener(
      (window as any).Twitch.Player.SEEK,
      (e: any) => {
        timerTime.value = e.position * 1000;
        scrollCalculator();
      },
    );
  }
}

// -----------------  IFRAME  -----------------
function timePing(timestamp: number): void {
  if (vidIframeEle.value?.contentWindow) {
    vidIframeEle.value.contentWindow.postMessage(
      {
        n: "HolodexSync",
        d: timestamp,
      },
      IFOrigin.value,
    );
  }
}

function startPing(): void {
  if (vidIframeEle.value?.contentWindow) {
    vidIframeEle.value.contentWindow.postMessage(
      {
        n: "HolodexSync",
        d: "s",
      },
      IFOrigin.value,
    );
  }
}

function pausePing(): void {
  if (vidIframeEle.value?.contentWindow) {
    vidIframeEle.value.contentWindow.postMessage(
      {
        n: "HolodexSync",
        d: "p",
      },
      IFOrigin.value,
    );
  }
}

function switchPing(): void {
  if (vidIframeEle.value?.contentWindow) {
    vidIframeEle.value.contentWindow.postMessage(
      {
        n: "HolodexSync",
        d: "w",
      },
      IFOrigin.value,
    );
  }
}

function iframeVideoListener(e: any): void {
  if (e.origin === IFOrigin.value) {
    if (e.data.n === "SyncHolodex") {
      if (typeof e.data.d === "number") {
        timerTime.value = e.data.d;
        scrollCalculator();
      }
    }
  }
}
//= ================  IFRAME  =================

// -----------------  YT  -----------------
function loadVideoYT(VID: string) {
  if ((window as any).YT) {
    startVideoYT(VID);
    return;
  }

  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  const firstScriptTag = document.getElementsByTagName("script")[0];
  if (firstScriptTag.parentNode) {
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  }

  (window as any).onYouTubeIframeAPIReady = () => startVideoYT(VID);
}

function startVideoYT(VID: string) {
  player.value = new (window as any).YT.Player("player", {
    videoId: VID,
    playerVars: {
      playsinline: 1,
    },
    events: {
      onReady: readyStateYT,
    },
  });
}

function readyStateYT() {
  startTrackerYT();
}

function startTrackerYT(): void {
  timerMode.value = 1;
  refreshRate.value = 100;
  if (!timerActive.value) {
    timerActive.value = true;
    proceedTimer(Date.now());
  }
}
//= ================  YT  =================

//= ================  TW  =================

//= ====================== VIDEO CONTROLLER ======================

//= =----------------------- ENTRY CONTROLLER ------------------------
function deleteEntry() {
  const tempEntries = JSON.parse(
    JSON.stringify(entries.value[selectedEntry.value]),
  );
  displayEntry.value = -1;
  timecardIdx.value = [];
  entries.value.splice(selectedEntry.value, 1);
  reloadDisplayCards();
  selectedEntry.value = -1;

  let checkNew = transactionLog.value.filter(
    (e) => e.id === tempEntries.id,
  );
  if (checkNew.length === 0) {
    transactionLog.value.push({
      type: "Delete",
      id: tempEntries.id,
    });
  } else {
    checkNew = checkNew.filter((e) => e.type === "Change");
    if (checkNew.length === 0) {
      transactionLog.value = transactionLog.value.filter(
        (e) => e.id !== tempEntries.id,
      );
    } else {
      transactionLog.value = transactionLog.value.filter(
        (e) => e.id !== tempEntries.id,
      );
      transactionLog.value.push({
        type: "Delete",
        id: tempEntries.id,
      });
    }
  }
}

function setStartEntry() {
  timecardIdx.value = [];
  displayEntry.value = -1;
  for (let idx = 0; idx < selectedEntry.value; idx += 1) {
    transactionLog.value.push({
      type: "Delete",
      id: idx,
    });
  }
  entries.value.splice(0, selectedEntry.value);
  selectedEntry.value = -1;
  const timeCut = entries.value[0].Time;
  entries.value = entries.value.map((e) => {
    logChange(e.id);
    e.Time -= timeCut;
    return e;
  });
  reloadDisplayCards();
}
//= ======================== ENTRY CONTROLLER ========================

//= ------------------------ TIMELINE CONTROLLER ------------------------
function cardFiller(index: number) {
  if (index === 0) {
    if (
      entries.value[timecardIdx.value[index]].Time / 1000 <
      secPerBar.value * barCount.value
    ) {
      return 0;
    }
    return (
      (entries.value[timecardIdx.value[index]].Time / 1000 -
        secPerBar.value * barCount.value) *
      secToPx.value
    );
  }
  return (
    ((entries.value[timecardIdx.value[index]].Time -
      entries.value[timecardIdx.value[index - 1]].Time -
      entries.value[timecardIdx.value[index - 1]].Duration) /
      1000) *
    secToPx.value
  );
}

function cardWidth(index: number) {
  if (
    index === 0 &&
    entries.value[timecardIdx.value[index]].Time / 1000 <
    secPerBar.value * barCount.value
  ) {
    return (
      ((entries.value[timecardIdx.value[index]].Duration +
        entries.value[timecardIdx.value[index]].Time) /
        1000 -
        secPerBar.value * barCount.value) *
      secToPx.value
    );
  }
  if (
    index === timecardIdx.value.length - 1 &&
    (entries.value[timecardIdx.value[index]].Duration +
      entries.value[timecardIdx.value[index]].Time) /
    1000 >
    secPerBar.value * (barCount.value + 3)
  ) {
    return (
      (secPerBar.value * (barCount.value + 3) -
        entries.value[timecardIdx.value[index]].Time / 1000) *
      secToPx.value
    );
  }
  return (
    (entries.value[timecardIdx.value[index]].Duration / 1000) * secToPx.value
  );
}

function secToTimeString(
  secInput: number,
  msOutput: boolean = true,
  Full: boolean = false,
): string {
  let Sec = secInput;
  let MS: string = Math.floor((Sec % 1) * 100).toString();
  if (MS.length === 1) {
    MS = `0${MS}`;
  }

  Sec = Math.floor(Sec);
  const H: number = Math.floor(Sec / 60 / 60);
  Sec -= H * 60 * 60;
  const M: number = Math.floor(Sec / 60);
  Sec -= M * 60;

  let Stemp: string = H.toString();
  if (Stemp.length === 1) {
    Stemp = `0${Stemp}`;
  }
  Stemp = `${Stemp}:${`0${M.toString()}`.slice(
    -2,
  )}:${`0${Sec.toString()}`.slice(-2)}.${MS}`;

  if (Full) {
    if (msOutput) {
      return Stemp;
    }
    return Stemp.slice(0, Stemp.length - 3);
  }
  for (let i = 0; i < 3; i += 1) {
    if (Stemp.slice(0, 2) !== "00") {
      break;
    } else {
      Stemp = Stemp.slice(3);
    }
  }

  if (Stemp[0] === "0") {
    Stemp = Stemp.slice(1);
  }

  if (msOutput) {
    return Stemp;
  }
  return Stemp.slice(0, Stemp.length - 3);
}

function scrollCalculator(): void {
  const deltaBar: number =
    timerTime.value / 1000 / secPerBar.value - barCount.value;
  if (deltaBar > 3 || deltaBar < 0) {
    const barCountNew = Math.floor(timerTime.value / 1000 / secPerBar.value);
    if (barCountNew > 0) {
      barCount.value = barCountNew - 1;
    } else {
      barCount.value = 0;
    }
    rerenderTimeline();
    reloadDisplayCards();
  } else if (deltaBar > 2) {
    barCount.value += 1;
    renderForward();
    reloadDisplayCards();
  } else if (deltaBar < 1 && barCount.value > 0) {
    barCount.value -= 1;
    renderBackward();
    reloadDisplayCards();
  }

  if (TimelineDiv.value) {
    TimelineDiv.value.scrollLeft =
      (timerTime.value / 1000 - barCount.value * secPerBar.value) *
      secToPx.value;
  }
}

function renderCtx(ctx: CanvasRenderingContext2D, idx: number) {
  ctx.save();
  ctx.strokeStyle = "white";
  ctx.fillStyle = "white";
  ctx.font = "14px Ubuntu";
  ctx.lineWidth = 0.35;

  if (secToPx.value <= 60) {
    for (let x = 0; x / 10 < secPerBar.value; x += 10) {
      ctx.beginPath();
      ctx.moveTo((x * secToPx.value) / 10, 0);
      ctx.lineTo((x * secToPx.value) / 10, barHeight.value);
      ctx.stroke();

      ctx.fillText(
        secToTimeString(
          x / 10 + idx * secPerBar.value + barCount.value * secPerBar.value,
          false,
          false,
        ),
        (x * secToPx.value) / 10 + 5,
        barHeight.value,
      );
    }

    ctx.restore();
  } else if (secToPx.value <= 100) {
    for (let x = 0; x / 10 < secPerBar.value; x += 2) {
      if (x % 10 === 0) {
        ctx.beginPath();
        ctx.moveTo((x * secToPx.value) / 10, 0);
        ctx.lineTo((x * secToPx.value) / 10, barHeight.value);
        ctx.stroke();

        ctx.fillText(
          secToTimeString(
            x / 10 +
              idx * secPerBar.value +
              barCount.value * secPerBar.value,
            false,
            false,
          ),
          (x * secToPx.value) / 10 + 5,
          barHeight.value,
        );
      } else {
        ctx.beginPath();
        ctx.moveTo((x * secToPx.value) / 10, 0);
        ctx.lineTo(
          (x * secToPx.value) / 10,
          (barHeight.value * 2.0) / 5.0,
        );
        ctx.stroke();
      }
    }

    ctx.restore();
  } else {
    for (let x = 0; x / 10 < secPerBar.value; x += 1) {
      if (x % 10 === 0) {
        ctx.beginPath();
        ctx.moveTo((x * secToPx.value) / 10, 0);
        ctx.lineTo((x * secToPx.value) / 10, barHeight.value);
        ctx.stroke();

        ctx.fillText(
          secToTimeString(
            x / 10 +
              idx * secPerBar.value +
              barCount.value * secPerBar.value,
            false,
            false,
          ),
          (x * secToPx.value) / 10 + 5,
          barHeight.value,
        );
      } else if (x % 2 === 0) {
        ctx.beginPath();
        ctx.moveTo((x * secToPx.value) / 10, 0);
        ctx.lineTo(
          (x * secToPx.value) / 10,
          (barHeight.value * 2.0) / 5.0,
        );
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo((x * secToPx.value) / 10, 0);
        ctx.lineTo(
          (x * secToPx.value) / 10,
          (barHeight.value * 2.0) / 5.0,
        );
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}

function rerenderTimeline() {
  if (TimeCanvas1.value) {
    let ctx: CanvasRenderingContext2D | null = null;
    for (let i = 0; i < 3; i += 1) {
      switch (i) {
        case 0:
          ctx = TimeCanvas1.value.getContext("2d");
          TimeCanvas1.value.width = secToPx.value * secPerBar.value;
          TimeCanvas1.value.height = barHeight.value;
          break;

        case 1:
          ctx = TimeCanvas2.value!.getContext("2d");
          TimeCanvas2.value!.width = secToPx.value * secPerBar.value;
          TimeCanvas2.value!.height = barHeight.value;
          break;

        case 2:
          ctx = TimeCanvas3.value!.getContext("2d");
          TimeCanvas3.value!.width = secToPx.value * secPerBar.value;
          TimeCanvas3.value!.height = barHeight.value;
          break;

        default:
          ctx = null;
          break;
      }

      if (ctx) {
        renderCtx(ctx, i);
      }
    }
  }
}

function renderForward(): void {
  let ctx = TimeCanvas1.value!.getContext("2d");
  if (ctx) {
    TimeCanvas1.value!.width = secToPx.value * secPerBar.value;
    TimeCanvas1.value!.height = barHeight.value;
    ctx.drawImage(TimeCanvas2.value!, 0, 0);
  }

  ctx = TimeCanvas2.value!.getContext("2d");
  if (ctx) {
    TimeCanvas2.value!.width = secToPx.value * secPerBar.value;
    TimeCanvas2.value!.height = barHeight.value;
    ctx.drawImage(TimeCanvas3.value!, 0, 0);
  }

  ctx = TimeCanvas3.value!.getContext("2d");
  TimeCanvas3.value!.width = secToPx.value * secPerBar.value;
  TimeCanvas3.value!.height = barHeight.value;

  if (ctx) {
    renderCtx(ctx, 2);
  }
}

function renderBackward(): void {
  let ctx = TimeCanvas3.value!.getContext("2d");
  if (ctx) {
    TimeCanvas3.value!.width = secToPx.value * secPerBar.value;
    TimeCanvas3.value!.height = barHeight.value;
    ctx.drawImage(TimeCanvas2.value!, 0, 0);
  }

  ctx = TimeCanvas2.value!.getContext("2d");
  if (ctx) {
    TimeCanvas2.value!.width = secToPx.value * secPerBar.value;
    TimeCanvas2.value!.height = barHeight.value;
    ctx.drawImage(TimeCanvas1.value!, 0, 0);
  }

  ctx = TimeCanvas1.value!.getContext("2d");
  TimeCanvas1.value!.width = secToPx.value * secPerBar.value;
  TimeCanvas1.value!.height = barHeight.value;

  if (ctx) {
    renderCtx(ctx, 0);
  }
}

function reloadDisplayCards(): void {
  timecardIdx.value = [];
  for (let i = 0; i < entries.value.length; i += 1) {
    if (
      entries.value[i].Time + entries.value[i].Duration >
      (barCount.value + 3.0) * secPerBar.value * 1000
    ) {
      if (
        entries.value[i].Time <
        (barCount.value + 3.0) * secPerBar.value * 1000
      ) {
        timecardIdx.value.push(i);
      }
      break;
    } else if (
      entries.value[i].Time + entries.value[i].Duration >
      barCount.value * secPerBar.value * 1000
    ) {
      if (
        entries.value[i].Time >=
        barCount.value * secPerBar.value * 1000
      ) {
        timecardIdx.value.push(i);
      } else {
        timecardIdx.value.push(i);
      }
    }
  }
}

function rulerMouseLeave() {
  if (timelineActive.value) {
    logChange(entries.value[selectedEntry.value].id);
  }
  timelineActive.value = false;
}

function rulerMouseDown(event: any, idx: number, resizeSwitch: number) {
  if (!timelineActive.value) {
    selectedEntry.value = idx;
    timelineActive.value = true;
    xPos.value = event.clientX;
    resizeMode.value = resizeSwitch;
  }
}

function rulerMouseUp() {
  if (timelineActive.value) {
    logChange(entries.value[selectedEntry.value].id);
  }
  timelineActive.value = false;
}

function rulerMouseMove(event: any) {
  if (timelineActive.value) {
    switch (resizeMode.value) {
      case 0: {
        const xChange =
          ((event.clientX - xPos.value) / secToPx.value) * 1000;
        if (
          entries.value[selectedEntry.value].Duration - xChange <
          300
        ) {
          timelineActive.value = false;
          return;
        }

        if (
          entries.value[selectedEntry.value].Time + xChange <
          secPerBar.value * barCount.value * 1000
        ) {
          timelineActive.value = false;
          return;
        }

        if (selectedEntry.value > 0) {
          if (
            entries.value[selectedEntry.value].Time + xChange <
            entries.value[selectedEntry.value - 1].Time +
            entries.value[selectedEntry.value - 1].Duration
          ) {
            if (
              entries.value[selectedEntry.value - 1].Duration +
              xChange >
              300
            ) {
              entries.value[selectedEntry.value - 1].Duration =
                entries.value[selectedEntry.value - 1].Duration +
                xChange;
            } else {
              timelineActive.value = false;
              return;
            }
          }
        }

        entries.value[selectedEntry.value].Duration -= xChange;
        entries.value[selectedEntry.value].Time += xChange;
        break;
      }

      case 1: {
        const xChange =
          ((event.clientX - xPos.value) / secToPx.value) * 1000;
        if (
          entries.value[selectedEntry.value].Duration - xChange <
          300
        ) {
          timelineActive.value = false;
          return;
        }

        if (selectedEntry.value > 0) {
          if (
            entries.value[selectedEntry.value].Time + xChange <
            entries.value[selectedEntry.value - 1].Time +
            entries.value[selectedEntry.value - 1].Duration
          ) {
            if (
              entries.value[selectedEntry.value - 1].Duration +
              xChange >
              300
            ) {
              entries.value[selectedEntry.value - 1].Duration =
                entries.value[selectedEntry.value - 1].Duration +
                xChange;
            } else {
              timelineActive.value = false;
              return;
            }
          }
        }

        if (selectedEntry.value < entries.value.length - 1) {
          if (
            entries.value[selectedEntry.value].Time +
            entries.value[selectedEntry.value].Duration +
            xChange >
            entries.value[selectedEntry.value + 1].Time
          ) {
            if (
              entries.value[selectedEntry.value + 1].Duration -
              xChange >
              300
            ) {
              entries.value[selectedEntry.value + 1].Duration =
                entries.value[selectedEntry.value + 1].Duration -
                xChange;
              entries.value[selectedEntry.value + 1].Time =
                entries.value[selectedEntry.value].Time +
                entries.value[selectedEntry.value].Duration +
                xChange;
            } else {
              timelineActive.value = false;
              return;
            }
          }
        }

        if (entries.value[selectedEntry.value].Time + xChange > 0) {
          entries.value[selectedEntry.value].Time += xChange;
        } else {
          entries.value[selectedEntry.value].Time = 0;
        }
        break;
      }

      case 2: {
        const xChange =
          ((event.clientX - xPos.value) / secToPx.value) * 1000;
        if (
          entries.value[selectedEntry.value].Duration + xChange <
          300
        ) {
          timelineActive.value = false;
          return;
        }

        if (selectedEntry.value < entries.value.length - 1) {
          if (
            entries.value[selectedEntry.value].Time +
            entries.value[selectedEntry.value].Duration +
            xChange >
            entries.value[selectedEntry.value + 1].Time
          ) {
            if (
              entries.value[selectedEntry.value + 1].Duration -
              xChange >
              300
            ) {
              entries.value[selectedEntry.value + 1].Duration =
                entries.value[selectedEntry.value + 1].Duration -
                xChange;
              entries.value[selectedEntry.value + 1].Time =
                entries.value[selectedEntry.value].Time +
                entries.value[selectedEntry.value].Duration +
                xChange;
            } else {
              timelineActive.value = false;
              return;
            }
          }
        }

        entries.value[selectedEntry.value].Duration += xChange;
        break;
      }

      default:
        break;
    }
    xPos.value = event.clientX;
  }
}
//= ======================== TIMELINE CONTROLLER ========================

async function checkLoginValidity() {
  appStore.loginVerify({ bounceToLogin: true });
}

function modalNexusOutsideClick() {
  if (modalMode.value !== 5) {
    modalNexus.value = false;
  }
}

function processImportData(eventData: any) {
  const data = eventData;
  displayEntry.value = -1;
  timecardIdx.value = [];
  selectedEntry.value = -1;

  for (; entries.value.length > 0; ) {
    const tempEntries = entries.value.splice(0, 1)[0];
    let checkNew = transactionLog.value.filter(
      (e) => e.id === tempEntries.id,
    );
    if (checkNew.length === 0) {
      transactionLog.value.push({
        type: "Delete",
        id: tempEntries.id,
      });
    } else {
      checkNew = checkNew.filter((e) => e.type === "Change");
      if (checkNew.length === 0) {
        transactionLog.value = transactionLog.value.filter(
          (e) => e.id !== tempEntries.id,
        );
      } else {
        transactionLog.value = transactionLog.value.filter(
          (e) => e.id !== tempEntries.id,
        );
        transactionLog.value.push({
          type: "Delete",
          id: tempEntries.id,
        });
      }
    }
  }

  profile.value = [
    {
      Name: "Default",
      Prefix: "",
      Suffix: "",
      useCC: false,
      CC: "#000000",
      useOC: false,
      OC: "#000000",
    },
  ];

  for (let i = 1; data.profileData.length > 0; i += 1) {
    const dt = data.profileData.splice(0, 1)[0];
    dt.Name = `Profile${i.toString()}`;
    profile.value.push(dt);
  }

  for (let i = 0; data.entriesData.length > 0; i += 1) {
    const dt = data.entriesData.splice(0, 1)[0];
    dt.id = `I${i.toString()}`;
    dt.Profile += 1;
    entries.value.push(dt);
    transactionLog.value.push({
      type: "Add",
      id: dt.id,
    });
  }

  processLog(false);
  reloadDisplayCards();
}

function changeUsernameClick() {
  router.push({ path: "/user" });
}

async function settingOKClick() {
  if (!activeURLStream.value) return;
  activeURLInput.value = activeURLStream.value;
  let vidData: any = {
    id: "custom",
    custom_video_id: activeURLStream.value,
    start_actual: null,
    status: null,
    title: activeURLStream.value,
  };
  videoData.value = vidData;
  try {
    const parseVideoID = activeURLStream.value.match(VIDEO_URL_REGEX)
      ?.groups?.id;
    if (parseVideoID) {
      vidData = (
        await backendApi.video(parseVideoID, TLLang.value.value)
      ).data;
      if (vidData) {
        videoData.value = {
          id: parseVideoID,
          status: vidData.status,
          start_actual: !vidData.start_actual
            ? Date.parse(vidData.available_at)
            : Date.parse(vidData.start_actual),
          title: vidData.title,
        };
      }
    }
  } catch (e) {
    console.error(e);
  }

  timecardIdx.value = [];
  entries.value = [];
  let fetchChat = (
    await backendApi.chatHistory(vidData.id, {
      lang: TLLang.value.value,
      verified: 0,
      moderator: 0,
      vtuber: 0,
      limit: 100000,
      mode: 1,
      ...(userdata.value.user.role === "user" && {
        // users can only see their own.
        creator_id: userdata.value.user.id,
      }),
      ...(vidData.id === "custom" && {
        custom_video_id: activeURLStream.value,
      }),
    })
  ).data;

  fetchChat = fetchChat
    .filter(
      (e: any) =>
        !videoData.value?.start_actual ||
        e.timestamp >= videoData.value?.start_actual,
    )
    .map((e: any) => {
      const timestampShifted =
        e.timestamp -
        (videoData.value?.start_actual ||
          fetchChat[0].timestamp ||
          0);
      return { ...e, timestampShifted };
    });

  for (let i = 0; i < fetchChat.length; i += 1) {
    const dt = {
      id: fetchChat[i].id,
      Time: fetchChat[i].timestampShifted,
      realTime: +fetchChat[i].timestamp,
      SText: fetchChat[i].message,
      Profile: 0,
    };

    if (fetchChat[i].duration) {
      entries.value.push({
        ...dt,
        Duration: Number(fetchChat[i].duration),
      });
    } else if (i === fetchChat.length - 1) {
      entries.value.push({
        ...dt,
        Duration: 3000,
      });
    } else {
      entries.value.push({
        ...dt,
        Duration:
          fetchChat[i + 1].timestamp - fetchChat[i].timestamp,
      });
    }

    if (i === fetchChat.length - 1) {
      reloadDisplayCards();
    }
  }

  if (vidPlayer.value) {
    unloadVideo();
    setTimeout(() => {
      loadVideo();
    }, 1000);
  } else {
    loadVideo();
  }

  modalNexus.value = false;
}

function shiftTime() {
  const offset = Number.parseFloat(offsetInput.value as string);
  if (Number.isNaN(offset)) {
     
    alert("Invalid offset");
    return;
  }
  entries.value = entries.value.map((e) => ({
    ...e,
    Time: Math.max(e.Time + offset * 1000, 0),
    realTime: Math.max(
      Number.parseFloat(e.realTime) + offset * 1000,
      0,
    ),
  }));
  entries.value.forEach((e) => logChange(e.id));
  offsetInput.value = 0;
}

// Watchers
watch(
  () => route.query.video,
  () => {
    if (route.name === "scripteditor" && route.query.video) {
      init();
    }
  },
);

watch(timerTime, () => {
  scrollCalculator();

  if (timecardIdx.value.length === 0) {
    displayEntry.value = -1;
    return;
  }

  if (timerTime.value < entries.value[timecardIdx.value[0]].Time) {
    displayEntry.value = -1;
    return;
  }

  if (entries.value[displayEntry.value]) {
    if (
      timerTime.value > entries.value[displayEntry.value].Time &&
      entries.value[displayEntry.value].Time +
      entries.value[displayEntry.value].Duration >
      timerTime.value
    ) {
      return;
    }
  }

  for (let i = timecardIdx.value.length - 1; i >= 0; i -= 1) {
    if (timerTime.value > entries.value[timecardIdx.value[i]].Time) {
      displayEntry.value = timecardIdx.value[i];
      return;
    }
  }
});

// Lifecycle hooks
onMounted(() => {
  window.addEventListener("resize", onResize);
  init();
  loggerTimer.value = setInterval(() => {
    processLog(false);
  }, 15 * 1000);
});

onBeforeUnmount(() => {
  unloadVideo();
  window.removeEventListener("resize", onResize);
  if (loggerTimer.value) {
    clearInterval(loggerTimer.value);
  }
  processLog(true);
});
</script>

<style>
.tl-topbar > *:not(:first-child):not(:last-child) {
  margin: 0px 3px;
}
.tl-topbar > * {
  border-radius: 0px;
  text-transform: unset !important;
}
.TopMenu {
  width: 100%;
  position: absolute;
  top: 0px;
  left: 0px;
  z-index: 1;
}
.ColourButton {
  margin-top: 19px;
  margin-left: 5px;
}
.ProfileListCard {
  position: absolute;
  bottom: 5px;
  right: 5px;
}
.ChatPanelContainer {
  display: grid;
  grid-auto-flow: column;
}
.ControlBox {
  position: absolute;
  top: 5px;
  right: 5px;
  z-index: 1;
}
.Marker {
  position: absolute;
  left: calc(40% - 2px);
  top: 0px;
  width: 4px;
  height: 100%;
  z-index: 1;
  background-color: rgba(255, 0, 0, 0.7);
}
.TimelineContainer {
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  border-top: 2px solid white;
  padding-top: 7px;
  border-bottom: 2px solid white;
}
.TimelineInnerContainer.v-sheet.v-card {
  display: flex;
  flex-direction: row;
  margin-left: 40%;
  margin-bottom: 10px;
}
.Timecard.v-sheet.v-card {
  border: 2px solid white;
}
.TimecardText {
  width: 100%;
  cursor: grab;
  max-height: 3em;
}
</style>
