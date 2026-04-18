<template>
  <div v-if="showTopBar" ref="navRootEl" class="fixed inset-x-0 top-0 z-[90]">
    <header ref="navHeaderEl" class="relative z-[130] border-b border-[color:var(--color-border)] bg-[color:var(--surface-nav)] backdrop-blur-xl">
      <div class="mx-auto flex max-w-[1600px] items-center gap-4 px-3 py-3 sm:px-5">
        <a
          href="/"
          class="flex shrink-0 items-center gap-3 pr-2 min-[960px]:pr-5 text-left no-underline select-none"
          @click.prevent="goHomeFromLogo"
        >
          <div class="menu-logo-tile flex h-10 w-10 items-center justify-center rounded-2xl border">
            <Logo width="22" height="22" />
          </div>
          <div class="hidden min-w-0 sm:block text-[1.02rem] font-semibold tracking-[0.01em] text-[color:var(--color-foreground)]">
            Holodex
          </div>
        </a>

        <div class="hidden min-[960px]:ml-1 min-[960px]:flex min-[960px]:items-center min-[960px]:gap-3">
          <router-link
            v-for="page in primaryPages"
            :key="page.name"
            :to="page.path"
            class="rounded-full px-3 py-2 text-sm text-[color:var(--color-muted-foreground)] transition hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--color-foreground)]"
            :class="{ 'bg-[color:var(--surface-soft)] text-[color:var(--color-foreground)]': isActivePage(page) }"
          >
            {{ page.name }}
          </router-link>
        </div>

        <div class="hidden min-w-0 flex-1 items-center gap-3 min-[960px]:flex">
          <HomeOrgMultiSelect
            inline
            button-class="h-10 w-auto min-w-0 max-w-[min(36vw,24rem)] shrink justify-between rounded-xl px-3 text-[0.8rem] font-normal"
          />

          <form class="menu-search-form" @submit.prevent="submitSearch">
            <div class="relative min-w-0 flex-1">
              <div class="menu-search-tags-wrap">
                <span
                  v-for="(f, fi) in searchFilters"
                  :key="fi"
                  class="menu-search-filter-tag"
                  :class="'menu-search-filter-tag--' + f.type"
                >
                  <svg v-if="f.type === 'channel'" viewBox="0 0 24 24" class="menu-search-filter-tag-icon fill-current"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z" /></svg>
                  <svg v-else-if="f.type === 'topic'" viewBox="0 0 24 24" class="menu-search-filter-tag-icon fill-current"><path d="M5.41 21L6.12 17H2.12L2.47 15H6.47L7.53 9H3.53L3.88 7H7.88L8.59 3H10.59L9.88 7H15.88L16.59 3H18.59L17.88 7H21.88L21.53 9H17.53L16.47 15H20.47L20.12 17H16.12L15.41 21H13.41L14.12 17H8.12L7.41 21H5.41M9.53 9L8.47 15H14.47L15.53 9H9.53Z" /></svg>
                  <svg v-else-if="f.type === 'org'" viewBox="0 0 24 24" class="menu-search-filter-tag-icon fill-current"><path d="M18 15H16V17H18M18 11H16V13H18M20 19H12V17H14V15H12V13H14V11H12V9H20M10 7H8V5H10M10 11H8V9H10M10 15H8V13H10M10 19H8V17H10M6 7H4V5H6M6 11H4V9H6M6 15H4V13H6M6 19H4V17H6M12 7V3H2V21H22V7H12Z" /></svg>
                  <span class="menu-search-filter-tag-text">{{ f.text || f.value }}</span>
                  <button type="button" class="menu-search-filter-tag-remove" @click.prevent="removeSearchFilter(fi)">×</button>
                </span>
                <input
                  ref="desktopSearchInput"
                  v-model="searchText"
                  class="menu-search-tags-input"
                  :placeholder="searchFilters.length ? '' : 'Search streams, clips, channels'"
                  autocomplete="off"
                  @focus="autocompleteOpen = true"
                  @blur="onSearchBlur"
                  @keydown.backspace="handleSearchBackspace"
                >
              </div>
              <button
                type="button"
                class="menu-search-inline-btn"
                @click="submitSearch(true)"
              >
                <UiIcon :icon="mdiMagnify" class-name="menu-theme-icon h-4 w-4" />
                <span class="sr-only">Search</span>
              </button>
              <!-- Autocomplete dropdown -->
              <div v-if="autocompleteOpen && autocompleteResults.length" class="menu-autocomplete-dropdown">
                <button
                  v-for="item in autocompleteResults"
                  :key="item.value"
                  type="button"
                  class="menu-autocomplete-item"
                  @mousedown.prevent="selectAutocomplete(item)"
                >
                  <svg v-if="item.type === 'channel'" viewBox="0 0 24 24" class="menu-autocomplete-icon fill-current">
                    <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z" />
                  </svg>
                  <svg v-else-if="item.type === 'topic'" viewBox="0 0 24 24" class="menu-autocomplete-icon fill-current">
                    <path d="M5.41 21L6.12 17H2.12L2.47 15H6.47L7.53 9H3.53L3.88 7H7.88L8.59 3H10.59L9.88 7H15.88L16.59 3H18.59L17.88 7H21.88L21.53 9H17.53L16.47 15H20.47L20.12 17H16.12L15.41 21H13.41L14.12 17H8.12L7.41 21H5.41M9.53 9L8.47 15H14.47L15.53 9H9.53Z" />
                  </svg>
                  <svg v-else-if="item.type === 'org'" viewBox="0 0 24 24" class="menu-autocomplete-icon fill-current">
                    <path d="M18 15H16V17H18M18 11H16V13H18M20 19H12V17H14V15H12V13H14V11H12V9H20M10 7H8V5H10M10 11H8V9H10M10 15H8V13H10M10 19H8V17H10M6 7H4V5H6M6 11H4V9H6M6 15H4V13H6M6 19H4V17H6M12 7V3H2V21H22V7H12Z" />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" class="menu-autocomplete-icon fill-current">
                    <path d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27H15l5 5-1.5 1.5-5-5v-.79l-.27-.27A6.516 6.516 0 0 1 9.5 16 6.5 6.5 0 0 1 3 9.5 6.5 6.5 0 0 1 9.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14 14 12 14 9.5 12 5 9.5 5z" />
                  </svg>
                  <span class="menu-autocomplete-text">{{ item.text || item.value }}</span>
                  <span class="menu-autocomplete-type">{{ item.type === 'org' ? 'group' : item.type }}</span>
                </button>
              </div>
            </div>
          </form>

          <div class="flex items-center gap-2">
            <UiButton
              as="a"
              variant="ghost"
              size="icon"
              class-name="menu-action-btn"
              :href="musicdexURL"
              target="_blank"
              rel="noopener noreferrer"
              title="Musicdex"
            >
              <svg viewBox="0 0 24 24" class="h-5 w-5" aria-hidden="true">
                <defs>
                  <linearGradient
                    id="musicdex-nav-gradient"
                    x1="3"
                    y1="2"
                    x2="21"
                    y2="20"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stop-color="#5DA2F2" />
                    <stop offset="0.55" stop-color="#F06292" />
                    <stop offset="1" stop-color="#FF3A81" />
                  </linearGradient>
                </defs>
                <path
                  fill="url(#musicdex-nav-gradient)"
                  d="M12 3V13.55A4 4 0 1 0 14 17V7H19V3H12Z"
                />
              </svg>
              <span class="sr-only">Musicdex</span>
            </UiButton>

            <UiButton
              as="router-link"
              variant="ghost"
              size="icon"
              to="/multiview"
              class-name="menu-action-btn"
              :title="$t('component.mainNav.multiview')"
            >
              <svg viewBox="0 0 24 24" class="menu-theme-icon h-5 w-5 fill-current" aria-hidden="true">
                <path d="M13,3V9H21V3M13,21H21V11H13M3,21H11V15H3M3,13H11V3H3V13Z" />
              </svg>
              <span class="sr-only">{{ $t("component.mainNav.multiview") }}</span>
            </UiButton>

            <UiPopover v-model:open="playlistMenuOpen">
              <UiPopoverTrigger as-child>
                <UiButton
                  type="button"
                  variant="ghost"
                  size="icon"
                  class-name="group relative menu-action-btn"
                  :title="$t('component.mainNav.playlist')"
                >
                  <UiIcon :icon="mdiPlaylistPlay" class-name="menu-theme-icon h-5.5 w-5.5" />
                  <UiBadge
                    v-if="playlistCount"
                    class-name="playlist-count-badge absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center px-1.5 text-[10px] leading-none tracking-normal"
                  >
                    {{ playlistCount }}
                  </UiBadge>
                  <span class="sr-only">{{ $t("component.mainNav.playlist") }}</span>
                </UiButton>
              </UiPopoverTrigger>

              <UiPopoverContent align="end" class-name="w-[24rem] max-h-[min(80vh,640px)] flex flex-col overflow-hidden p-0" @pointerdown="dismissRenameOnOutsideClick">
                <!-- Header: name+count left, action buttons right -->
                <div class="flex items-center gap-2 border-b border-[color:var(--color-border)] px-3 py-2.5">
                  <div class="flex min-w-0 shrink flex-col gap-1.5">
                    <UiInput
                      v-if="playlistEditName"
                      ref="nameInputEl"
                      v-model="playlistName"
                      class-name="h-7 max-w-[10rem] rounded-md border-[color:var(--color-border)] bg-[color:var(--surface-soft)] px-1 py-0 text-sm font-semibold focus:shadow-[none]"
                      @keydown.enter="($event.target as HTMLElement).blur()"
                      @keydown.escape="($event.target as HTMLElement).blur()"
                      @blur="playlistEditName = false"
                    />
                    <button
                      v-else
                      type="button"
                      tabindex="-1"
                      class="group/name inline-flex h-7 items-center gap-1 rounded-md px-1 text-left outline-none transition-colors hover:bg-[color:var(--surface-soft)]"
                      :title="$t('component.playlist.menu.rename-playlist')"
                      @click="playlistEditName = true"
                    >
                      <span class="max-w-[10rem] truncate text-sm font-semibold text-[color:var(--color-foreground)]">
                        {{ playlistStore.active?.name || 'Unnamed Playlist' }}
                      </span>
                      <svg class="h-3 w-3 shrink-0 text-[color:var(--color-muted-foreground)] opacity-0 transition-opacity group-hover/name:opacity-100" viewBox="0 0 24 24"><path fill="currentColor" :d="mdiPencil" /></svg>
                    </button>
                    <div class="flex items-center gap-1.5 px-1 text-xs leading-none text-[color:var(--color-muted-foreground)]">
                      <UiBadge
                        v-if="!playlistStore.isSaved"
                        class-name="inline-flex items-center rounded-full border-amber-400/30 bg-amber-400/15 px-1.5 py-0.5 text-[10px] leading-none text-amber-200"
                      >unsaved</UiBadge>
                      <span class="leading-none">{{ playlistCount }}/{{ MAX_PLAYLIST_LENGTH }}</span>
                    </div>
                  </div>
                  <div class="ml-auto flex shrink-0 items-center gap-1">
                    <button
                      v-if="!playlistStore.isSaved"
                      type="button"
                      class="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-white transition-colors hover:bg-emerald-500"
                      title="Save"
                      @click="saveActivePlaylist"
                    >
                      <UiIcon :icon="mdiContentSave" class-name="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      class="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--color-muted-foreground)] transition-colors hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--color-foreground)] disabled:pointer-events-none disabled:opacity-40"
                      :title="$t('component.playlist.menu.new-playlist')"
                      @click="createNewPlaylist"
                    >
                      <UiIcon :icon="mdiPlaylistPlus" class-name="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      class="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--color-muted-foreground)] transition-colors hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--color-foreground)] disabled:pointer-events-none disabled:opacity-40"
                      :disabled="playlistStore.isSaved || !playlistStore.active?.id"
                      :title="$t('component.playlist.menu.reset-unsaved')"
                      @click="playlistStore.setActivePlaylistByID(playlistStore.active!.id!)"
                    >
                      <UiIcon :icon="mdiRefresh" class-name="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      class="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--color-muted-foreground)] transition-colors hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--color-foreground)] disabled:pointer-events-none disabled:opacity-40"
                      :disabled="!playlistCount"
                      :title="$t('views.library.exportYtPlaylist')"
                      @click="playlistYTDialog = true; playlistMenuOpen = false"
                    >
                      <UiIcon :icon="icons.mdiYoutube" class-name="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      class="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--color-muted-foreground)] transition-colors hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--color-foreground)] disabled:pointer-events-none disabled:opacity-40"
                      :disabled="!playlistCount"
                      :title="$t('views.library.exportCsv')"
                      @click="downloadPlaylistCSV"
                    >
                      <UiIcon :icon="mdiFileDelimited" class-name="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      class="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--color-muted-foreground)] transition-colors hover:bg-rose-500/15 hover:text-rose-400"
                      :title="playlistStore.active?.id ? $t('component.playlist.menu.delete-playlist') : $t('component.playlist.menu.clear-playlist')"
                      @click="deleteActivePlaylist"
                    >
                      <UiIcon :icon="mdiDelete" class-name="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <!-- Login warning -->
                <div
                  v-if="playlistLoginWarning"
                  class="mx-3 mt-2 flex items-center gap-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
                >
                  <span class="flex-1">{{ $t("component.playlist.save-error-not-logged-in") }}</span>
                  <UiButton
                    type="button"
                    variant="destructive"
                    size="sm"
                    class-name="h-6 text-xs"
                    @click="router.push('/user'); playlistLoginWarning = false; playlistMenuOpen = false"
                  >
                    {{ $t("component.mainNav.login") }}
                  </UiButton>
                </div>

                <!-- Video list (scrollable, drag-to-reorder) -->
                <UiScrollArea v-if="playlistCount" class-name="min-h-0 flex-1">
                  <div class="flex flex-col gap-0.5 p-1.5">
                    <div
                      v-for="(video, idx) in playlistVideos"
                      :key="video.id"
                      data-drag-item
                      class="group relative flex items-center gap-2.5 rounded-md p-1.5 transition-colors select-none hover:bg-[color:var(--surface-soft)]"
                      :class="{
                        'opacity-30': dragFromIdx === idx,
                        'cursor-grabbing': dragFromIdx !== null,
                        'cursor-grab': dragFromIdx === null
                      }"
                      @pointerdown="handlePointerDown(idx, $event)"
                      @dragstart.prevent
                    >
                      <!-- Drop indicator line -->
                      <div
                        v-if="dragOverIdx === idx && dragFromIdx !== null && dragFromIdx !== idx"
                        class="pointer-events-none absolute left-2 right-2 h-0.5 rounded-full bg-[color:var(--color-primary)]"
                        :class="dragOverPosition === 'above' ? '-top-px' : '-bottom-px'"
                      />
                      <router-link
                        :to="`/watch/${video.id}?playlist=${playlistStore.active?.id || 'local'}`"
                        class="relative shrink-0 overflow-hidden rounded-md"
                        @click="playlistMenuOpen = false"
                      >
                        <img
                          :src="getVideoThumbUrl(video.id)"
                          :alt="video.title"
                          class="h-[3.2rem] w-[5.7rem] object-cover"
                          loading="lazy"
                        >
                      </router-link>
                      <div class="min-w-0 flex-1">
                        <router-link
                          :to="`/watch/${video.id}?playlist=${playlistStore.active?.id || 'local'}`"
                          class="line-clamp-2 text-xs font-medium leading-snug text-[color:var(--color-foreground)] hover:underline"
                          @click="playlistMenuOpen = false"
                        >
                          {{ video.title || video.id }}
                        </router-link>
                        <span v-if="video.channel?.name" class="mt-0.5 block truncate text-[11px] text-[color:var(--color-muted-foreground)]">
                          {{ video.channel.english_name || video.channel.name }}
                        </span>
                      </div>
                      <button
                        type="button"
                        class="flex h-6 w-6 shrink-0 items-center justify-center self-center rounded-md text-[color:var(--color-muted-foreground)] opacity-0 transition hover:bg-rose-500/15 hover:text-rose-400 group-hover:opacity-100"
                        :title="$t('component.videoCard.removeFromPlaylist')"
                        @click.stop="playlistStore.removeVideoByIndex(idx)"
                      >
                        <UiIcon :icon="mdiClose" class-name="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </UiScrollArea>
                <div v-else class="px-3 py-8 text-center text-xs text-[color:var(--color-muted-foreground)]">
                  {{ $t("views.playlist.page-instruction") }}
                </div>

                <!-- Saved playlists -->
                <template v-if="serverPlaylists.length > 0">
                  <div class="border-t border-[color:var(--color-border)] px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-widest text-[color:var(--color-muted-foreground)]">
                    {{ $t("views.playlist.page-heading") }}
                  </div>
                  <UiScrollArea class-name="max-h-[160px]">
                    <div class="px-1 pb-1">
                      <button
                        v-for="pl in serverPlaylists"
                        :key="pl.id"
                        type="button"
                        class="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-[color:var(--surface-soft)]"
                        :class="pl.id === playlistStore.active?.id ? 'text-[color:var(--color-primary)] font-medium' : 'text-[color:var(--color-foreground)]'"
                        @click="switchPlaylist(pl)"
                      >
                        <UiIcon
                          v-if="pl.id === playlistStore.active?.id"
                          :icon="mdiCheck"
                          size="sm"
                          class-name="h-4 w-4 shrink-0"
                        />
                        <span v-else class="h-4 w-4 shrink-0" />
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-1.5">
                            <span class="truncate text-[13px]">{{ pl.name }}</span>
                            <UiBadge
                              v-if="pl.id === playlistStore.active?.id && !playlistStore.isSaved"
                              class-name="shrink-0 rounded-full border-amber-400/30 bg-amber-400/15 px-1.5 py-px text-[9px] text-amber-200"
                            >{{ $t("views.playlist.playlist-is-modified") }}</UiBadge>
                          </div>
                          <span class="block text-[10px] text-[color:var(--color-muted-foreground)]">
                            {{ (pl.video_ids || pl.videos || []).length }} videos
                            <template v-if="pl.updated_at"> · {{ formatPlaylistTime(pl.updated_at) }}</template>
                          </span>
                        </div>
                      </button>
                    </div>
                  </UiScrollArea>
                </template>

                
              </UiPopoverContent>
            </UiPopover>

            <!-- YouTube export instructions dialog -->
            <UiDialog
              :open="playlistYTDialog"
              class-name="max-w-[90%] md:max-w-[60vw]"
              @update:open="playlistYTDialog = $event"
            >
              <UiCard class-name="p-5">
                <div class="text-lg font-semibold text-[color:var(--color-foreground)]">
                  {{ $t("views.library.exportYTHeading") }}
                </div>
                <div class="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
                  <div class="text-sm text-[color:var(--color-muted-foreground)]">
                    <p v-html="$t('views.library.exportYTExplanation')" />
                    <br>
                    <p v-html="$t('views.library.exportYTInstructions')" />
                    <div class="mt-4 flex flex-wrap gap-2">
                      <UiButton type="button" class-name="bg-emerald-600 text-white hover:brightness-110" @click="exportPlaylistToYT">
                        {{ $t("views.library.createYtPlaylistButton", [playlistCount]) }}
                      </UiButton>
                      <UiButton type="button" variant="ghost" @click="playlistYTDialog = false">
                        {{ $t("views.library.deleteConfirmationCancel") }}
                      </UiButton>
                    </div>
                  </div>
                  <img src="/img/playlist-instruction.jpg" alt="Playlist export instructions" class="max-w-full rounded-xl">
                </div>
              </UiCard>
            </UiDialog>

            <NavSettingsMenu />

            <NavUserMenu />
          </div>
        </div>

        <UiButton
          class-name="ml-auto min-[960px]:hidden menu-action-btn"
          variant="ghost"
          size="icon"
          @click="mobileSearchOpen = !mobileSearchOpen"
        >
          <span class="sr-only">Toggle search</span>
          <svg viewBox="0 0 24 24" class="menu-theme-icon h-4 w-4 fill-current">
            <path d="M10 2a8 8 0 1 0 5.293 14.01l4.349 4.348 1.414-1.414-4.348-4.349A8 8 0 0 0 10 2zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12z" />
          </svg>
        </UiButton>

        <!-- Mobile direct icon buttons for extra pages (multiview, musicdex) -->
        <UiButton
          as="router-link"
          to="/multiview"
          class-name="min-[960px]:hidden menu-action-btn"
          variant="ghost"
          size="icon"
          :title="$t('component.mainNav.multiview')"
        >
          <svg viewBox="0 0 24 24" class="menu-theme-icon h-4 w-4 fill-current" aria-hidden="true">
            <path d="M13,3V9H21V3M13,21H21V11H13M3,21H11V15H3M3,13H11V3H3V13Z" />
          </svg>
          <span class="sr-only">{{ $t("component.mainNav.multiview") }}</span>
        </UiButton>

        <UiButton
          as="a"
          :href="musicdexURL"
          target="_blank"
          rel="noopener noreferrer"
          class-name="min-[960px]:hidden menu-action-btn"
          variant="ghost"
          size="icon"
          title="Musicdex"
        >
          <svg viewBox="0 0 24 24" class="h-4 w-4" aria-hidden="true">
            <defs>
              <linearGradient id="musicdex-mobile-gradient" x1="3" y1="2" x2="21" y2="20" gradientUnits="userSpaceOnUse">
                <stop stop-color="#5DA2F2" />
                <stop offset="0.55" stop-color="#F06292" />
                <stop offset="1" stop-color="#FF3A81" />
              </linearGradient>
            </defs>
            <path fill="url(#musicdex-mobile-gradient)" d="M12 3V13.55A4 4 0 1 0 14 17V7H19V3H12Z" />
          </svg>
          <span class="sr-only">Musicdex</span>
        </UiButton>
      </div>

      <div v-if="mobileSearchOpen" class="border-t border-[color:var(--color-border)] px-3 pb-3 min-[960px]:hidden">
        <form class="flex items-center gap-2" @submit.prevent="submitSearch">
          <div class="relative flex-1">
            <UiInput
              v-model="searchText"
              placeholder="Search streams, clips, channels"
              class-name="h-10 flex-1 border-[color:var(--color-light)] bg-[color:var(--color-card)] pr-10"
            />
            <button
              type="button"
              class="menu-search-inline-btn"
              @click="submitSearch(true)"
            >
              <UiIcon :icon="mdiMagnify" class-name="menu-theme-icon h-4 w-4" />
              <span class="sr-only">Search</span>
            </button>
          </div>
        </form>
        <div class="mt-2">
          <HomeOrgMultiSelect
            button-class="h-10 w-full justify-between rounded-xl px-3 text-[0.8rem] font-normal"
          />
        </div>
      </div>

    </header>

    <div v-if="!disableExt" class="main-nav-ext pointer-events-none relative z-[90] px-3 py-2 sm:px-5">
      <div class="pointer-events-auto mx-auto max-w-[1600px]">
        <div id="mainNavExt" class="contents" />
      </div>
    </div>

    <nav v-if="!isWatchPage" class="fixed inset-x-3 bottom-3 z-40 min-[960px]:hidden">
      <UiCard class-name="mx-auto flex max-w-md items-center justify-between px-2 py-2">
        <router-link
          v-for="page in mobilePages"
          :key="page.name"
          :to="page.path"
          class="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium text-[color:var(--color-muted-foreground)] transition"
          :class="{ 'bg-[color:var(--surface-soft)] text-[color:var(--color-foreground)]': isActivePage(page) }"
        >
          <span class="truncate">{{ page.name }}</span>
        </router-link>
      </UiCard>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { mdiMagnify, mdiPlaylistPlay, mdiContentSave, mdiPlaylistPlus, mdiCheck, mdiPencil, mdiRefresh, mdiDelete, mdiFileDelimited, mdiClose } from "@mdi/js";
