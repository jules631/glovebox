// Inbound mail contract test. No API key or mail server required.
// Run with: node --experimental-strip-types --import ./scripts/register-ts.mjs scripts/test-inbound.mjs

import { resolveAliasToken, stripQuoting, htmlToText, normalizeInbound, displayAddress } from "../src/lib/inbound/postmark.ts";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail !== undefined ? `  (${detail})` : ""}`); }
}

console.log("\nToken resolution covers both delivery shapes");
check("custom domain local part",
  resolveAliasToken({ ToFull: [{ Email: "u-x7k2m9ab@in.glovebox.app" }] }) === "x7k2m9ab");
check("Postmark plus-hash",
  resolveAliasToken({ MailboxHash: "u-x7k2m9ab", ToFull: [{ Email: "abc+u-x7k2m9ab@inbound.postmarkapp.com", MailboxHash: "u-x7k2m9ab" }] }) === "x7k2m9ab");
check("uppercase is normalized",
  resolveAliasToken({ ToFull: [{ Email: "U-X7K2M9AB@in.glovebox.app" }] }) === "x7k2m9ab");
check("unrelated mail resolves to nothing",
  resolveAliasToken({ ToFull: [{ Email: "info@in.glovebox.app" }] }) === null);
check("a token-shaped string in the middle of an address does not match",
  resolveAliasToken({ ToFull: [{ Email: "spam-u-x7k2m9ab-x@evil.com" }] }) === null);

console.log("\nQuote stripping keeps the invoice, drops the furniture");
const forwarded = `Your invoice from Pep Boys #6449
Work Order: 2068633
Total: $145.44

On Jul 15, 2026, at 4:05 PM, Pep Boys <receipts@pepboys.com> wrote:
> INVOICE DETAIL
> old quoted copy here`;
const stripped = stripQuoting(forwarded);
check("invoice body survives", stripped.includes("2068633") && stripped.includes("145.44"));
check("reply header is cut", !stripped.includes("wrote:"));
check("quoted lines are gone", !stripped.includes("old quoted copy"));

const outlook = `Invoice attached.\nTotal 454.13\n\n________________________________\nFrom: Goodyear\nSent: old thread`;
check("Outlook divider is cut", !stripQuoting(outlook).includes("old thread"));

console.log("\nHTML-only invoices become text");
const html = "<div><h1>Invoice</h1><p>Total: <b>$145.44</b></p><style>.x{color:red}</style></div>";
const text = htmlToText(html);
check("text extracted", text.includes("Total: $145.44"), text);
check("styles dropped", !text.includes("color:red"));

console.log("\nNormalization routes attachments by type");
const normalized = normalizeInbound({
  FromFull: { Email: "receipts@pepboys.com" },
  Subject: "Your invoice",
  TextBody: "Work Order 2068633",
  Attachments: [
    { Name: "invoice.pdf", Content: "QUJD", ContentType: "application/pdf", ContentLength: 3 },
    { Name: "logo.png", Content: "QUJD", ContentType: "image/png", ContentLength: 3 },
    { Name: "virus.exe", Content: "QUJD", ContentType: "application/octet-stream", ContentLength: 3 },
  ],
});
check("pdf routed", normalized.pdfAttachments.length === 1);
check("image routed", normalized.imageAttachments.length === 1);
check("everything else dropped", normalized.pdfAttachments.length + normalized.imageAttachments.length === 2);
check("sender kept for the inbound log", normalized.fromEmail === "receipts@pepboys.com");

console.log("\nDisplayed address is honest about configuration");
delete process.env.INBOUND_DOMAIN;
delete process.env.POSTMARK_INBOUND_ADDRESS;
check("unconfigured says so", displayAddress("x7k2m9ab").configured === false);
process.env.POSTMARK_INBOUND_ADDRESS = "abc123@inbound.postmarkapp.com";
check("Postmark default uses plus addressing",
  displayAddress("x7k2m9ab").address === "abc123+u-x7k2m9ab@inbound.postmarkapp.com");
process.env.INBOUND_DOMAIN = "in.glovebox.app";
check("custom domain wins when present",
  displayAddress("x7k2m9ab").address === "u-x7k2m9ab@in.glovebox.app");

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
