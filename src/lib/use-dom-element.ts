"use client";

import { useEffect, useState } from "react";

export function useDomElement<T extends HTMLElement = HTMLElement>(id: string) {
  const [element, setElement] = useState<T | null>(null);
  useEffect(() => {
    const update = () => setElement(document.getElementById(id) as T | null);
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [id]);
  return element;
}
