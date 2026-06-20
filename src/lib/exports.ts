import jsPDF from "jspdf";

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

export function exportToPDF(meeting: Meeting) {
  const doc = new jsPDF();
  const margin = 20;
  const contentWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 10;

  const checkPage = () => {
    if (y > 270) {
      doc.addPage();
      y = 10;
    }
  };

  // Summary section
  if (meeting.summary) {
    checkPage();
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 180);
    doc.text("Summary:", margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(meeting.summary, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 4;
  }

  // Key Decisions
  if (meeting.key_decisions.length > 0) {
    checkPage();
    doc.setFontSize(11);
    doc.setTextColor(128, 0, 128);
    doc.text("Key Decisions:", margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    meeting.key_decisions.forEach((d) => {
      checkPage();
      const t = typeof d.decision_text === "string" ? d.decision_text : (d.decision_text as { decision?: string })?.decision || "Decision";
      const lines = doc.splitTextToSize(`- ${t}`, contentWidth);
      doc.text(lines, margin + 2, y);
      y += lines.length * 5 + 2;
    });
    y += 3;
  }

  // Action Items
  if (meeting.action_items.length > 0) {
    checkPage();
    doc.setFontSize(11);
    doc.setTextColor(0, 128, 0);
    doc.text("Action Items:", margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    meeting.action_items.forEach((item) => {
      checkPage();
      const done = item.is_completed ? "[x]" : "[ ]";
      let line = `${done} [${item.owner_name}] ${item.task_description}`;
      if (item.due_date) {
        line += ` (due: ${new Date(item.due_date).toLocaleDateString()})`;
      }
      const lines = doc.splitTextToSize(line, contentWidth);
      if (item.is_completed) {
        doc.setTextColor(100, 100, 100);
      } else {
        doc.setTextColor(0, 0, 0);
      }
      doc.text(lines, margin + 2, y);
      y += lines.length * 5 + 2;
    });
  }

  const filename = `${(meeting.title || "meeting").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.pdf`;
  doc.save(filename);
}

export function downloadAsText(meeting: Meeting) {
  let text = `${meeting.title}\n`;
  text += `${new Date(meeting.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}\n`;
  text += `${meeting.action_items.filter((a) => a.is_completed).length}/${meeting.action_items.length} tasks completed\n\n`;

  if (meeting.summary) {
    text += `--- SUMMARY ---\n\n${meeting.summary}\n\n`;
  }

  if (meeting.key_decisions.length > 0) {
    text += `--- KEY DECISIONS ---\n\n`;
    meeting.key_decisions.forEach((d) => {
      const t = typeof d.decision_text === "string" ? d.decision_text : (d.decision_text as { decision?: string })?.decision || "Decision";
      text += `- ${t}\n`;
    });
    text += "\n";
  }

  if (meeting.action_items.length > 0) {
    text += `--- ACTION ITEMS ---\n\n`;
    meeting.action_items.forEach((item) => {
      const done = item.is_completed ? "[x]" : "[ ]";
      const due = item.due_date ? ` (due ${new Date(item.due_date).toLocaleDateString()})` : "";
      text += `${done} [${item.owner_name}] ${item.task_description}${due}\n`;
    });
    text += "\n";
  }

  text += "---\nExported from MeetingMind";
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(meeting.title || "meeting").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadAsMarkdown(meeting: Meeting) {
  let md = `# ${meeting.title || "Untitled Meeting"}\n\n`;
  md += `**Date:** ${new Date(meeting.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}\n`;
  md += `**Tasks:** ${meeting.action_items.filter((a) => a.is_completed).length}/${meeting.action_items.length} completed\n\n`;

  if (meeting.summary) {
    md += `## Summary\n\n${meeting.summary}\n\n`;
  }

  if (meeting.key_decisions.length > 0) {
    md += `## Key Decisions\n\n`;
    meeting.key_decisions.forEach((d) => {
      const t = typeof d.decision_text === "string" ? d.decision_text : (d.decision_text as { decision?: string })?.decision || "Decision";
      md += `- ${t}\n`;
    });
    md += "\n";
  }

  if (meeting.action_items.length > 0) {
    md += `## Action Items\n\n`;
    meeting.action_items.forEach((item) => {
      const done = item.is_completed ? "x" : " ";
      const due = item.due_date ? ` *(due ${new Date(item.due_date).toLocaleDateString()})*` : "";
      md += `- [${done}] **${item.owner_name}**: ${item.task_description}${due}\n`;
    });
    md += "\n";
  }

  md += `---\n*Exported from MeetingMind*\n`;

  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(meeting.title || "meeting").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export function copyShareFormat(meeting: Meeting): string {
  const date = new Date(meeting.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const completed = meeting.action_items.filter((a) => a.is_completed).length;
  const total = meeting.action_items.length;

  let text = `*${meeting.title || "Untitled Meeting"}*\n`;
  text += `${date} · ${completed}/${total} tasks done\n\n`;

  if (meeting.summary) {
    text += `${meeting.summary}\n\n`;
  }

  if (meeting.key_decisions.length > 0) {
    text += `*Key Decisions:*\n`;
    meeting.key_decisions.forEach((d) => {
      const t = typeof d.decision_text === "string" ? d.decision_text : (d.decision_text as { decision?: string })?.decision || "Decision";
      text += `> ${t}\n`;
    });
    text += "\n";
  }

  if (meeting.action_items.length > 0) {
    text += `*Action Items:*\n`;
    meeting.action_items.forEach((item) => {
      const icon = item.is_completed ? "✅" : "⬜";
      const due = item.due_date ? ` (due ${new Date(item.due_date).toLocaleDateString()})` : "";
      text += `${icon} *${item.owner_name}*: ${item.task_description}${due}\n`;
    });
  }

  return text;
}
