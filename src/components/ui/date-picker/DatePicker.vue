<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <button
        :class="cn(
          'inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-[color:var(--color-border)]',
          'bg-[color:var(--surface-soft)] text-sm text-[color:var(--color-foreground)]',
          'hover:bg-[color:var(--surface-elevated)] transition-colors cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring)]',
          !modelValue && 'text-[color:var(--color-muted-foreground)]',
        )"
        type="button"
      >
        <svg
          class="h-4 w-4 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
          <line x1="16" x2="16" y1="2" y2="6" />
          <line x1="8" x2="8" y1="2" y2="6" />
          <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
        <span>{{ displayValue }}</span>
      </button>
    </PopoverTrigger>

    <PopoverContent class-name="w-auto" :side-offset="6">
      <!-- Month/Year header -->
      <div class="flex items-center justify-between px-4 pt-3 pb-2">
        <button
          type="button"
          class="p-1 rounded-md hover:bg-[color:var(--surface-soft)] transition-colors"
          @click="prevMonth"
        >
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <span class="text-sm font-semibold select-none">{{ monthYearLabel }}</span>
        <button
          type="button"
          class="p-1 rounded-md hover:bg-[color:var(--surface-soft)] transition-colors"
          @click="nextMonth"
        >
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>

      <!-- Weekday labels -->
      <div class="grid grid-cols-7 px-3 pb-1">
        <div
          v-for="d in weekdays"
          :key="d"
          class="h-8 flex items-center justify-center text-xs text-[color:var(--color-muted-foreground)] font-medium"
        >
          {{ d }}
        </div>
      </div>

      <!-- Day grid -->
      <div class="grid grid-cols-7 px-3 pb-3 gap-y-0.5">
        <div
          v-for="(day, i) in calendarDays"
          :key="i"
          class="h-8 w-8 flex items-center justify-center text-sm rounded-md transition-colors"
          :class="getDayClass(day)"
          @click="day.date && selectDay(day.date)"
        >
          {{ day.label }}
        </div>
      </div>

      <!-- Clear button -->
      <div v-if="modelValue" class="px-3 pb-3 pt-0">
        <button
          type="button"
          class="w-full h-8 text-xs rounded-md border border-[color:var(--color-border)] hover:bg-[color:var(--surface-soft)] text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)] transition-colors"
          @click="clearDate"
        >
          Clear
        </button>
      </div>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import Popover from "@/components/ui/popover/Popover.vue";
import PopoverTrigger from "@/components/ui/popover/PopoverTrigger.vue";
import PopoverContent from "@/components/ui/popover/PopoverContent.vue";
import { cn } from "@/utils/functions";

const props = withDefaults(defineProps<{
  modelValue?: string; // ISO date string "YYYY-MM-DD" or ""
  placeholder?: string;
}>(), {
  modelValue: "",
  placeholder: "Pick a date",
});

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const open = ref(false);
const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// Cursor: year/month for the calendar view
const today = new Date();
const cursor = ref({
  year: today.getFullYear(),
  month: today.getMonth(), // 0-indexed
});

// When modelValue changes from outside, sync cursor to that month
watch(() => props.modelValue, (val) => {
  if (val) {
    const d = new Date(val + "T12:00:00");
    if (!isNaN(d.getTime())) {
      cursor.value = { year: d.getFullYear(), month: d.getMonth() };
    }
  }
}, { immediate: true });

const monthYearLabel = computed(() => {
  return new Date(cursor.value.year, cursor.value.month, 1)
    .toLocaleDateString(undefined, { month: "long", year: "numeric" });
});

const displayValue = computed(() => {
  if (!props.modelValue) return props.placeholder;
  const d = new Date(props.modelValue + "T12:00:00");
  if (isNaN(d.getTime())) return props.placeholder;
  return d.toLocaleDateString(undefined, { month: "2-digit", day: "2-digit", year: "numeric" });
});

interface CalendarDay {
  label: string;
  date: string | null; // ISO "YYYY-MM-DD"
  currentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}

const calendarDays = computed<CalendarDay[]>(() => {
  const { year, month } = cursor.value;
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = toISODate(today);
  const days: CalendarDay[] = [];

  // Leading empty cells
  for (let i = 0; i < firstDay; i++) {
    days.push({ label: "", date: null, currentMonth: false, isToday: false, isSelected: false });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toISODate(new Date(year, month, d));
    days.push({
      label: String(d),
      date: dateStr,
      currentMonth: true,
      isToday: dateStr === todayStr,
      isSelected: dateStr === props.modelValue,
    });
  }

  return days;
});

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDayClass(day: CalendarDay): string {
  if (!day.date) return "cursor-default";
  const base = "cursor-pointer select-none ";
  if (day.isSelected) return base + "bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)] font-semibold";
  if (day.isToday) return base + "border border-[color:var(--color-primary)] text-[color:var(--color-primary)] font-semibold hover:bg-[color:var(--surface-soft)]";
  return base + "hover:bg-[color:var(--surface-soft)]";
}

function prevMonth() {
  const { year, month } = cursor.value;
  if (month === 0) cursor.value = { year: year - 1, month: 11 };
  else cursor.value = { year, month: month - 1 };
}

function nextMonth() {
  const { year, month } = cursor.value;
  if (month === 11) cursor.value = { year: year + 1, month: 0 };
  else cursor.value = { year, month: month + 1 };
}

function selectDay(dateStr: string) {
  emit("update:modelValue", dateStr);
  open.value = false;
}

function clearDate() {
  emit("update:modelValue", "");
  open.value = false;
}
</script>
