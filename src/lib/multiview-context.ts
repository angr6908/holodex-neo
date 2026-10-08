"use client";

import { createContext, useContext } from "react";

// The multiview store's context, apart from the store (multiview-store.tsx) so components that
// only check whether they are inside multiview, like video cards, don't load the store's code.
export const MultiviewContext = createContext<any>(null);

export const useOptionalMultiviewStore = () => useContext(MultiviewContext);
