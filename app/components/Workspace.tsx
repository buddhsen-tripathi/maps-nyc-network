"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { SidebarSimpleIcon } from "@phosphor-icons/react";
import type {
  Category,
  CategoryOption,
  Theme,
} from "@/lib/categories/types";
import { CategoryPanel } from "./CategoryPanel";
import { MapView, type ActiveLayer } from "./MapView";
import { SourcesButton } from "./SourcesButton";
import type { Source } from "@/lib/sources/types";

type ApiCategory = Category & { options: CategoryOption[] };
type CategoriesResponse = { themes: Theme[]; categories: ApiCategory[] };
type SourcesResponse = { sources: Source[] };

export type ActiveOptions = Record<string, string | boolean>;

const MOBILE_QUERY = "(max-width: 767px)";

function subscribeMobile(callback: () => void) {
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getMobileSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches;
}

export function Workspace() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [active, setActive] = useState<Record<string, ActiveOptions>>({});

  // True when viewport is below md. Server snapshot is false so SSR renders
  // desktop layout; on mount we re-render with the real value.
  const isMobile = useSyncExternalStore(
    subscribeMobile,
    getMobileSnapshot,
    () => false,
  );
  const [override, setOverride] = useState<boolean | null>(null);
  const sidebarOpen = override ?? !isMobile;
  const setSidebarOpen = (open: boolean) => setOverride(open);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json() as Promise<CategoriesResponse>)
      .then((d) => {
        setThemes(d.themes);
        setCategories(d.categories);
      });
    fetch("/api/sources")
      .then((r) => r.json() as Promise<SourcesResponse>)
      .then((d) => setSources(d.sources));
  }, []);

  const layers = useMemo<ActiveLayer[]>(() => {
    return Object.entries(active).map(([id, options]) => {
      const cat = categories.find((c) => c.id === id);
      return {
        id,
        name: cat?.name ?? id,
        kind: cat?.kind ?? "points",
        paint: cat?.paint ?? { color: "#fff" },
        cluster: cat?.cluster ?? false,
        options,
        popup: cat?.popup,
      };
    });
  }, [active, categories]);

  const toggleCategory = (id: string) => {
    setActive((prev) => {
      if (prev[id]) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      const cat = categories.find((c) => c.id === id);
      const defaults: ActiveOptions = {};
      cat?.options?.forEach((o) => {
        defaults[o.id] = o.default;
      });
      return { ...prev, [id]: defaults };
    });
  };

  const setOption = (
    catId: string,
    optionId: string,
    value: string | boolean,
  ) => {
    setActive((prev) =>
      prev[catId]
        ? { ...prev, [catId]: { ...prev[catId], [optionId]: value } }
        : prev,
    );
  };

  return (
    <div className="relative flex h-screen w-screen overflow-hidden">
      {sidebarOpen && (
        <>
          {/* Tap-to-dismiss backdrop, mobile only */}
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
            className="fixed inset-0 z-20 bg-black/55 backdrop-blur-[2px] md:hidden"
          />
          {/* Drawer on mobile, in-flow on desktop */}
          <div className="fixed inset-y-0 left-0 z-30 md:relative md:z-auto">
            <CategoryPanel
              themes={themes}
              categories={categories}
              active={active}
              onToggle={toggleCategory}
              onOption={setOption}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </>
      )}
      <div className="relative flex-1">
        <MapView layers={layers} />
        {!sidebarOpen && (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
            className="absolute left-3 top-3 z-10 flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface/95 px-2.5 text-[12px] font-medium text-foreground shadow-lg backdrop-blur transition-colors hover:border-border-strong"
          >
            <SidebarSimpleIcon size={14} weight="bold" />
            <span>Maps</span>
          </button>
        )}
        <SourcesButton sources={sources} />
      </div>
    </div>
  );
}
