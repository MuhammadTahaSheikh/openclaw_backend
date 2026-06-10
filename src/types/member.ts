export type MemberInviteStatus = "pending" | "accepted";

export type Member = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string | null;
  notes: string | null;
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
};

export type UpdateMemberRequest = {
  name?: string;
  email?: string;
  phone?: string | null;
  role?: string | null;
  notes?: string | null;
};

export type InviteDetails = {
  email: string;
  name: string;
  expiresAt: string;
};
