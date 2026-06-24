"use client";

import { DEFAULT_TEMPLATES, type MeetingTemplate } from "@/lib/templates";

interface TemplateSelectorProps {
  selectedTemplate: string | null;
  onSelect: (name: string | null) => void;
}

export default function TemplateSelector({ selectedTemplate, onSelect }: TemplateSelectorProps) {
  const templates: MeetingTemplate[] = DEFAULT_TEMPLATES;

  return (
    <div className="mb-6">
      <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
        Meeting Type
      </label>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
        {templates.map((t) => {
          const isSelected = selectedTemplate === t.name;
          return (
            <button
              key={t.name}
              onClick={() => onSelect(isSelected ? null : t.name)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-150 ${
                isSelected
                  ? "bg-accent-primary text-white"
                  : "bg-bg-elevated text-text-secondary border border-border-subtle hover:border-border-default hover:text-text-primary"
              }`}
            >
              <span className="text-base">{t.icon}</span>
              <span>{t.displayName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
