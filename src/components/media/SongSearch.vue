<template>
  <div ref="root" class="relative">
    <div class="rounded-[calc(var(--radius)+4px)] border border-white/10 bg-white/6 p-2 shadow-xl shadow-slate-950/20">
      <div v-if="query" class="mb-2 flex items-center gap-3 rounded-xl border border-white/10 bg-white/6 px-3 py-2">
        <img
          v-if="query.artworkUrl100"
          :src="query.artworkUrl100"
          class="h-12 w-12 rounded-lg object-cover"
          alt=""
        >
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm text-[color:var(--color-foreground)]">
            🎵 {{ query.trackName }} [{{ formatDuration(query.trackTimeMillis) }}]
          </div>
          <div class="truncate text-xs text-[color:var(--color-muted-foreground)]">
            🎤 {{ query.artistName }}{{ query.collectionName ? ` / ${query.collectionName}` : "" }}
          </div>
        </div>
        <button type="button" class="text-[color:var(--color-primary)]" @click="clearSelection">
          <UiIcon :icon="icons.mdiClose" class-name="h-4 w-4" />
        </button>
      </div>

      <UiInput
        v-model="search"
        :autofocus="autofocus"
        :placeholder="$t('editor.music.itunesLookupPlaceholder')"
        class-name="border-0 bg-transparent shadow-none focus:ring-0"
        @focus="openMenu = true"
        @keydown.enter.prevent="onEnterKeyDown"
        @compositionstart="onCompositionStart"
        @compositionend="onCompositionEnd"
      />
    </div>

    <div
      v-if="openMenu && results.length"
      class="absolute inset-x-0 top-[calc(100%+0.35rem)] z-30 overflow-hidden rounded-[calc(var(--radius)+4px)] border border-white/10 bg-slate-950/96 shadow-2xl shadow-slate-950/40"
    >
      <button
        v-for="item in results"
        :key="item.index"
        type="button"
        class="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/6"
        @click="selectItem(item)"
      >
        <img
          v-if="item.artworkUrl100"
          :src="item.artworkUrl100"
          class="h-12 w-12 rounded-lg object-cover"
          alt=""
        >
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm text-[color:var(--color-foreground)]">
            🎵 {{ item.trackName }} [{{ formatDuration(item.trackTimeMillis) }}]
          </div>
          <div class="truncate text-xs text-[color:var(--color-muted-foreground)]">
            🎤 {{ item.artistName }}{{ item.collectionName ? ` / ${item.collectionName}` : "" }}
            {{ item.releaseDate ? ` / ${item.releaseDate.slice(0, 7)}` : "" }}
            <span class="ml-1 rounded-full border border-white/10 px-1.5 py-0.5 text-[10px] uppercase opacity-60">{{ item.src }}</span>
          </div>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import debounce from "lodash-es/debounce";
import jsonp from "jsonp-es6";
import { formatDuration } from "@/utils/time";
import { compareTwoStrings } from "string-similarity";
import { axiosInstance } from "@/utils/backend-api";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiInput from "@/components/ui/input/Input.vue";

const props = defineProps({
  autofocus: {
    type: Boolean,
    default: false,
  },
  value: {
    type: Object,
    default: null,
  },
  id: {
    type: Number,
    default: null,
  },
});

const emit = defineEmits(["input"]);

const root = ref<HTMLElement | null>(null);
const query = ref<any>(props.value);
const isLoading = ref(false);
const search = ref("");
const fromApi = ref<any[]>([]);
const isComposing = ref(false);
const openMenu = ref(false);

const results = computed(() =>
  fromApi.value.concat(query.value ? [query.value] : [])
);

function handleOutsideClick(event: MouseEvent) {
  if (!root.value?.contains(event.target as Node)) {
    openMenu.value = false;
  }
}

function clearSelection() {
  query.value = null;
  emit("input", null);
}

function selectItem(item: any) {
  query.value = item;
  search.value = "";
  fromApi.value = [];
  openMenu.value = false;
}

function onCompositionStart() {
  isComposing.value = true;
}

function onCompositionEnd() {
  isComposing.value = false;
  performSearch(search.value);
}

function performSearch(val: string) {
  if (!val) return;
  openMenu.value = true;
  fromApi.value = [];
  const entropy = encodeURIComponent(val).length;
  if (entropy <= 2) return;
  getAutocomplete(val);
}

const debouncedSearch = debounce((val: string) => {
  if (isComposing.value) return;
  performSearch(val);
}, 500);