import { json2csvAsync } from "json-2-csv";
import debounce from "lodash-es/debounce";
import backendApi from "@/utils/backend-api";
import { localizedDayjs } from "@/utils/time";
import { musicdexURL, MAX_PLAYLIST_LENGTH } from "@/utils/consts";
import { getVideoThumbnails } from "@/utils/functions";
import * as icons from "@/utils/icons";
import { useAppStore } from "@/stores/app";
import { useSettingsStore } from "@/stores/settings";
import { usePlaylistStore } from "@/stores/playlist";
import Logo from "@/components/common/Logo.vue";
import HomeOrgMultiSelect from "@/components/common/HomeOrgMultiSelect.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiInput from "@/components/ui/input/Input.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiDialog from "@/components/ui/dialog/Dialog.vue";
import UiBadge from "@/components/ui/badge/Badge.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiPopover from "@/components/ui/popover/Popover.vue";
import UiPopoverTrigger from "@/components/ui/popover/PopoverTrigger.vue";
import UiPopoverContent from "@/components/ui/popover/PopoverContent.vue";
import UiScrollArea from "@/components/ui/scroll-area/ScrollArea.vue";
import NavUserMenu from "@/components/nav/NavUserMenu.vue";
import NavSettingsMenu from "@/components/nav/NavSettingsMenu.vue";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const appStore = useAppStore();
const settingsStore = useSettingsStore();
const playlistStore = usePlaylistStore();

