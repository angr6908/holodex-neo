import { computed, ref } from "vue";
import { useMultiviewStore } from "@/stores/multiview";

export interface CellItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Composable replacement for CellMixin.
 * Provides computed properties and methods for a single multiview cell.
 *
 * @param item  - Reactive cell layout item (must have `.i` identifier).
 * @param emit  - The component's emit function (used for "delete" event).
 */
export function useMultiviewCell(
  item: CellItem | { value: CellItem },
  emit: (event: "delete", id: string) => void,
) {
  const multiviewStore = useMultiviewStore();
  const uniqueId = ref(Date.now());

  /** Unwrap item — supports both a plain object and a ref. */
  const resolvedItem = computed(() =>
    "value" in item ? (item as { value: CellItem }).value : item,
  );

  /** The full content object stored for this cell. */
  const cellContent = computed(
    () => multiviewStore.layoutContent[resolvedItem.value.i],
  );

  /** Whether the cell is currently in edit mode. */
  const editMode = computed({
    get() {
      if (!multiviewStore.layoutContent[resolvedItem.value.i]) return false;
      return multiviewStore.layoutContent[resolvedItem.value.i].editMode ?? true;
    },
    set(value: boolean) {
      multiviewStore.setLayoutContentWithKey({
        id: resolvedItem.value.i,
        key: "editMode",
        value,
      });
    },
  });

  const isChat = computed(() => cellContent.value?.type === "chat");
  const isVideo = computed(() => cellContent.value?.type === "video");
  const isEmpty = computed(() => !cellContent.value);

  const activeVideos = computed(() => multiviewStore.activeVideos);

  /** Force the cell to re-render by bumping the unique id. */
  function refresh() {
    uniqueId.value = Date.now();
    editMode.value = true;
  }

  /** Turn this cell into a chat panel. */
  function setItemAsChat(cellItem: CellItem) {
    multiviewStore.setLayoutContentById({
      id: cellItem.i,
      content: { type: "chat" },
    });
  }

  /** Emit a delete event so the parent can remove the cell from the layout. */
  function deleteCell() {
    emit("delete", resolvedItem.value.i);
  }

  /** Clear this cell's content without removing it from the layout. */
  function resetCell() {
    multiviewStore.deleteLayoutContent(resolvedItem.value.i);
  }

  return {
    uniqueId,
    cellContent,
    editMode,
    isChat,
    isVideo,
    isEmpty,
    activeVideos,

    refresh,
    setItemAsChat,
    deleteCell,
    resetCell,
  };
}
