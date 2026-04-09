<template>
  <UiCard class-name="p-4">
    <button
      type="button"
      class="flex w-full items-center justify-between text-left text-base font-medium text-white"
      @click="open = !open"
    >
      <span>Automated Comment Song Helper</span>
      <span class="text-slate-400">{{ open ? "−" : "+" }}</span>
    </button>

    <div v-if="open" class="mt-4">
      <h5 class="mb-3 text-sm font-semibold text-slate-200">
        1: Click on Searchable Component
      </h5>
      <div v-for="(timeframe,idx) in selection" :key="'s'+timeframe.index" class="mb-4">
        <div class="flex flex-wrap gap-2">
          <UiButton
            type="button"
            variant="outline"
            size="sm"
            @click="$emit('songSelected', timeframe)"
          >
            [{{ timeframe.start_human + (timeframe.end_time?'\t- '+timeframe.end_human : '\t- ?') }}]
          </UiButton>
          <UiButton
            v-for="(token,tokenidx) in timeframe.tokens"
            :key="'s'+timeframe.index+'t'+tokenidx"
            type="button"
            variant="secondary"
            size="sm"
            @click="tryLooking(timeframe,token, idx)"
          >
            {{ token }}
          </UiButton>
        </div>

        <div v-if="idx === searchResultIdx" class="mt-3">
          <div class="flex justify-end">
            <UiButton
              type="button"
              size="icon"
              variant="ghost"
              class-name="h-7 w-7"
              @click="searchResultIdx = -1"
            >
              <UiIcon :icon="icons.mdiClose" size="sm" />
            </UiButton>
          </div>

          <h5 class="rounded-lg bg-white/8 px-2 py-2 text-sm font-medium text-slate-200">
            Pick either iTunes result
          </h5>
          <div class="mt-2 space-y-2">
            <button
              v-for="x in searchResult"
              :key="'itn'+x.trackId"
              type="button"
              class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-white/8"
              @click="$emit('songSelected', timeframe, x)"
            >
              <img :src="x.artworkUrl100" alt="" class="h-12 w-12 rounded-md object-cover">
              <div class="min-w-0">
                <div class="truncate text-sm text-white">
                  🎵 {{ x.trackName }} [{{ formatDuration(x.trackTimeMillis) }}]
                </div>
                <div class="truncate text-xs text-slate-400">
                  🎤 {{ x.artistName }} / {{ x.collectionName }} / {{ x.releaseDate ? x.releaseDate.slice(0, 7) : "" }}
                </div>
              </div>
            </button>
          </div>

          <h5 class="mt-3 rounded-lg bg-white/8 px-2 py-2 text-sm font-medium text-slate-200">
            Or pick existing Musicdex Track:
          </h5>
          <div class="mt-2 space-y-2">
            <button
              v-for="(x,a) in searchResultMD"
              :key="'mdx'+x.trackId+'.'+a"
              type="button"
              class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-white/8"
              @click="$emit('songSelected', timeframe, x)"
            >
              <img :src="x.artworkUrl100" alt="" class="h-12 w-12 rounded-md object-cover">
              <div class="min-w-0">
                <div class="truncate text-sm text-white">
                  🎵 {{ x.trackName }} [{{ formatDuration(x.trackTimeMillis) }}]
                </div>
                <div class="truncate text-xs text-slate-400">
                  🎤 {{ x.artistName }}
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import jsonp from "jsonp-es6";
import { compareTwoStrings } from "string-similarity";
import { formatDuration } from "@/utils/time";
import { axiosInstance } from "@/utils/backend-api";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";

const TS_PARSING_REGEX = /(?<pre>.*?)(?:(?<s_h>[0-5]?[0-9]):)?(?<s_m>[0-5]?[0-9]):(?<s_s>[0-5][0-9])(?:(?<mid>.*?)(?:(?:(?<e_h>[0-5]?[0-9]):)?(?<e_m>[0-5]?[0-9]):(?<e_s>[0-5][0-9])))?(?<post>.*?)?$/gm;

function capgroupToSecs(h: string | undefined, m: string | undefined, s: string | undefined): number | undefined {
  if (!h && !m && !s) return undefined;
  return +(h || 0) * 3600 + +(m || 0) * 60 + +(s || 0);
}

const props = defineProps({
  comments: { type: Array, required: true },
});

defineEmits(["songSelected"]);

