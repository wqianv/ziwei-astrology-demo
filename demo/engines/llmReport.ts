import { ReportSectionId, reportSectionSchema } from "./interpretation";

export type ParsedLLMReport = {
  intro: string;
  sections: Partial<Record<ReportSectionId, string>>;
  unmatched: string;
};

export function parseLLMMarkdown(markdown: string): ParsedLLMReport {
  const lines = markdown.split(/\r?\n/);
  const sections: Partial<Record<ReportSectionId, string>> = {};
  const intro: string[] = [];
  let currentSection: ReportSectionId | undefined;
  let matchedAnySection = false;

  lines.forEach((line) => {
    const matchedSection = matchSectionTitle(line);

    if (matchedSection) {
      currentSection = matchedSection;
      matchedAnySection = true;
      sections[currentSection] = sections[currentSection] || "";
      return;
    }

    if (currentSection) {
      sections[currentSection] = `${sections[currentSection] || ""}${line}\n`;
    } else {
      intro.push(line);
    }
  });

  Object.entries(sections).forEach(([id, content]) => {
    sections[id as ReportSectionId] = content.trim();
  });

  return {
    intro: intro.join("\n").trim(),
    sections,
    unmatched: matchedAnySection ? "" : markdown.trim(),
  };
}

export function hasParsedLLMSections(report: ParsedLLMReport): boolean {
  return reportSectionSchema.some((section) => Boolean(report.sections[section.id]));
}

function matchSectionTitle(line: string): ReportSectionId | undefined {
  const normalizedLine = normalizeHeading(line);

  if (!normalizedLine) {
    return undefined;
  }

  return reportSectionSchema.find((section) => {
    const normalizedTitle = normalizeHeading(section.title);

    return (
      normalizedLine === normalizedTitle ||
      normalizedLine.includes(normalizedTitle) ||
      normalizedTitle.includes(normalizedLine)
    );
  })?.id;
}

function normalizeHeading(value: string): string {
  return value
    .trim()
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[-*+]\s*/, "")
    .replace(/^\d+[\.\)、)]\s*/, "")
    .replace(/^[一二三四五六七八九十]+[、\.\)]\s*/, "")
    .replace(/[*_`~]/g, "")
    .replace(/[：:]\s*$/, "")
    .replace(/[\s/／｜|·・\-—–]+/g, "")
    .replace(/[，,。.;；]/g, "")
    .toLowerCase();
}
