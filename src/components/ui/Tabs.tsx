"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  children?: ReactNode;
}

export function Tabs({ items, value, onChange, className, children }: TabsProps) {
  const baseId = useId();

  return (
    <div className={className}>
      <div role="tablist" aria-label="Meeting sections" className="flex items-center gap-1 border-b border-border-subtle mb-6">
        {items.map((item) => {
          const selected = item.id === value;
          return (
            <button
              key={item.id}
              id={`${baseId}-tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              onClick={() => onChange(item.id)}
              className={cn(
                "relative px-4 py-2.5 text-sm font-medium transition-colors duration-150",
                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-primary",
                selected
                  ? "text-text-primary after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-accent-primary after:rounded-full"
                  : "text-text-muted hover:text-text-secondary after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-transparent hover:after:bg-border-default"
              )}
            >
              {item.label}
              {item.count !== undefined && (
                <span className={cn("ml-2 text-[11px]", selected ? "text-text-secondary" : "text-text-muted")}>
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {items.map((item) =>
        item.id === value ? (
          <div
            key={item.id}
            id={`${baseId}-panel-${item.id}`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${item.id}`}
            tabIndex={0}
            className="focus-visible:outline-none"
          >
            {children}
          </div>
        ) : null
      )}
    </div>
  );
}

export default Tabs;