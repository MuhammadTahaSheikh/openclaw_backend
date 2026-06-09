import type { Lead } from "../types/lead.js";

export type DateRange = {
  startDate?: string;
  endDate?: string;
};

function parseDateOnly(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function parsePostedDate(postedAt: string | null): Date | null {
  if (!postedAt) return null;

  const match = postedAt.match(/(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;

  return parseDateOnly(match[1]);
}

export function validateDateRange(range: DateRange): void {
  const { startDate, endDate } = range;

  if (startDate && !parseDateOnly(startDate)) {
    throw new Error("startDate must be a valid YYYY-MM-DD date");
  }

  if (endDate && !parseDateOnly(endDate)) {
    throw new Error("endDate must be a valid YYYY-MM-DD date");
  }

  if (startDate && endDate) {
    const start = parseDateOnly(startDate)!;
    const end = parseDateOnly(endDate)!;
    if (start > end) {
      throw new Error("startDate must be on or before endDate");
    }
  }
}

function isOnOrAfter(date: Date, boundary: Date): boolean {
  return date.getTime() >= boundary.getTime();
}

function isOnOrBefore(date: Date, boundary: Date): boolean {
  return date.getTime() <= boundary.getTime();
}

export function isLeadInDateRange(
  lead: Lead,
  range: DateRange,
): boolean {
  const { startDate, endDate } = range;
  if (!startDate && !endDate) return true;

  const posted = parsePostedDate(lead.postedAt);
  if (!posted) return false;

  if (startDate) {
    const start = parseDateOnly(startDate)!;
    if (!isOnOrAfter(posted, start)) return false;
  }

  if (endDate) {
    const end = parseDateOnly(endDate)!;
    if (!isOnOrBefore(posted, end)) return false;
  }

  return true;
}

export function filterLeadsByDateRange(leads: Lead[], range: DateRange): Lead[] {
  if (!range.startDate && !range.endDate) return leads;
  return leads.filter((lead) => isLeadInDateRange(lead, range));
}
