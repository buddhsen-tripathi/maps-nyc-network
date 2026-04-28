"use client";

import { useEffect, useRef, useState } from "react";
import { DatabaseIcon, XIcon } from "@phosphor-icons/react";
import type { Source } from "@/lib/sources/types";

export function SourcesButton({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={containerRef} className="absolute right-3 top-3 z-10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface/95 px-2.5 text-[12px] font-medium text-foreground shadow-lg backdrop-blur transition-colors",
          open ? "border-border-strong" : "hover:border-border-strong",
        ].join(" ")}
      >
        <DatabaseIcon size={13} weight="bold" />
        <span>Sources</span>
        <span className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
          {sources.length}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(340px,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-border bg-surface shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sources
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <XIcon size={12} weight="bold" />
            </button>
          </div>
          <ul className="max-h-[420px] overflow-y-auto">
            {sources.map((s) => (
              <li
                key={s.id}
                className="border-b border-border px-3 py-2 last:border-b-0"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px] font-medium text-foreground">
                    {s.name}
                  </span>
                  <span className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                    {s.protocol}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {s.agency}
                </p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-subtle">
                  {s.description}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
