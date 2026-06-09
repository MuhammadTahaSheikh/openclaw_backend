import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool } from "./index.js";
import type { CreateMemberRequest, InviteDetails, Member, MemberInviteStatus } from "../types/member.js";
import { generateInviteToken, getInviteExpiresAt } from "../utils/invite-token.js";

type MemberRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string | null;
  notes: string | null;
  created_by: number | null;
  user_id: number | null;
  invite_status: MemberInviteStatus;
  invite_token: string | null;
  invite_expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

function toMember(row: MemberRow): Member {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    notes: row.notes,
    createdBy: row.created_by,
    userId: row.user_id,
    inviteStatus: row.invite_status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findMemberByEmail(email: string): Promise<Member | null> {
  const db = getPool();
  const [rows] = await db.execute<MemberRow[]>(
    `SELECT id, name, email, phone, role, notes, created_by, user_id, invite_status,
            invite_token, invite_expires_at, created_at, updated_at
     FROM members WHERE email = ? LIMIT 1`,
    [email.toLowerCase().trim()],
  );

  const row = rows[0];
  return row ? toMember(row) : null;
}

export async function listMembers(): Promise<Member[]> {
  const db = getPool();
  const [rows] = await db.execute<MemberRow[]>(
    `SELECT id, name, email, phone, role, notes, created_by, user_id, invite_status,
            invite_token, invite_expires_at, created_at, updated_at
     FROM members ORDER BY created_at DESC`,
  );

  return rows.map(toMember);
}

export async function createMemberWithInvite(
  input: CreateMemberRequest,
  createdBy: number,
): Promise<{ member: Member; inviteToken: string }> {
  const db = getPool();
  const inviteToken = generateInviteToken();
  const inviteExpiresAt = getInviteExpiresAt();

  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO members (name, email, phone, role, notes, created_by, invite_token, invite_expires_at, invite_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      input.name.trim(),
      input.email.toLowerCase().trim(),
      input.phone?.trim() || null,
      input.role?.trim() || null,
      input.notes?.trim() || null,
      createdBy,
      inviteToken,
      inviteExpiresAt,
    ],
  );

  const [rows] = await db.execute<MemberRow[]>(
    `SELECT id, name, email, phone, role, notes, created_by, user_id, invite_status,
            invite_token, invite_expires_at, created_at, updated_at
     FROM members WHERE id = ?`,
    [result.insertId],
  );

  const row = rows[0];
  if (!row) throw new Error("Failed to create member");

  return { member: toMember(row), inviteToken };
}

export async function findInviteByToken(token: string): Promise<InviteDetails | null> {
  const db = getPool();
  const [rows] = await db.execute<MemberRow[]>(
    `SELECT name, email, invite_expires_at, invite_status, user_id
     FROM members WHERE invite_token = ? LIMIT 1`,
    [token],
  );

  const row = rows[0];
  if (!row || row.invite_status !== "pending" || row.user_id) return null;

  if (!row.invite_expires_at || row.invite_expires_at.getTime() < Date.now()) {
    return null;
  }

  return {
    name: row.name,
    email: row.email,
    expiresAt: row.invite_expires_at.toISOString(),
  };
}

export async function acceptInvite(token: string, userId: number): Promise<Member> {
  const db = getPool();
  const [rows] = await db.execute<MemberRow[]>(
    `SELECT id, name, email, phone, role, notes, created_by, user_id, invite_status,
            invite_token, invite_expires_at, created_at, updated_at
     FROM members WHERE invite_token = ? LIMIT 1`,
    [token],
  );

  const row = rows[0];
  if (!row || row.invite_status !== "pending" || row.user_id) {
    throw new Error("Invalid or expired invite");
  }

  if (!row.invite_expires_at || row.invite_expires_at.getTime() < Date.now()) {
    throw new Error("Invite has expired");
  }

  await db.execute(
    `UPDATE members
     SET user_id = ?, invite_status = 'accepted', invite_token = NULL, invite_expires_at = NULL
     WHERE id = ?`,
    [userId, row.id],
  );

  const [updated] = await db.execute<MemberRow[]>(
    `SELECT id, name, email, phone, role, notes, created_by, user_id, invite_status,
            invite_token, invite_expires_at, created_at, updated_at
     FROM members WHERE id = ?`,
    [row.id],
  );

  const member = updated[0];
  if (!member) throw new Error("Failed to accept invite");

  return toMember(member);
}

export async function findMemberById(id: number): Promise<Member | null> {
  const db = getPool();
  const [rows] = await db.execute<MemberRow[]>(
    `SELECT id, name, email, phone, role, notes, created_by, user_id, invite_status,
            invite_token, invite_expires_at, created_at, updated_at
     FROM members WHERE id = ? LIMIT 1`,
    [id],
  );

  const row = rows[0];
  return row ? toMember(row) : null;
}

export async function refreshMemberInvite(memberId: number): Promise<{ member: Member; inviteToken: string }> {
  const db = getPool();
  const member = await findMemberById(memberId);

  if (!member) throw new Error("Member not found");
  if (member.userId || member.inviteStatus === "accepted") {
    throw new Error("This member already has an account");
  }

  const inviteToken = generateInviteToken();
  const inviteExpiresAt = getInviteExpiresAt();

  await db.execute(
    `UPDATE members
     SET invite_token = ?, invite_expires_at = ?, invite_status = 'pending'
     WHERE id = ?`,
    [inviteToken, inviteExpiresAt, memberId],
  );

  const updated = await findMemberById(memberId);
  if (!updated) throw new Error("Failed to refresh invite");

  return { member: updated, inviteToken };
}
