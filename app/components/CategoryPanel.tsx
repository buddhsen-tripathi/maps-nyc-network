"use client";

import { useMemo, useState } from "react";
import {
  CaretDownIcon,
  CaretRightIcon,
  GithubLogoIcon,
  GridFourIcon,
  MagnifyingGlassIcon,
  SidebarSimpleIcon,
} from "@phosphor-icons/react";
import type {
  Category,
  CategoryOption,
  Theme,
} from "@/lib/categories/types";
import { Icon } from "./Icon";
import type { ActiveOptions } from "./Workspace";

type ApiCategory = Category & { options: CategoryOption[] };

type Props = {
  themes: Theme[];
  categories: ApiCategory[];
  active: Record<string, ActiveOptions>;
  onToggle: (id: string) => void;
  onOption: (catId: string, optId: string, value: string | boolean) => void;
  onClose: () => void;
};

const GITHUB_URL = "https://github.com/buddhsen-tripathi/maps-nyc-network";

export function CategoryPanel({
  themes,
  categories,
  active,
  onToggle,
  onOption,
  onClose,
}: Props) {
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(["transit", "nature"]),
  );

  const grouped = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return themes.map((theme) => ({
      theme,
      cats: categories.filter(
        (c) =>
          c.theme === theme.id &&
          (q === "" ||
            c.name.toLowerCase().includes(q) ||
            c.description.toLowerCase().includes(q)),
      ),
    }));
  }, [themes, categories, filter]);

  const activeCount = Object.keys(active).length;

  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col border-r border-border bg-surface">
      <header className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <GridFourIcon size={16} weight="fill" />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <h1 className="text-[13px] font-semibold tracking-tight text-foreground">
            Block Maps
          </h1>
          <p className="text-[11px] text-muted-foreground">
            {categories.length} maps · {activeCount} active
          </p>
        </div>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="View source on GitHub"
          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <GithubLogoIcon size={14} weight="bold" />
        </a>
        <button
          type="button"
          onClick={onClose}
          aria-label="Collapse sidebar"
          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <SidebarSimpleIcon size={14} weight="bold" />
        </button>
      </header>

      <div className="border-b border-border px-3 pt-3 pb-2.5">
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-muted-foreground">
            <MagnifyingGlassIcon size={13} weight="bold" />
          </span>
          <input
            type="search"
            placeholder="Filter maps…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-card pl-8 pr-2.5 text-[12px] text-foreground placeholder:text-subtle outline-none transition-colors focus:border-border-strong focus:ring-2 focus:ring-ring/30"
          />
        </div>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {grouped.map(({ theme, cats }) => {
          if (cats.length === 0) return null;
          const isOpen = expanded.has(theme.id);
          const activeInTheme = cats.filter((c) => active[c.id]).length;
          return (
            <li key={theme.id} className="mb-1">
              <button
                type="button"
                onClick={() =>
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(theme.id)) next.delete(theme.id);
                    else next.add(theme.id);
                    return next;
                  })
                }
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
              >
                <span className="flex items-center gap-1.5">
                  {isOpen ? (
                    <CaretDownIcon size={11} className="text-muted-foreground" />
                  ) : (
                    <CaretRightIcon
                      size={11}
                      className="text-muted-foreground"
                    />
                  )}
                  <Icon
                    name={theme.icon}
                    size={13}
                    className="text-muted-foreground"
                  />
                  <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {theme.name}
                  </span>
                </span>
                {activeInTheme > 0 && (
                  <span className="rounded-full bg-accent px-1.5 py-0.5 font-mono text-[9px] font-bold text-accent-foreground">
                    {activeInTheme}
                  </span>
                )}
              </button>

              {isOpen && (
                <ul className="mt-0.5 flex flex-col gap-0.5 pl-1">
                  {cats.map((c) => (
                    <CategoryRow
                      key={c.id}
                      category={c}
                      activeOptions={active[c.id]}
                      onToggle={() => onToggle(c.id)}
                      onOption={(optId, v) => onOption(c.id, optId, v)}
                    />
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <footer className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
        <span>{categories.length} maps configured</span>
      </footer>
    </aside>
  );
}

function CategoryRow({
  category,
  activeOptions,
  onToggle,
  onOption,
}: {
  category: ApiCategory;
  activeOptions: ActiveOptions | undefined;
  onToggle: () => void;
  onOption: (optId: string, v: string | boolean) => void;
}) {
  const isActive = activeOptions !== undefined;
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className={[
          "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
          isActive ? "bg-muted" : "hover:bg-muted/60",
        ].join(" ")}
      >
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
          style={{
            backgroundColor: isActive
              ? category.paint.color
              : "transparent",
            border: `1px solid ${isActive ? category.paint.color : "var(--color-border)"}`,
            color: isActive ? "#0a0a0a" : "var(--color-muted-foreground)",
          }}
        >
          <Icon name={category.icon} size={11} weight="bold" />
        </span>
        <span className="flex-1 truncate text-[12.5px] font-medium text-foreground">
          {category.name}
        </span>
        <span
          className={[
            "h-1.5 w-1.5 shrink-0 rounded-full transition-opacity",
            isActive ? "opacity-100" : "opacity-0",
          ].join(" ")}
          style={{ backgroundColor: category.paint.color }}
        />
      </button>

      {isActive && category.options.length > 0 && (
        <div className="ml-7 mt-1 flex flex-col gap-1.5 pb-1.5">
          {category.options.map((opt) => (
            <OptionControl
              key={opt.id}
              option={opt}
              value={activeOptions[opt.id]}
              onChange={(v) => onOption(opt.id, v)}
            />
          ))}
        </div>
      )}
    </li>
  );
}

function OptionControl({
  option,
  value,
  onChange,
}: {
  option: CategoryOption;
  value: string | boolean | undefined;
  onChange: (v: string | boolean) => void;
}) {
  if (option.type === "toggle") {
    const v = (value as boolean | undefined) ?? option.default;
    return (
      <label className="flex cursor-pointer items-center justify-between text-[11px] text-muted-foreground">
        <span>{option.label}</span>
        <input
          type="checkbox"
          checked={v}
          onChange={(e) => onChange(e.target.checked)}
          className="h-3.5 w-3.5 accent-[var(--color-accent)]"
        />
      </label>
    );
  }
  const v = (value as string | undefined) ?? option.default;
  return (
    <label className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
      <span className="shrink-0">{option.label}</span>
      <select
        value={v}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 min-w-0 flex-1 rounded border border-border bg-card px-1.5 text-[11px] text-foreground outline-none focus:border-border-strong"
      >
        {option.choices.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    </label>
  );
}
