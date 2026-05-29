"use client";

import { useState } from "react";
import { DEFAULT_TEMPLATES, type MeetingTemplate } from "@/lib/templates";

interface TemplateSelectorProps {
  selectedTemplate: string | null;
  onSelect: (name: string | null) => void;
}

export default function TemplateSelector({ selectedTemplate, onSelect }: TemplateSelectorProps) {
  const templates: MeetingTemplate[] = DEFAULT_TEMPLATES;

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-text-secondary mb-2">
        Meeting Type
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {templates.map((t) => {
          const isSelected = selectedTemplate === t.name;
          return (
            <button
              key={t.name}
              onClick={() => onSelect(isSelected ? null : t.name)}
              className={`text-left px-4 py-3 rounded-xl border transition-all duration-200 ${
                isSelected
                  ? "border-accent-primary bg-[rgba(79,142,247,0.08)]"
                  : "border-border-subtle bg-bg-surface hover:border-border-default"
              }`}
            >
              <span className="text-lg mb-1 block">{t.icon}</span>
              <span className="text-sm font-semibold text-text-primary">{t.displayName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
