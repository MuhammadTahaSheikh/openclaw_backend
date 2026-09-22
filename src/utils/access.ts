import type { User, UserRole } from "../types/user.js";

export function isEmployeeRole(role: UserRole | string | undefined): boolean {
  return role === "employee";
}

export function parseJsonStringArray(value: unknown): string[] | null {
  if (value == null) return null;
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map(String).filter(Boolean);
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

export function canAccessPlatform(user: Pick<User, "role" | "allowedPlatforms">, platformId: string): boolean {
  if (!isEmployeeRole(user.role)) return true;
  return (user.allowedPlatforms ?? []).includes(platformId);
}

export function canAccessCategory(user: Pick<User, "role" | "allowedCategories">, categoryId: string): boolean {
  if (!isEmployeeRole(user.role)) return true;
  return (user.allowedCategories ?? []).includes(categoryId);
}

export function filterByAllowlist<T extends { id: string }>(
  user: Pick<User, "role" | "allowedPlatforms" | "allowedCategories">,
  items: T[],
  kind: "platform" | "category",
): T[] {
  if (!isEmployeeRole(user.role)) return items;
  const allowed = kind === "platform" ? user.allowedPlatforms ?? [] : user.allowedCategories ?? [];
  const allowedSet = new Set(allowed);
  return items.filter((item) => allowedSet.has(item.id));
}
