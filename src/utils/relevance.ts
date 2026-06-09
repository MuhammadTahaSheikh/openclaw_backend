import type { Lead } from "../types/lead.js";

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function leadSearchText(lead: Lead): string {
  return normalizeText([lead.title, lead.description ?? "", ...lead.skills].join(" "));
}

export function isLeadRelevant(lead: Lead, matchTerms: string[]): boolean {
  const text = leadSearchText(lead);

  return matchTerms.some((term) => {
    const normalizedTerm = normalizeText(term);
    if (normalizedTerm.includes(" ")) {
      return text.includes(normalizedTerm);
    }

    if (text.includes(normalizedTerm)) {
      return true;
    }

    // Match whole words for short terms (e.g. "seo", "va")
    const wordPattern = new RegExp(`\\b${normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    return wordPattern.test(text);
  });
}

export function filterRelevantLeads(leads: Lead[], matchTerms: string[]): Lead[] {
  return leads.filter((lead) => isLeadRelevant(lead, matchTerms));
}