const mobileSearchOpen = ref(false);
const mobileMoreOpen = ref(false);
const searchText = ref("");
const searchFilters = ref<any[]>([]);
const autocompleteResults = ref<any[]>([]);
const autocompleteOpen = ref(false);
const playlistMenuOpen = ref(false);
const serverPlaylists = ref<any[]>([]);
const serverPlaylistsLoading = ref(false);
const playlistEditName = ref(false);
const nameInputEl = ref<any>(null);
const playlistYTDialog = ref(false);
const playlistLoginWarning = ref(false);

const dragFromIdx = ref<number | null>(null);
const dragOverIdx = ref<number | null>(null);
const dragOverPosition = ref<'above' | 'below'>('below');

const desktopSearchInput = ref<HTMLInputElement | null>(null);

// Track the fixed header height so main content can set its padding-top dynamically
const navRootEl = ref<HTMLElement | null>(null);
const navHeaderEl = ref<HTMLElement | null>(null);
let _navRo: ResizeObserver | null = null;
let _headerRo: ResizeObserver | null = null;

function observeNav(el: HTMLElement | null) {
  _navRo?.disconnect();
  if (!el) return;
  _navRo = new ResizeObserver(([entry]) => {
    const h = Math.ceil(entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height);
    document.documentElement.style.setProperty("--nav-total-height", `${h}px`);
  });
  _navRo.observe(el);
}

