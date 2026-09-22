import type { UserRole } from "./user.js";

export type MemberInviteStatus = "pending" | "accepted";

export type Member = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string | null;
  notes: string | null;
  appRole: UserRole;
  allowedPlatforms: string[] | null;
  allowedCategories: string[] | null;
  createdBy: number | null;
  userId: number | null;
  inviteStatus: MemberInviteStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateMemberRequest = {
  name: string;
  email: string;
  phone?: string;
  role?: string;
  notes?: string;
  appRole?: UserRole;
  allowedPlatforms?: string[];
  allowedCategories?: string[];
};

export type UpdateMemberRequest = {
  name?: string;
  email?: string;
  phone?: string | null;
  role?: string | null;
  notes?: string | null;
  appRole?: UserRole;
  allowedPlatforms?: string[] | null;
  allowedCategories?: string[] | null;
};

export type InviteDetails = {
  email: string;
  name: string;
  expiresAt: string;
};
