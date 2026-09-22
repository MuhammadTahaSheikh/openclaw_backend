import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool } from "./index.js";
import type {
  CreateMemberRequest,
  InviteDetails,
  Member,
  MemberInviteStatus,
  UpdateMemberRequest,
} from "../types/member.js";
import type { UserRole } from "../types/user.js";
import { setUserAccess } from "./users.repository.js";
import { generateInviteToken, getInviteExpiresAt } from "../utils/invite-token.js";
import { normalizeStringList, parseJsonStringArray } from "../utils/access.js";

type MemberRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string | null;
  notes: string | null;
  app_role: UserRole;
  allowed_platforms: unknown;
  allowed_categories: unknown;
  created_by: number | null;
  user_id: number | null;
  invite_status: MemberInviteStatus;
  invite_token: string | null;
  invite_expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

const MEMBER_SELECT = `
  SELECT id, name, email, phone, role, notes, app_role, allowed_platforms, allowed_categories,
         created_by, user_id, invite_status, invite_token, invite_expires_at, created_at, updated_at
  FROM members
`;

function resolveAppRole(input: { appRole?: UserRole; role?: string | null }): UserRole {
  if (input.appRole === "admin" || input.appRole === "member" || input.appRole === "employee") {
    return input.appRole;
  }
  if (input.role?.trim().toLowerCase() === "admin") return "admin";
  return "member";
}

function allowlistsForRole(
  role: UserRole,
  platforms: unknown,
  categories: unknown,
): { allowedPlatforms: string[] | null; allowedCategories: string[] | null } {
  if (role !== "employee") {
    return { allowedPlatforms: null, allowedCategories: null };
  }
  return {
    allowedPlatforms: normalizeStringList(platforms ?? []),
    allowedCategories: normalizeStringList(categories ?? []),
  };
}

function toMember(row: MemberRow): Member {
  const appRole = row.app_role ?? "member";
  const allowlists = allowlistsForRole(appRole, row.allowed_platforms, row.allowed_categories);
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    notes: row.notes,
    appRole,
    allowedPlatforms: appRole === "employee" ? allowlists.allowedPlatforms : parseJsonStringArray(row.allowed_platforms),
    allowedCategories:
      appRole === "employee" ? allowlists.allowedCategories : parseJsonStringArray(row.allowed_categories),
    createdBy: row.created_by,
    userId: row.user_id,
    inviteStatus: row.invite_status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findMemberByUserId(userId: number): Promise<Member | null> {
  const db = getPool();
  const [rows] = await db.execute<MemberRow[]>(`${MEMBER_SELECT} WHERE user_id = ? LIMIT 1`, [userId]);
  return rows[0] ? toMember(rows[0]) : null;
}

export async function findMemberByEmail(email: string): Promise<Member | null> {
  const db = getPool();
  const [rows] = await db.execute<MemberRow[]>(`${MEMBER_SELECT} WHERE email = ? LIMIT 1`, [
    email.toLowerCase().trim(),
  ]);

  const row = rows[0];
  return row ? toMember(row) : null;
}

export async function listMembers(): Promise<Member[]> {
  const db = getPool();
  const [rows] = await db.execute<MemberRow[]>(`${MEMBER_SELECT} ORDER BY created_at DESC`);

  return rows.map(toMember);
}

export async function createMemberWithInvite(
  input: CreateMemberRequest,
  createdBy: number,
): Promise<{ member: Member; inviteToken: string }> {
  const db = getPool();
  const inviteToken = generateInviteToken();
  const inviteExpiresAt = getInviteExpiresAt();
  const appRole = resolveAppRole(input);
  const allowlists = allowlistsForRole(appRole, input.allowedPlatforms, input.allowedCategories);

  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO members
      (name, email, phone, role, notes, app_role, allowed_platforms, allowed_categories,
       created_by, invite_token, invite_expires_at, invite_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      input.name.trim(),
      input.email.toLowerCase().trim(),
      input.phone?.trim() || null,
      input.role?.trim() || null,
      input.notes?.trim() || null,
      appRole,
      appRole === "employee" ? JSON.stringify(allowlists.allowedPlatforms) : null,
      appRole === "employee" ? JSON.stringify(allowlists.allowedCategories) : null,
      createdBy,
      inviteToken,
      inviteExpiresAt,
    ],
  );

  const [rows] = await db.execute<MemberRow[]>(`${MEMBER_SELECT} WHERE id = ?`, [result.insertId]);

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
  const [rows] = await db.execute<MemberRow[]>(`${MEMBER_SELECT} WHERE invite_token = ? LIMIT 1`, [token]);

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

  const [updated] = await db.execute<MemberRow[]>(`${MEMBER_SELECT} WHERE id = ?`, [row.id]);

  const member = updated[0];
  if (!member) throw new Error("Failed to accept invite");

  const mapped = toMember(member);
  await setUserAccess(userId, {
    role: mapped.appRole,
    allowedPlatforms: mapped.allowedPlatforms,
    allowedCategories: mapped.allowedCategories,
  });

  return mapped;
}

