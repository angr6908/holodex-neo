"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { mdiCheck, mdiChevronDown } from "@mdi/js";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import { useAnimatedPresence } from "@/lib/useAnimatedPresence";

function hasOwn(obj: unknown, key: string) {
  return !!obj && typeof obj === "object" && Object.prototype.hasOwnProperty.call(obj, key);
}

type SelectProps<T> = {
  value?: any;
  options?: T[];
  placeholder?: string;
  labelKey?: string;
  valueKey?: string;
  className?: string;
  menuClassName?: string;
  optionClassName?: string;
  disabled?: boolean;
  align?: "left" | "right";
  returnObject?: boolean;
  matchTriggerWidth?: boolean;
  fluid?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFilterFn?: ((option: T, query: string) => boolean) | null;
  placement?: "auto" | "bottom";
  menuMaxHeight?: number;
  onChange?: (value: any, option: T) => void;
  onOpenChange?: (value: boolean) => void;
  renderTrigger?: (ctx: { selectedOption: T | null; open: boolean; selectedLabel: string }) => React.ReactNode;
  renderOption?: (ctx: { option: T; selected: boolean; label: string }) => React.ReactNode;
};

export function Select<T>({
  value,
  options = [],
  placeholder = "Select an option",
  labelKey = "label",
  valueKey = "value",
  className = "",
  menuClassName = "",
  optionClassName = "",
  disabled = false,
  align = "left",
  returnObject = false,
  matchTriggerWidth = true,
  fluid = true,
  searchable = false,
  searchPlaceholder = "Search...",
  searchFilterFn = null,
  placement = "auto",
  menuMaxHeight = 288,
  onChange,
  onOpenChange,
  renderTrigger,
  renderOption,
}: SelectProps<T>) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [menuWidth, setMenuWidth] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [mounted, setMounted] = useState(false);
  const menuPresence = useAnimatedPresence(open, 220);

  function getOptionValue(option: any) {
    if (hasOwn(option, valueKey)) return option[valueKey];
    if (hasOwn(option, "value")) return option.value;
    return option;
  }

  function getOptionLabel(option: any) {
    if (hasOwn(option, labelKey)) return `${option[labelKey]}`;
    if (hasOwn(option, "text")) return `${option.text}`;
    if (hasOwn(option, "label")) return `${option.label}`;
    if (hasOwn(option, "name")) return `${option.name}`;
    return `${option ?? ""}`;
  }

  function isSelected(option: any) {
    const currentValue = returnObject ? getOptionValue(value) : value;
    return getOptionValue(option) === currentValue;
  }

  const normalizedOptions = useMemo(() =>
    (options || []).map((option, index) => ({
      raw: option,
      label: getOptionLabel(option),
      key: hasOwn(option, valueKey) ? `${getOptionValue(option)}` : `${index}-${getOptionLabel(option)}`,
    })),
  [options, labelKey, valueKey]);

  const selectedOption = useMemo(() => normalizedOptions.find((option) => isSelected(option.raw))?.raw || null,
  [normalizedOptions, value, returnObject, valueKey]);

  const visibleOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return normalizedOptions;
    if (searchFilterFn) return normalizedOptions.filter((option) => searchFilterFn(option.raw, query));
    return normalizedOptions.filter((option) => option.label.toLowerCase().includes(query));
  }, [normalizedOptions, searchQuery, searchFilterFn]);

  const selectedLabel = selectedOption ? getOptionLabel(selectedOption) : placeholder;
  const selectedVisibleIndex = visibleOptions.findIndex((option) => isSelected(option.raw));
  const edgeTopActive = visibleOptions.length > 0 && (hoveredIndex === 0 || focusedIndex === 0 || selectedVisibleIndex === 0);
  const lastVisibleIndex = visibleOptions.length - 1;
  const edgeBottomActive = lastVisibleIndex >= 0 && (hoveredIndex === lastVisibleIndex || focusedIndex === lastVisibleIndex || selectedVisibleIndex === lastVisibleIndex);
  const scrollEdgeStyle = {
    "--edge-top": edgeTopActive ? "var(--color-base)" : "var(--colorbg)",
    "--edge-bottom": edgeBottomActive ? "var(--color-base)" : "var(--colorbg)",
  } as React.CSSProperties;

  function syncMenuGeometry() {
    const nextRect = trigger.current?.getBoundingClientRect() || null;
    setRect(nextRect);
    setMenuWidth(trigger.current?.offsetWidth || 0);
  }

  function setOpenValue(nextOpen: boolean) {
    if (nextOpen) syncMenuGeometry();
    setOpen(nextOpen);
    if (nextOpen) {
      requestAnimationFrame(() => {
        if (searchable && searchInput.current) searchInput.current.focus();
        else root.current?.focus();
      });
    } else {
      setSearchQuery("");
      setHoveredIndex(-1);
      setFocusedIndex(-1);
    }
    onOpenChange?.(nextOpen);
  }

  function toggleMenu() {
    if (disabled) return;
    setOpenValue(!open);
  }

  function closeMenu() {
    if (!open) return;
    setOpenValue(false);
  }

  function getOptionClass(option: T, index: number) {
    const active = hoveredIndex === index || focusedIndex === index || isSelected(option);
    const nextActive = active && index < lastVisibleIndex && (hoveredIndex === index + 1 || focusedIndex === index + 1 || isSelected(visibleOptions[index + 1].raw));
    return cn(
      "ui-select-option flex w-full cursor-pointer items-center justify-between bg-transparent text-left text-[0.8rem] text-[color:var(--color-foreground)] transition-colors",
      isSelected(option) && "ui-select-option-selected",
      active && "ui-select-option-active",
      nextActive && "ui-select-option-active-join-next",
      active && index === 0 && "ui-select-option-active-first",
      active && index === lastVisibleIndex && "ui-select-option-active-last",
      optionClassName,
    );
  }

  function selectOption(option: T) {
    onChange?.(returnObject ? option : getOptionValue(option), option);
    closeMenu();
  }

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (root.current?.contains(target)) return;
      if ((target as HTMLElement)?.closest?.(".ui-select-menu")) return;
      closeMenu();
    }

    function handleDocumentKeydown(event: KeyboardEvent) {
      if (!open || event.key !== "Escape") return;
      event.stopPropagation();
      closeMenu();
    }

    function handleWindowScroll(event: Event) {
      if (!open) return;
      const target = event.target;
      if (target instanceof Node && target !== document) {
        if (root.current?.contains(target) || target.contains(root.current)) return;
        if (target instanceof Element && target.closest?.(".ui-select-menu")) return;
      }
      closeMenu();
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement && root.current?.contains(activeElement)) activeElement.blur();
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleDocumentKeydown);
    window.addEventListener("resize", syncMenuGeometry, { passive: true });
    window.addEventListener("scroll", handleWindowScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleDocumentKeydown);
      window.removeEventListener("resize", syncMenuGeometry);
      window.removeEventListener("scroll", handleWindowScroll, true);
    };
  }, [open]);

  const menuStyle = (() => {
    if (!menuPresence.present || !rect) return undefined;
    const gap = 6;
    const viewportPadding = 12;
    const preferredScrollHeight = menuMaxHeight;
    const searchChromeHeight = searchable ? 50 : 0;
    const preferredMenuHeight = preferredScrollHeight + searchChromeHeight;
    const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
    const spaceAbove = rect.top - gap - viewportPadding;
    const openAbove = placement === "auto" && spaceBelow < preferredMenuHeight && spaceAbove > spaceBelow;
    const availableSpace = Math.max(0, openAbove ? spaceAbove : spaceBelow);
    const scrollMaxHeight = Math.max(0, Math.min(menuMaxHeight, availableSpace - searchChromeHeight));
    const style = {
      maxHeight: `${scrollMaxHeight + searchChromeHeight}px`,
      "--ui-select-menu-max-height": `${scrollMaxHeight}px`,
    } as React.CSSProperties;
    if (openAbove) style.bottom = window.innerHeight - rect.top + gap;
    else style.top = rect.bottom + gap;
    if (align === "right") style.right = window.innerWidth - rect.right;
    else style.left = rect.left;
    if (matchTriggerWidth && menuWidth) style.minWidth = menuWidth;
    return style;
  })();

  const menu = menuPresence.present && mounted && menuStyle ? createPortal(
    <div
      data-state={menuPresence.state}
      className={cn(
        "glass-panel rounded-[calc(var(--radius)+6px)] ui-select-menu fixed z-[360] min-w-[max-content] overflow-hidden border bg-[color:var(--color-card)] p-0",
        menuPresence.state === "closed" && "pointer-events-none",
        searchable && "ui-select-menu-searchable",
        menuClassName,
      )}
      role="listbox"
      style={menuStyle}
      onAnimationEnd={menuPresence.onAnimationEnd}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {searchable ? (
        <div className="ui-select-search-wrap">
          <input ref={searchInput} type="text" className="ui-select-search-input" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={searchPlaceholder} />
        </div>
      ) : null}
      <div className="ui-select-menu-scroll" style={scrollEdgeStyle}>
        <div className="scroll-area-viewport h-full w-full scroll-area-viewport-native overflow-y-auto overflow-x-hidden">
          <div className="min-h-full min-w-full scroll-area-content-native">
            {visibleOptions.map((option, index) => (
              <button
                key={option.key || index}
                type="button"
                role="option"
                aria-selected={isSelected(option.raw)}
                className={getOptionClass(option.raw, index)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(-1)}
                onFocus={() => setFocusedIndex(index)}
                onBlur={() => setFocusedIndex(-1)}
                onClick={() => selectOption(option.raw)}
              >
                {renderOption ? renderOption({ option: option.raw, selected: isSelected(option.raw), label: option.label }) : (
                  <>
                    <span className="truncate">{option.label}</span>
                    {isSelected(option.raw) ? <Icon icon={mdiCheck} size="sm" className="ml-3 shrink-0 text-[color:var(--color-foreground)]" /> : null}
                  </>
                )}
              </button>
            ))}
            {visibleOptions.length === 0 ? <div className="ui-select-empty">No options found</div> : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div
      ref={root}
      className={cn(fluid ? "relative w-full" : "relative inline-block", "outline-none")}
      tabIndex={-1}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); closeMenu(); } }}
    >
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-expanded={open ? "true" : "false"}
        aria-haspopup="listbox"
        className={cn("ui-select-trigger flex h-11 items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-3 text-left text-[0.8rem] text-[color:var(--color-foreground)] transition outline-none disabled:cursor-not-allowed disabled:opacity-60", open && "ui-select-trigger-open", fluid ? "w-full" : "w-auto", className)}
        onClick={toggleMenu}
      >
        {renderTrigger ? renderTrigger({ selectedOption, open, selectedLabel }) : (
          <>
            <span className="truncate">{selectedLabel}</span>
            <Icon icon={mdiChevronDown} size="sm" className={cn("ui-select-trigger-chevron ml-2 shrink-0", open && "ui-select-trigger-chevron-open")} />
          </>
        )}
      </button>
      {menu}
    </div>
  );
}