function observeHeader(el: HTMLElement | null) {
  _headerRo?.disconnect();
  if (!el) return;
  _headerRo = new ResizeObserver(([entry]) => {
    const h = Math.ceil(entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height);
    document.documentElement.style.setProperty("--nav-header-height", `${h}px`);
  });
  _headerRo.observe(el);
}

watch(navRootEl, observeNav);
watch(navHeaderEl, observeHeader);
onMounted(() => { observeNav(navRootEl.value); observeHeader(navHeaderEl.value); });
onBeforeUnmount(() => { _navRo?.disconnect(); _headerRo?.disconnect(); });

// Focus the rename input when it appears
watch(playlistEditName, (editing) => {
  if (editing) {
    nextTick(() => {
      const el = nameInputEl.value?.$el ?? nameInputEl.value;
      const input = el?.tagName === 'INPUT' ? el : el?.querySelector?.('input');
      input?.focus();
      input?.select();
    });
  }
});

const showTopBar = computed(() => {
  const name = route.name as string;
  if (["multiview", "tlclient", "scripteditor"].includes(name)) return false;
  // During initial navigation, route.path is "/" (START_LOCATION). Use window.location as fallback.
  const resolvedPath = (route.path === "/" && !route.name) ? window.location.pathname : route.path;
  if (resolvedPath.startsWith("/multiview") || resolvedPath.startsWith("/tlclient") || resolvedPath.startsWith("/scripteditor")) return false;
  return true;
});

