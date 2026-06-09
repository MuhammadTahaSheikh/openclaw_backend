import nodemailer from "nodemailer";
import { Resend } from "resend";

function buildInviteEmail(input: { name: string; inviteUrl: string }) {
  const expiresHours = process.env.INVITE_EXPIRES_HOURS ?? 72;
  const supportEmail = process.env.SUPPORT_EMAIL ?? process.env.INVITE_REPLY_TO;

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>You're invited to OpenClaw</h2>
      <p>Hi ${input.name},</p>
      <p>You've been added as a team member. Click the button below to set your password and sign in.</p>
      <p style="margin: 2rem 0;">
        <a href="${input.inviteUrl}" style="background: #3b82f6; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Set your password
        </a>
      </p>
      <p style="color: #64748b; font-size: 14px;">
        This link expires in ${expiresHours} hours.
        If you didn't expect this email, you can ignore it.
      </p>
      <p style="color: #64748b; font-size: 12px; word-break: break-all;">
        Or copy this link: ${input.inviteUrl}
      </p>
      ${supportEmail ? `<p style="color: #64748b; font-size: 12px;">Questions? Contact ${supportEmail}</p>` : ""}
    </div>
  `;

  const text = `Hi ${input.name},\n\nSet your password here: ${input.inviteUrl}\n\nThis link expires in ${expiresHours} hours.`;

  return { html, text, subject: "Set up your OpenClaw account" };
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function isEmailConfigured(): boolean {
  return isResendConfigured() || isSmtpConfigured();
}

function getFromAddress(): string {
  return process.env.EMAIL_FROM ?? process.env.SMTP_FROM ?? "OpenClaw <onboarding@resend.dev>";
}

function getSmtpTransporter() {
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE === "true";

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendViaResend(input: {
  to: string;
  name: string;
  inviteUrl: string;
}): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { html, text, subject } = buildInviteEmail(input);
  const replyTo = process.env.INVITE_REPLY_TO ?? process.env.SUPPORT_EMAIL;

  const { error } = await resend.emails.send({
    from: getFromAddress(),
    to: input.to,
    subject,
    html,
    text,
    ...(replyTo ? { replyTo } : {}),
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function sendViaSmtp(input: {
  to: string;
  name: string;
  inviteUrl: string;
}): Promise<void> {
  const { html, text, subject } = buildInviteEmail(input);
  const replyTo = process.env.INVITE_REPLY_TO ?? process.env.SUPPORT_EMAIL;

  const transporter = getSmtpTransporter();
  await transporter.sendMail({
    from: getFromAddress(),
    to: input.to,
    subject,
    html,
    text,
    ...(replyTo ? { replyTo } : {}),
  });
}

export async function sendMemberInvite(input: {
  to: string;
  name: string;
  inviteUrl: string;
}): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(`[email] Email not configured — invite link for ${input.to}:`);
    console.log(`[email] ${input.inviteUrl}`);
    return;
  }

  if (isResendConfigured()) {
    await sendViaResend(input);
    console.log(`[email] Invite sent via Resend to ${input.to}`);
    return;
  }

  await sendViaSmtp(input);
  console.log(`[email] Invite sent via SMTP to ${input.to}`);
}
