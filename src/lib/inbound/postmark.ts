// Postmark inbound payload handling: the pure part, kept free of IO so the
// fixture tests can prove the whole parse without a mail server.

export interface PostmarkAttachment {
  Name: string;
  Content: string; // base64
  ContentType: string;
  ContentLength: number;
}

export interface PostmarkInbound {
  FromFull?: { Email?: string; Name?: string };
  Subject?: string;
  MailboxHash?: string;
  ToFull?: Array<{ Email?: string; MailboxHash?: string }>;
  TextBody?: string;
  HtmlBody?: string;
  Attachments?: PostmarkAttachment[];
}

/**
 * Find the alias token the mail was addressed to.
 *
 * Two delivery shapes, both supported so the product works before a custom
 * domain exists:
 *   - custom domain:   u-x7k2m9@in.example.com        (token is the local part)
 *   - Postmark default: abc123+u-x7k2m9@inbound.postmarkapp.com
 *                                                      (token rides the plus hash)
 */
export function resolveAliasToken(mail: PostmarkInbound): string | null {
  const candidates: string[] = [];
  if (mail.MailboxHash) candidates.push(mail.MailboxHash);
  for (const to of mail.ToFull ?? []) {
    if (to.MailboxHash) candidates.push(to.MailboxHash);
    if (to.Email) candidates.push(to.Email.split("@")[0]);
  }
  for (const c of candidates) {
    const m = /^u-([a-z0-9]{6,12})$/i.exec(c.trim());
    if (m) return m[1].toLowerCase();
  }
  return null;
}

/**
 * Cut forwarded-mail furniture off the body: quoting, original-message
 * separators, signatures. Deliberately conservative; the extractor is told to
 * ignore residue, so under-stripping costs nothing while over-stripping can
 * delete the invoice.
 */
export function stripQuoting(text: string): string {
  let body = text.replace(/\r\n/g, "\n");

  const cutMarkers = [
    /^On .{0,160}? wrote:\s*$/m,          // Gmail / Apple Mail reply header
    /^-{3,}\s*Original Message\s*-{3,}/mi, // Outlook classic
    /^_{10,}\s*$/m,                        // Outlook divider
    /^-{2}\s*$/m,                          // signature divider "-- "
  ];
  for (const marker of cutMarkers) {
    const m = marker.exec(body);
    // Cut only when real content precedes the marker. "Invoice attached" plus
    // a total is a legitimate short body when the PDF is the actual payload,
    // so the bar is a nonempty head, not a long one.
    if (m && body.slice(0, m.index).trim().length > 10) body = body.slice(0, m.index);
  }

  // Drop fully-quoted lines; an invoice pasted inline is never "> " quoted.
  body = body
    .split("\n")
    .filter((line) => !line.startsWith(">"))
    .join("\n");

  return body.trim();
}

/** Crude HTML-to-text for shops that send HTML-only invoices. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface NormalizedInbound {
  fromEmail: string | null;
  subject: string | null;
  /** Invoice text with reply furniture removed. */
  text: string;
  /** PDF attachments only; images ride the same path as the camera flow. */
  pdfAttachments: Array<{ name: string; base64: string }>;
  imageAttachments: Array<{ name: string; base64: string; contentType: string }>;
}

export function normalizeInbound(mail: PostmarkInbound): NormalizedInbound {
  const rawText = mail.TextBody?.trim()
    ? mail.TextBody
    : mail.HtmlBody
      ? htmlToText(mail.HtmlBody)
      : "";

  const attachments = mail.Attachments ?? [];
  return {
    fromEmail: mail.FromFull?.Email ?? null,
    subject: mail.Subject ?? null,
    text: stripQuoting(rawText),
    pdfAttachments: attachments
      .filter((a) => a.ContentType === "application/pdf")
      .map((a) => ({ name: a.Name, base64: a.Content })),
    imageAttachments: attachments
      .filter((a) => ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(a.ContentType))
      .map((a) => ({ name: a.Name, base64: a.Content, contentType: a.ContentType })),
  };
}

/** The address shown in the product for a given token. */
export function displayAddress(token: string): { address: string; configured: boolean } {
  const domain = process.env.INBOUND_DOMAIN;          // e.g. "in.glovebox.app"
  const base = process.env.POSTMARK_INBOUND_ADDRESS;  // e.g. "abc123@inbound.postmarkapp.com"
  if (domain) return { address: `u-${token}@${domain}`, configured: true };
  if (base) {
    const [local, host] = base.split("@");
    return { address: `${local}+u-${token}@${host}`, configured: true };
  }
  // No mail service wired yet: show the shape so the UI is honest about status.
  return { address: `u-${token}@…`, configured: false };
}