const isWatchPage = computed(() => {
  const name = route.name as string;
  if (["watch_id", "watch", "edit_video", "multiview", "tlclient", "scripteditor"].includes(name)) return true;
  const resolvedPath = (route.path === "/" && !route.name) ? window.location.pathname : route.path;
  if (resolvedPath.startsWith("/watch") || resolvedPath.startsWith("/multiview") || resolvedPath.startsWith("/tlclient") || resolvedPath.startsWith("/scripteditor") || resolvedPath.startsWith("/edit/video")) return true;
  return false;
});

const currentOrg = computed(() => appStore.currentOrg);

const playlistCount = computed(() => playlistStore.active?.videos?.length || 0);

const playlistVideos = computed(() => playlistStore.active?.videos || []);

const jwt = computed(() => appStore.userdata?.jwt);

const playlistName = computed({
  get() { return playlistStore.active?.name || "Unnamed Playlist"; },
  set(v: string) {
    if (v && v.length > 0 && playlistStore.active) {
      playlistStore.setPlaylist({ ...playlistStore.active, name: v });
    }
  },
});

const user = computed(() => appStore.userdata?.user);

const avatarUrl = computed(() => {
  const seed = user.value?.id || "guest";
  return `https://api.dicebear.com/7.x/shapes/svg?seed=${seed}`;
});