export async function findMemberById(id: number): Promise<Member | null> {
  const db = getPool();
  const [rows] = await db.execute<MemberRow[]>(`${MEMBER_SELECT} WHERE id = ? LIMIT 1`, [id]);

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

export async function updateMember(id: number, input: UpdateMemberRequest): Promise<Member | null> {
  const db = getPool();
  const existing = await findMemberById(id);
  if (!existing) return null;

  const name = input.name !== undefined ? input.name.trim() : existing.name;
  const phone = input.phone !== undefined ? input.phone?.trim() || null : existing.phone;
  const role = input.role !== undefined ? input.role?.trim() || null : existing.role;
  const notes = input.notes !== undefined ? input.notes?.trim() || null : existing.notes;
  const appRole = resolveAppRole({
    appRole: input.appRole ?? existing.appRole,
    role,
  });
  const allowlists = allowlistsForRole(
    appRole,
    input.allowedPlatforms !== undefined ? input.allowedPlatforms : existing.allowedPlatforms,
    input.allowedCategories !== undefined ? input.allowedCategories : existing.allowedCategories,
  );

  let email = existing.email;
  if (input.email !== undefined) {
    if (existing.inviteStatus === "accepted" || existing.userId) {
      throw new Error("Cannot change email for a member who already has an account");
    }
    email = input.email.toLowerCase().trim();
    if (email !== existing.email) {
      const duplicate = await findMemberByEmail(email);
      if (duplicate && duplicate.id !== id) {
        throw new Error("A member with this email already exists");
      }
    }
  }

  await db.execute(
    `UPDATE members
     SET name = ?, email = ?, phone = ?, role = ?, notes = ?,
         app_role = ?, allowed_platforms = ?, allowed_categories = ?
     WHERE id = ?`,
    [
      name,
      email,
      phone,
      role,
      notes,
      appRole,
      appRole === "employee" ? JSON.stringify(allowlists.allowedPlatforms) : null,
      appRole === "employee" ? JSON.stringify(allowlists.allowedCategories) : null,
      id,
    ],
  );

  if (existing.userId) {
    await setUserAccess(existing.userId, {
      role: appRole,
      allowedPlatforms: allowlists.allowedPlatforms,
      allowedCategories: allowlists.allowedCategories,
    });
  }

  return findMemberById(id);
}

export async function deleteMember(id: number): Promise<boolean> {
  const db = getPool();
  const existing = await findMemberById(id);
  if (!existing) return false;

  const userId = existing.userId;

  await db.execute("DELETE FROM members WHERE id = ?", [id]);

  if (userId) {
    await db.execute("DELETE FROM users WHERE id = ?", [userId]);
  }

  return true;
}