watch(search, (val) => debouncedSearch(val));

watch(query, () => {
  if (query.value) emit("input", query.value);
});

watch(() => props.value, (next) => {
  query.value = next;
});

async function getAutocomplete(queryStr: string) {
  isLoading.value = true;
  const [md, res, resEn] = await Promise.all([
    searchMusicdex(queryStr),
    searchRegionsAlternative(queryStr, "JP"),
    searchRegionsAlternative(queryStr, "US"),
  ]);
  const lookupEn = resEn || [];
  const fnLookupFn = (id: any, name: string, altName?: string) => {
    const foundEn = lookupEn.find((x: any) => x.trackId === id);
    if (!foundEn) return altName || name;
    const possibleNames = [
      foundEn.trackCensoredName?.toUpperCase(),
      foundEn.trackName.toUpperCase(),
    ];
    if (
      foundEn
      && !possibleNames.includes(name.toUpperCase())
      && compareTwoStrings(foundEn.trackName, name) < 0.75
    ) {
      return `${name} / ${foundEn.trackCensoredName || foundEn.trackName}`;
    }
    return altName || name;
  };
  if (res) {
    fromApi.value = [
      ...md.slice(0, 3),
      ...res.map(
        ({
          trackId,
          collectionName,
          releaseDate,
          artistName,
          trackName,
          trackCensoredName,
          trackTimeMillis,
          artworkUrl100,
          trackViewUrl,
        }: any) => ({
          trackId,
          trackTimeMillis,
          collectionName,
          releaseDate,
          artistName,
          trackName: fnLookupFn(trackId, trackName, trackCensoredName),
          artworkUrl100,
          trackViewUrl,
          src: "iTunes",
          index: `iTunes${trackId}`,
        }),
      ),
    ];
  }
  isLoading.value = false;
  return res;
}

async function searchAutocomplete(queryStr: string, lang = "ja_jp", country = "JP") {
  return jsonp("https://itunes.apple.com/search", {
    term: queryStr,
    entity: "musicTrack",
    country,
    limit: 10,
    lang,
  });
}

async function searchRegionsAlternative(queryStr: string, lang = "JP", regions: string[] = ["ja_jp", "en_us"]) {
  const regionSongs: any[] = [];
  const parsedIDs: any[] = [];
  for (const r of regions) {
    const queryed = await searchAutocomplete(queryStr, r, lang);
    const currentSongs = queryed.results || [];
    for (const song of currentSongs) {
      if (!parsedIDs.includes(song.trackId)) {
        parsedIDs.push(song.trackId);
        regionSongs.push(song);
      }
    }
  }
  return regionSongs;
}

async function searchMusicdex(queryStr: string) {
  try {
    const resp = await axiosInstance({
      url: "/musicdex/elasticsearch/search",
      method: "POST",
      headers: {
        "Content-Type": "application/x-ndjson",
        Accept: "application/json, text/plain, */*",
      },
      data:
        `{"preference":"results"}\n${
          JSON.stringify({
            query: {
              bool: {
                must: [
                  {
                    bool: {
                      must: [
                        {
                          multi_match: {
                            query: queryStr,
                            fields: [
                              "general^3",
                              "general.romaji^0.5",
                              "original_artist^2",
                              "original_artist.romaji^0.5",
                            ],
                            type: "most_fields",
                          },
                        },
                        {
                          multi_match: {
                            query: queryStr,
                            fields: [
                              "name.ngram",
                              "name",
                            ],
                            type: "most_fields",
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
            size: 12,
            _source: { includes: ["*"], excludes: [] },
            from: 0,
            sort: [{ _score: { order: "desc" } }],
          })}\n`,
    });
    return (
      resp?.data?.responses?.[0]?.hits?.hits?.map(({ _source }: any) => ({
        trackId: _source.itunesid,
        artistName: _source.original_artist,
        trackName: _source.name,
        trackTimeMillis: (_source.end - _source.start) * 1000,
        trackViewUrl: _source.amUrl,
        artworkUrl100: _source.art,
        src: "Musicdex",
        index: `Musicdex${_source.itunesid || _source.name + _source.original_artist}`,
      })) || []
    );
  } catch (e) {
    console.error(e);
    return [];
  }
}

function onEnterKeyDown() {
  if (search.value?.length) {
    const [first] = results.value;
    if (first) selectItem(first);
  }
}

onMounted(() => {
  document.addEventListener("click", handleOutsideClick);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleOutsideClick);
});
</script>