const disableExt = computed(() =>
  isWatchPage.value || route.name === "search",
);

async function goHomeFromLogo() {
  const page = settingsStore.defaultOpen;
  if (page === "multiview") {
    await router.push({ name: "multiview" }).catch(() => {});
  } else {
    await router.push({ name: "home" }).catch(() => {});
  }
  await nextTick();
  appStore.reloadCurrentPage({ source: "logo-home", consumed: false, defaultOpen: page });
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

const pages = computed(() => {
  return [
    {
      key: "home",
      name: t("component.mainNav.home"),
      path: "/",
    },
    {
      key: "favorites",
      name: t("component.mainNav.favorites"),
      path: "/favorites",
    },
    {
      key: "channels",
      name: t("component.mainNav.channels"),
      path: "/channels",
    },
    {
      key: "multiview",
      name: t("component.mainNav.multiview"),
      path: "/multiview",
      collapsible: true,
    },
    {
      key: "musicdex",
      name: "Musicdex",
      path: musicdexURL,
      collapsible: true,
    },
    {
      key: "tlclient",
      name: "TL Client",
      path: "/tlclient",
      extra: true,
    },
    {
      key: "scripteditor",
      name: "Script Editor",
      path: "/scripteditor",
      extra: true,
    },
    {
      key: "scriptmanager",
      name: "Script Manager",
      path: "/scriptmanager",
      extra: true,
    },
    {
      key: "relaybot",
      name: "Relay Bot",
      path: "/relaybot",
      extra: true,
    },
  ];
});

const primaryPages = computed(() => {
  return [] as typeof pages.value;
});

const mobilePages = computed(() =>
  pages.value.filter((page) => ["home", "playlists"].includes(page.key)),
);

const mobileMorePages = computed(() =>
  pages.value.filter((page) => !["home", "playlists"].includes(page.key) && !page.extra),
);

watch(() => route.fullPath, () => {
  mobileSearchOpen.value = false;
  mobileMoreOpen.value = false;
  autocompleteOpen.value = false;
  autocompleteResults.value = [];
});

const debouncedSearchAutocomplete = debounce(async (val: string) => {
  if (!val || val.trim().length < 2) {
    autocompleteResults.value = [];
    return;
  }
  try {
    const res = await backendApi.searchAutocomplete(val.trim());
    autocompleteResults.value = (res.data || [])
      .map((x: any) => ({ ...x, text: x.text || x.value }))
      .filter((x: any) => ["channel", "org", "topic"].includes(x.type))
      .slice(0, 8);
    if (autocompleteResults.value.length) {
      autocompleteOpen.value = true;
    }
  } catch {
    autocompleteResults.value = [];
  }
}, 220);

watch(searchText, (val) => {
  debouncedSearchAutocomplete(val);
});

function isActivePage(page: any) {
  // During initial navigation, route is at START_LOCATION (path: "/").
  // Use window.location.pathname to avoid briefly highlighting the wrong nav item.
  const currentPath = (!route.name && route.path === "/") ? window.location.pathname : route.path;
  if (page.key === "home") {
    return ["/", "/archive", "/clips"].includes(currentPath);
  }
  if (page.key === "favorites") {
    return currentPath === "/favorites"
      || currentPath === "/favorites/archive"
      || currentPath === "/favorites/clips";
  }
  const currentFullPath = (!route.name && route.path === "/") ? window.location.pathname + window.location.search + window.location.hash : route.fullPath;
  return currentFullPath === page.path
    || (page.path !== "/" && currentPath.startsWith(page.path.split("?")[0]));
}

async function submitSearch(redirectIfEmpty = false) {
  const query = searchText.value.trim();
  const hasFilters = searchFilters.value.length > 0;
  if (!query && !hasFilters) {
    if (!redirectIfEmpty) return;
    if (route.path !== "/search" || Object.keys(route.query || {}).length) {
      router.push({ path: "/search", query: {} });
    }
    mobileSearchOpen.value = false;
    return;
  }
  const payload = [...searchFilters.value.map((f) => ({
    type: f.type,
    value: f.type === "org" ? f.value : f.value,
    text: f.text || f.value,
  }))];
  if (query) {
    payload.push({ type: "title & desc", value: `${query}title & desc`, text: query });
  }
  const targetQuery = {
    ...route.query,
    q: await json2csvAsync(payload),
  };
  if (route.path === "/search" && route.query.q === targetQuery.q) {
    mobileSearchOpen.value = false;
    return;
  }
  router.push({
    path: "/search",
    query: targetQuery,
  });
  mobileSearchOpen.value = false;
  searchFilters.value = [];
  searchText.value = "";
}

function onSearchBlur() {
  setTimeout(() => { autocompleteOpen.value = false; }, 150);
}

async function selectAutocomplete(item: any) {
  autocompleteOpen.value = false;
  autocompleteResults.value = [];
  if (["channel", "topic", "org"].includes(item.type)) {
    const exists = searchFilters.value.some((f) => f.type === item.type && f.value === item.value);
    if (!exists) {
      searchFilters.value.push({ type: item.type, value: item.value, text: item.text });
    }
    searchText.value = "";
    nextTick(() => {
      desktopSearchInput.value?.focus();
    });
  } else {
    searchText.value = item.text || item.value;
    submitSearch();
  }
}

function removeSearchFilter(index: number) {
  searchFilters.value.splice(index, 1);
}

function handleSearchBackspace() {
  if (!searchText.value && searchFilters.value.length > 0) {
    searchFilters.value.pop();
  }
}

// ── Playlist dropdown ──
function formatPlaylistTime(ts: string) {
  return localizedDayjs(ts, settingsStore.langSetting).format("l");
}

function getVideoThumbUrl(videoId: string) {
  return getVideoThumbnails(videoId, false).default;
}

// Auto-refresh server playlists when save state changes
watch(() => playlistStore.isSaved, (saved) => {
  if (saved && playlistMenuOpen.value) fetchServerPlaylists();
});

async function fetchServerPlaylists() {
  if (!jwt.value || serverPlaylistsLoading.value) return;
  serverPlaylistsLoading.value = true;
  try {
    const { data } = await backendApi.getPlaylistList(jwt.value);
    serverPlaylists.value = data;
  } catch {
    serverPlaylists.value = [];
  } finally {
    serverPlaylistsLoading.value = false;
  }
}

// Reset sub-states when playlist menu opens
watch(playlistMenuOpen, (open) => {
  if (open) {
    playlistEditName.value = false;
    playlistLoginWarning.value = false;
    fetchServerPlaylists();
  }
});

function switchPlaylist(playlist: any) {
  if (playlist.id === playlistStore.active?.id) return;
  if (playlistStore.isSaved || confirm(t("views.playlist.change-loss-warning"))) {
    playlistStore.setActivePlaylistByID(playlist.id);
    fetchServerPlaylists();
  }
}

function createNewPlaylist() {
  if (!jwt.value) {
    router.push("/user");
    playlistMenuOpen.value = false;
    return;
  }
  if (playlistStore.isSaved || confirm(t("views.playlist.change-loss-warning"))) {
    playlistStore.resetPlaylist();
    playlistStore.modified();
  }
}

async function saveActivePlaylist() {
  if (!jwt.value) {
    playlistLoginWarning.value = true;
    return;
  }
  playlistLoginWarning.value = false;
  await playlistStore.saveActivePlaylist();
  fetchServerPlaylists();
}

function deleteActivePlaylist() {
  playlistStore.deleteActivePlaylist();
  fetchServerPlaylists();
}

function dismissRenameOnOutsideClick(e: PointerEvent) {
  if (!playlistEditName.value) return;
  const target = e.target as HTMLElement;
  if (!target.closest('input')) {
    playlistEditName.value = false;
  }
}

function handlePointerDown(idx: number, e: PointerEvent) {
  if (e.button !== 0) return;
  const target = e.target as HTMLElement;
  if (target.closest('button')) return;

  const startY = e.clientY;
  const container = (e.currentTarget as HTMLElement).parentElement!;
  const getItems = () => Array.from(container.querySelectorAll('[data-drag-item]'));
  let isDragging = false;
  const THRESHOLD = 6;
  const prevUserSelect = document.body.style.userSelect;

  const onPointerMove = (moveE: PointerEvent) => {
    if (!isDragging) {
      if (Math.abs(moveE.clientY - startY) < THRESHOLD) return;
      isDragging = true;
      dragFromIdx.value = idx;
      document.body.style.userSelect = 'none';
    }
    moveE.preventDefault();
    const items = getItems();
    let found = false;
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect();
      if (moveE.clientY >= rect.top && moveE.clientY <= rect.bottom) {
        if (i === dragFromIdx.value) {
          dragOverIdx.value = null;
        } else {
          dragOverIdx.value = i;
          dragOverPosition.value = moveE.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
        }
        found = true;
        break;
      }
    }
    if (!found && items.length > 0) {
      const firstRect = items[0].getBoundingClientRect();
      const lastRect = items[items.length - 1].getBoundingClientRect();
      if (moveE.clientY < firstRect.top + firstRect.height / 2) {
        dragOverIdx.value = 0;
        dragOverPosition.value = 'above';
      } else if (moveE.clientY > lastRect.top + lastRect.height / 2) {
        dragOverIdx.value = items.length - 1;
        dragOverPosition.value = 'below';
      }
    }
  };

  const onPointerUp = () => {
    if (isDragging && dragFromIdx.value !== null && dragOverIdx.value !== null) {
      const from = dragFromIdx.value;
      const overIdx = dragOverIdx.value;
      let to: number;
      if (dragOverPosition.value === 'above') {
        to = from > overIdx ? overIdx : overIdx - 1;
      } else {
        to = from > overIdx ? overIdx + 1 : overIdx;
      }
      if (to >= 0 && to < playlistVideos.value.length && to !== from) {
        playlistStore.reorder({ from, to });
      }
    }
    if (isDragging) {
      // Prevent the click event that follows pointerup from navigating
      document.addEventListener('click', (ce) => { ce.stopPropagation(); ce.preventDefault(); }, { capture: true, once: true });
      document.body.style.userSelect = prevUserSelect;
    }
    dragFromIdx.value = null;
    dragOverIdx.value = null;
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
  };

  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
}

