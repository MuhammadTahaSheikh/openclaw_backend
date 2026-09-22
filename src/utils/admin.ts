import type { UserRole } from "../types/user.js";

export function isAdminRole(role: UserRole | string | undefined): boolean {
  return role === "admin";
}

/** Admins and members can manage invites; employees cannot. */
export function canManageMembers(role: UserRole | string | undefined): boolean {
  return role === "admin" || role === "member";
}

export function getAdminEmail(): string | null {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return email || null;
}
