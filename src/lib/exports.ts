import jsPDF from "jspdf";
import { formatLocalDate, formatShortDate } from "./dates";

export interface ActionItem {
  id: string;
  owner_name: string;
  task_description: string;
  due_date: string | null;
  is_completed: boolean;
}

export interface KeyDecision {
  id: string;
  decision_text: string | { decision?: string; context?: string };
}

export interface Meeting {
  id: string;
  title: string;
  summary: string;
  created_at: string;
  action_items: ActionItem[];
  key_decisions: KeyDecision[];
}

interface ExportData {
  title: string;
  date: string;
  summary: string;
  completedTasks: number;
  totalTasks: number;
  decisions: string[];
  actionItems: Array<{
    done: boolean;
    owner: string;
    task: string;
    dueDate: string | null;
  }>;
}

function resolveDecisionText(d: KeyDecision): string {
  if (typeof d.decision_text === "string") return d.decision_text;
  return (d.decision_text as { decision?: string })?.decision || "Decision";
}

function buildExportData(meeting: Meeting): ExportData {
  return {
    title: meeting.title || "Untitled Meeting",
    date: formatLocalDate(meeting.created_at),
    summary: meeting.summary,
    completedTasks: meeting.action_items.filter((a) => a.is_completed).length,
    totalTasks: meeting.action_items.length,
    decisions: meeting.key_decisions.map(resolveDecisionText),
    actionItems: meeting.action_items.map((item) => ({
      done: item.is_completed,
      owner: item.owner_name,
      task: item.task_description,
      dueDate: item.due_date,
    })),
  };
}

function sanitizeFilename(title: string): string {
  return (title || "meeting").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportToPDF(meeting: Meeting) {
  const data = buildExportData(meeting);
  const doc = new jsPDF();
  const margin = 20;
  const contentWidth = doc.internal.pageSize.getWidth() - margin * 2;
  let y = 10;

  const checkPage = () => {
    if (y > 270) {
      doc.addPage();
      y = 10;
    }
  };

  const writeLines = (lines: string[], indent = 0) => {
    for (const line of lines) {
      checkPage();
      doc.text(line, margin + indent, y);
      y += 5;
    }
  };

  doc.setFontSize(16);
  doc.setTextColor(79, 142, 247);
  doc.text(data.title, margin, y);
  y += 7;

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(data.date, margin, y);
  y += 6;

  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text("Exported from MeetingMind", margin, y);
  y += 8;

  if (data.summary) {
    checkPage();
    doc.setFontSize(11);
    doc.setTextColor(79, 142, 247);
    doc.text("Summary", margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    writeLines(doc.splitTextToSize(data.summary, contentWidth));
    y += 4;
  }

  if (data.decisions.length > 0) {
    checkPage();
    doc.setFontSize(11);
    doc.setTextColor(139, 92, 246);
    doc.text("Key Decisions", margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    data.decisions.forEach((t) => {
      writeLines(doc.splitTextToSize(`- ${t}`, contentWidth), 2);
      y += 2;
    });
    y += 3;
  }

  if (data.actionItems.length > 0) {
    checkPage();
    doc.setFontSize(11);
    doc.setTextColor(52, 211, 153);
    doc.text("Action Items", margin, y);
    y += 6;
    doc.setFontSize(9);
    data.actionItems.forEach((item) => {
      const done = item.done ? "[x]" : "[ ]";
      let line = `${done} [${item.owner}] ${item.task}`;
      if (item.dueDate) {
        line += ` (due: ${formatShortDate(item.dueDate)})`;
      }
      doc.setTextColor(item.done ? 100 : 0, item.done ? 100 : 0, item.done ? 100 : 0);
      writeLines(doc.splitTextToSize(line, contentWidth), 2);
      y += 2;
    });
  }

  doc.save(`${sanitizeFilename(data.title)}.pdf`);
}

export function downloadAsText(meeting: Meeting) {
  const data = buildExportData(meeting);
  let text = `${data.title}\n`;
  text += `${data.date}\n`;
  text += `${data.completedTasks}/${data.totalTasks} tasks completed\n\n`;

  if (data.summary) {
    text += `--- SUMMARY ---\n\n${data.summary}\n\n`;
  }

  if (data.decisions.length > 0) {
    text += `--- KEY DECISIONS ---\n\n`;
    data.decisions.forEach((t) => {
      text += `- ${t}\n`;
    });
    text += "\n";
  }

  if (data.actionItems.length > 0) {
    text += `--- ACTION ITEMS ---\n\n`;
    data.actionItems.forEach((item) => {
      const done = item.done ? "[x]" : "[ ]";
      const due = item.dueDate ? ` (due ${formatShortDate(item.dueDate)})` : "";
      text += `${done} [${item.owner}] ${item.task}${due}\n`;
    });
    text += "\n";
  }

  text += "---\nExported from MeetingMind";
  downloadBlob(new Blob([text], { type: "text/plain" }), `${sanitizeFilename(data.title)}.txt`);
}

export function downloadAsMarkdown(meeting: Meeting) {
  const data = buildExportData(meeting);
  let md = `# ${data.title}\n\n`;
  md += `**Date:** ${data.date}\n`;
  md += `**Tasks:** ${data.completedTasks}/${data.totalTasks} completed\n\n`;

  if (data.summary) {
    md += `## Summary\n\n${data.summary}\n\n`;
  }

  if (data.decisions.length > 0) {
    md += `## Key Decisions\n\n`;
    data.decisions.forEach((t) => {
      md += `- ${t}\n`;
    });
    md += "\n";
  }

  if (data.actionItems.length > 0) {
    md += `## Action Items\n\n`;
    data.actionItems.forEach((item) => {
      const done = item.done ? "x" : " ";
      const due = item.dueDate ? ` *(due ${formatShortDate(item.dueDate)})*` : "";
      md += `- [${done}] **${item.owner}**: ${item.task}${due}\n`;
    });
    md += "\n";
  }

  md += `---\n*Exported from MeetingMind*\n`;
  downloadBlob(new Blob([md], { type: "text/markdown" }), `${sanitizeFilename(data.title)}.md`);
}

export function copyShareFormat(meeting: Meeting): string {
  const data = buildExportData(meeting);

  let text = `*${data.title}*\n`;
  text += `${data.date} \u00B7 ${data.completedTasks}/${data.totalTasks} tasks done\n\n`;

  if (data.summary) {
    text += `${data.summary}\n\n`;
  }

  if (data.decisions.length > 0) {
    text += `*Key Decisions:*\n`;
    data.decisions.forEach((t) => {
      text += `> ${t}\n`;
    });
    text += "\n";
  }

  if (data.actionItems.length > 0) {
    text += `*Action Items:*\n`;
    data.actionItems.forEach((item) => {
      const icon = item.done ? "\u2705" : "\u2B1C";
      const due = item.dueDate ? ` (due ${formatShortDate(item.dueDate)})` : "";
      text += `${icon} *${item.owner}*: ${item.task}${due}\n`;
    });
  }

  return text;
}