async function downloadPlaylistCSV() {
  const videos = playlistStore.active?.videos;
  if (!videos?.length) return;
  const csvString = await json2csvAsync(videos);
  const a = document.createElement("a");
  const timestamp = new Date().toISOString().replace("T", "_").slice(0, 19);
  a.href = `data:attachment/csv,${encodeURIComponent(csvString)}`;
  a.target = "_blank";
  a.download = `holodexPlaylist_${playlistStore.active?.name || "playlist"}_${timestamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function exportPlaylistToYT() {
  const videos = playlistStore.active?.videos;
  if (!videos?.length) return;
  const url = `https://www.youtube.com/watch_videos?video_ids=${videos.map((x: any) => x.id).join(",")}`;
  window.open(url, "_blank", "noopener");
  playlistYTDialog.value = false;
}


</script>

<style scoped>
.menu-logo-tile {
  border-color: var(--color-light) !important;
  background: var(--color-card) !important;
}

.menu-action-btn {
  border: none !important;
  cursor: pointer;
}

.menu-theme-icon {
  color: inherit;
}

.playlist-count-badge {
  background-color: var(--color-card);
  border-color: var(--color-border);
  color: var(--color-muted-foreground);
  font-weight: 400;
  text-transform: none;
  letter-spacing: normal;
  font-size: 10px;
  line-height: 1;
  transition: background-color 160ms ease, border-color 160ms ease;
}
.menu-action-btn:hover .playlist-count-badge {
  background-color: var(--color-base);
  border-color: var(--color-bold);
}