const open = ref(true);
const selection = ref<any[]>([]);
const searchResult = ref<any[]>([]);
const searchResultMD = ref<any[]>([]);
const searchResultIdx = ref(-1);
async function getAutocomplete(query: string) {
  const res = await searchAutocompleteAlternative(query, "JP");
  const resEn = await searchAutocompleteAlternative(query, "US");
  const lookupEn = resEn.results || [];
  const fnLookupFn = (id: any, name: string, altName?: string) => {
    const foundEn = lookupEn.find((x: any) => x.trackId === id);
    if (!foundEn) return altName || name;
    const possibleNames = [foundEn.trackCensoredName?.toUpperCase(), foundEn.trackName.toUpperCase()];
    if (foundEn && !possibleNames.includes(name.toUpperCase()) && compareTwoStrings(foundEn.trackName, name) < 0.75) {
      return `${name} / ${foundEn.trackCensoredName || foundEn.trackName}`;
    }
    return altName || name;
  };
  if (res && res.results) {
    return res.results.map(({ trackId, collectionName, releaseDate, artistName, trackName, trackCensoredName, trackTimeMillis, artworkUrl100, trackViewUrl }: any) => ({
      trackId,
      trackTimeMillis,
      collectionName,
      releaseDate,
      artistName,
      trackName: fnLookupFn(trackId, trackName, trackCensoredName),
      artworkUrl100,
      trackViewUrl,
    }));
  }
  return [];
}

async function searchMusicdex(query: string) {
  try {
    const resp = await axiosInstance({
      url: "/musicdex/elasticsearch/search",
      method: "POST",
      headers: {
        "Content-Type": "application/x-ndjson",
        Accept: "application/json, text/plain, */*",
      },
      data:
        `{"preference":"results"}\n${JSON.stringify({
          query: {
            bool: {
              must: [{
                bool: {
                  must: [
                    {
                      multi_match: {
                        query,
                        fields: ["general^3", "general.romaji^0.5", "original_artist^2", "original_artist.romaji^0.5"],
                        type: "most_fields",
                      },
                    },
                    {
                      multi_match: {
                        query,
                        fields: ["name.ngram", "name"],
                        type: "most_fields",
                      },
                    },
                  ],
                },
              }],
            },
          },
          size: 12,
          _source: { includes: ["*"], excludes: [] },
          from: 0,
          sort: [{ _score: { order: "desc" } }],
        })}\n`,
    });
    return (resp?.data?.responses?.[0]?.hits?.hits?.map(({ _source }: any) => ({
      trackId: _source.itunesid,
      artistName: _source.original_artist,
      trackName: _source.name,
      trackTimeMillis: (_source.end - _source.start) * 1000,
      trackViewUrl: _source.amUrl,
      artworkUrl100: _source.art,
      src: "Musicdex",
    })) || []);
  } catch (e) {
    console.error(e);
    return [];
  }
}

async function searchAutocompleteAlternative(query: string, country = "JP") {
  return jsonp("https://itunes.apple.com/search", {
    term: query,
    entity: "musicTrack",
    country,
    limit: 12,
  });
}

async function tryLooking(timeframe: any, token: string, idx: number) {
  searchResultIdx.value = idx;
  searchResult.value = await getAutocomplete(token);
  searchResultMD.value = await searchMusicdex(token);
}

onMounted(async () => {
  if (props.comments && (props.comments as any[]).length > 0) {
    const chosen = (props.comments as any[]).map(({ comment_key, message }: any) => {
      const groups = message.match(TS_PARSING_REGEX);
      return { comment_key, message, sz: groups.length };
    }).sort((a: any, b: any) => b.sz - a.sz)[0];

    if (chosen.sz === 0) return;
    const match = [...chosen.message.matchAll(TS_PARSING_REGEX)];
    selection.value = match.map(({ index, groups: g }: any) => ({
      index,
      start_human: `${g.s_h ? `${g.s_h}:` : ""}${g.s_m}:${g.s_s}`,
      start_time: capgroupToSecs(g.s_h, g.s_m, g.s_s),
      end_human: `${g.e_h ? `${g.e_h}:` : ""}${g.e_m}:${g.e_s}`,
      end_time: capgroupToSecs(g.e_h, g.e_m, g.e_s),
      tokens: [g.pre, g.mid, g.post].join(" / ").split(/[|\-/.()]|by/).map((a: string) => a.trim()).filter((a: string) => a.length > 0),
    }));
  }
});
</script>
