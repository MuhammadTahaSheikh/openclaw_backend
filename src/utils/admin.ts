import type { UserRole } from "../types/user.js";

export function isAdminRole(role: UserRole | string | undefined): boolean {
  return role === "admin";
}

export function getAdminEmail(): string | null {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return email || null;
}