.menu-theme-icon {
  color: inherit;
  filter: none;
}

.menu-avatar-btn {
  overflow: hidden;
  padding: 0 !important;
}

.menu-avatar-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 0;
}

.menu-search-form {
  display: flex;
  flex: 1 1 0;
  min-width: 0;
  max-width: 100%;
  align-items: center;
  gap: 0.5rem;
}

.menu-search-inline-btn {
  position: absolute;
  top: 50%;
  right: 0.35rem;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.9rem;
  height: 1.9rem;
  border: 0;
  border-radius: 0.6rem;
  background: transparent;
  color: var(--color-primary);
  cursor: pointer;
  transition: color 160ms ease, background-color 160ms ease, border-color 160ms ease;
}

.menu-search-inline-btn:hover,
.menu-search-inline-btn:focus-visible {
  color: color-mix(in srgb, var(--color-primary) 90%, var(--color-foreground) 10%);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  outline: none;
}

.menu-autocomplete-dropdown {
  position: absolute;
  top: calc(100% + 0.35rem);
  left: 0;
  right: 0;
  z-index: 200;
  background: var(--colorbg);
  border: 1px solid var(--color-border);
  border-radius: 0.85rem;
  box-shadow: 0 16px 40px rgb(0 0 0 / 0.28);
  overflow: hidden;
  padding: 0.3rem;
}

.menu-autocomplete-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.45rem 0.6rem;
  border-radius: 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  color: var(--color-foreground);
  transition: background-color 120ms ease;
}

.menu-autocomplete-item:hover,
.menu-autocomplete-item:focus {
  background: var(--surface-soft);
  outline: none;
}

.menu-autocomplete-icon {
  width: 0.9rem;
  height: 0.9rem;
  flex-shrink: 0;
  color: var(--color-muted-foreground);
}

.menu-autocomplete-text {
  flex: 1 1 auto;
  font-size: 0.8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-autocomplete-type {
  font-size: 0.65rem;
  color: var(--color-muted-foreground);
  text-transform: capitalize;
  flex-shrink: 0;
}

/* ─── Search filter tags ─── */
.menu-search-tags-wrap {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  min-height: 2.5rem;
  border: 1px solid var(--color-light);
  border-radius: 0.75rem;
  background: var(--color-card);
  padding: 0.25rem 2.5rem 0.25rem 0.75rem;
  flex-wrap: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  /* Prevent tags from overflowing under the search icon */
  scroll-padding-right: 2.5rem;
}

.menu-search-tags-wrap::-webkit-scrollbar {
  display: none;
}

.menu-search-tags-wrap:focus-within {
  border-color: var(--color-primary);
}

.menu-search-tags-input {
  flex: 1 1 60px;
  min-width: 60px;
  max-width: 100%;
  background: transparent;
  border: none;
  outline: none;
  font-size: 0.8rem;
  color: var(--color-foreground);
  padding: 0;
  height: 1.75rem;
}

.menu-search-tags-input::placeholder {
  color: var(--color-muted-foreground);
  font-size: 0.8rem;
}

.menu-search-filter-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  border-radius: 999px;
  padding: 0.1rem 0.25rem 0.1rem 0.3rem;
  font-size: 0.68rem;
  white-space: nowrap;
  flex-shrink: 0;
  border: 1px solid var(--color-border);
  background: var(--surface-soft);
  color: var(--color-foreground);
}

.menu-search-filter-tag-icon {
  width: 0.8rem;
  height: 0.8rem;
  flex-shrink: 0;
  color: var(--color-muted-foreground);
}

.menu-search-filter-tag-text {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 8rem;
}

.menu-search-filter-tag-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--color-muted-foreground);
  font-size: 0.8rem;
  line-height: 1;
  padding: 0;
}

.menu-search-filter-tag-remove:hover {
  color: var(--color-foreground);
}
</style>

<style lang="scss">
/* Remove focus outlines from buttons inside the playlist popover (portaled to body) */
.popover-content button:focus,
.popover-content button:focus-visible {
  outline: none !important;
  box-shadow: none !important;
}

/* Playlist video list compact actions (from Playlist.vue) */
.playlist-video-list .video-card-item-actions {
    padding: 0 !important;
    margin: 0 !important;
}

.playlist-video-list .video-card:hover .video-card-item-actions {
    opacity: 1;
}

.playlist-video-list .video-card .video-card-item-actions {
    opacity: 0.2;
}

.playlist-video-list .video-card-item-actions button {
    padding: 1px 0 !important;
    margin: 0 !important;
    height: 22px !important;
    width: 22px !important;
    line-height: 20px;
}
</style>
