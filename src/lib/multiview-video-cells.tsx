"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type MultiviewVideoCellHandle = {
  readonly id: string;
  readonly video: any;
  readonly editMode: boolean;
  readonly muted: boolean;
  readonly volume: number;
  readonly isTwitchVideo: boolean;
  readonly isFastFoward: boolean;
  readonly currentTime: number;
  refresh: () => void;
  setPlaying: (value: boolean) => void;
  setMuted: (value: boolean) => void;
  setVolume: (value: number) => void;
  togglePlaybackRate: () => void;
  setPlaybackRate: (value: number) => void;
  manualRefresh: () => void;
  manualCheckMuted: () => Promise<void> | void;
  seekTo: (time: number) => void;
  deleteCell: () => void;
};

type MultiviewVideoCellsContextValue = {
  cells: MultiviewVideoCellHandle[];
  registerCell: (id: string, cell: MultiviewVideoCellHandle) => () => void;
};

const MultiviewVideoCellsContext = createContext<MultiviewVideoCellsContextValue | null>(null);

export function MultiviewVideoCellsProvider({ children }: { children: React.ReactNode }) {
  const [cellMap, setCellMap] = useState<Map<string, MultiviewVideoCellHandle>>(() => new Map());

  const registerCell = useCallback((id: string, cell: MultiviewVideoCellHandle) => {
    const key = String(id);
    setCellMap((previous) => {
      if (previous.get(key) === cell) return previous;
      const next = new Map(previous);
      next.set(key, cell);
      return next;
    });
    return () => {
      setCellMap((previous) => {
        if (previous.get(key) !== cell) return previous;
        const next = new Map(previous);
        next.delete(key);
        return next;
      });
    };
  }, []);

  const value = useMemo(() => ({ cells: Array.from(cellMap.values()), registerCell }), [cellMap, registerCell]);

  return <MultiviewVideoCellsContext.Provider value={value}>{children}</MultiviewVideoCellsContext.Provider>;
}

export function useRegisterMultiviewVideoCell(id: string, cell: MultiviewVideoCellHandle | null) {
  const registerCell = useContext(MultiviewVideoCellsContext)?.registerCell;
  useEffect(() => {
    if (!registerCell || !cell) return;
    return registerCell(id, cell);
  }, [registerCell, id, cell]);
}

export function useMultiviewVideoCells() {
  return useContext(MultiviewVideoCellsContext)?.cells ?? [];
}

export function useOrderedMultiviewVideoCells(layout: ReadonlyArray<{ i: string | number }>) {
  const registeredCells = useMultiviewVideoCells();

  return useMemo(() => {
    const cellsById = new Map<string, MultiviewVideoCellHandle>([...registeredCells].reverse().map((cell) => [cell.id, cell] as const));

    return layout
      .map((item) => cellsById.get(String(item.i)))
      .filter((cell): cell is MultiviewVideoCellHandle => !!cell && !!cell.video);
  }, [layout, registeredCells]);
}
