import crypto from "crypto";

export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function getInviteExpiresAt(): Date {
  const hours = Number(process.env.INVITE_EXPIRES_HOURS ?? 72);
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export function getInviteUrl(token: string): string {
  const base = (process.env.FRONTEND_URL ?? "http://localhost:5173").replace(/\/$/, "");
  return `${base}/invite/${token}`;
}
