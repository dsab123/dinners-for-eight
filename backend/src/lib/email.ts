const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const FROM_EMAIL = process.env.FROM_EMAIL!;

async function sendEmail(params: {
  to: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, ...params }),
  });

  if (!res.ok) {
    throw new Error(`Resend API error (${res.status}): ${await res.text()}`);
  }
}

export async function sendMagicLinkEmail(
  toEmail: string,
  fullName: string,
  link: string
): Promise<void> {
  const firstName = fullName.split(" ")[0] || fullName;

  const html = `
    <p>Hi ${escapeHtml(firstName)},</p>
    <p>Tap the link below to sign in to Dinners for Eight. It expires in 15 minutes.</p>
    <p><a href="${link}">Sign in to Dinners for Eight</a></p>
    <p>If you didn't request this, you can ignore this email.</p>
  `;
  const text = `Hi ${firstName},\n\nSign in to Dinners for Eight using this link (expires in 15 minutes):\n${link}\n\nIf you didn't request this, you can ignore this email.`;

  await sendEmail({
    to: [toEmail],
    subject: "Your sign-in link for Dinners for Eight",
    html,
    text,
  });
}

export interface GroupEmailInput {
  /** Everyone in the group: the host plus their assigned guests. */
  recipients: string[];
  hostName: string;
  hostAddress: string;
  /** First names (or full names) of everyone in the group, for the intro. */
  memberNames: string[];
  /** Human-readable dinner date (e.g. "July 19, 2026"), or "" if not set. */
  eventDate: string;
  /** Admin-editable subject override. "" uses the built-in default. */
  emailSubject: string;
  /** Admin-editable body override. "" uses the built-in default. */
  emailBody: string;
}

/**
 * Kicks off a coordination thread for one matched group by emailing the host
 * and all their guests together (all on the To line, so a reply-all reaches
 * everyone). We only start the thread — we don't track replies.
 */
export async function sendGroupEmail(input: GroupEmailInput): Promise<void> {
  const { recipients, hostName, hostAddress, memberNames, emailSubject, emailBody } = input;
  const eventDate = input.eventDate.trim();

  const rosterHtml = memberNames.map(escapeHtml).join(", ");
  const rosterText = memberNames.join(", ");

  // With a set date, tell everyone when; otherwise fall back to asking them to
  // pick one among themselves.
  const defaultSubject = eventDate
    ? `Your Dinners for Eight group — on ${eventDate}`
    : "Your Dinners for Eight group — let's find a date";
  const whenHtml = eventDate
    ? `<p>Your dinner is <strong>on ${escapeHtml(eventDate)}</strong>. Just
       <strong>reply all</strong> to this email to sort out who's bringing what.
       Enjoy the meal together!</p>`
    : `<p>Just <strong>reply all</strong> to this email to pick a date and sort
       out who's bringing what. Enjoy the meal together!</p>`;
  const whenText = eventDate
    ? `Your dinner is on ${eventDate}. Just reply all to this email to sort out who's bringing what. Enjoy the meal together!`
    : `Just reply all to this email to pick a date and sort out who's bringing what. Enjoy the meal together!`;

  const defaultHtml = `
    <p>Hi everyone,</p>
    <p>You've been matched for <strong>Dinners for Eight</strong>! Your group is:</p>
    <p>${rosterHtml}</p>
    <p><strong>${escapeHtml(hostName)}</strong> is hosting, at ${escapeHtml(hostAddress)}.</p>
    ${whenHtml}
  `;
  const defaultText =
    `Hi everyone,\n\nYou've been matched for Dinners for Eight! Your group is:\n${rosterText}\n\n` +
    `${hostName} is hosting, at ${hostAddress}.\n\n` +
    whenText;

  // An admin override is plain text (with placeholders), rendered to HTML as
  // escaped paragraphs — simpler and safer than letting them hand-author HTML.
  const tokens = { eventDate, roster: rosterText, hostName, hostAddress };
  const subject = emailSubject.trim()
    ? renderTemplate(emailSubject, tokens)
    : defaultSubject;
  const customBody = emailBody.trim();
  const text = customBody ? renderTemplate(customBody, tokens) : defaultText;
  const html = customBody
    ? textToHtmlParagraphs(renderTemplate(customBody, tokens))
    : defaultHtml;

  await sendEmail({
    to: recipients,
    subject,
    html,
    text,
  });
}

function renderTemplate(template: string, tokens: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(tokens, key) ? tokens[key] : match
  );
}

function textToHtmlParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
