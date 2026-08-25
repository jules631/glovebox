# Hardening checklist

A full audit ran on 2026-08-24 (security, concurrency, reliability, accessibility, UI). Findings were grouped into three gates. All three are now implemented. This file records what each closed and the few residuals worth knowing.

## Gate 1: done (ship blockers)

- **Trust tier is server decided.** The cookie save path can only mint `photo` or `owner_entry` and never sets `has_source_document`. The shop originated tiers exist only on the inbound webhook, which observes a real shop email. A client can no longer forge a shop record by passing `intakeMethod` in the body.
- **No cross tenant visit writes.** A save against a `vehicleId` this garage does not own is rejected, not silently inserted.
- **Extraction is capped and durable.** `/api/extract` requires the garage cookie and holds a per client and a global daily cap in Postgres. Tune with `EXTRACT_DAILY_PER_CLIENT` (default 15) and `EXTRACT_DAILY_GLOBAL` (default 50).
- **Inbound mail is deduped and sender aware.** Duplicate Postmark deliveries drop by `MessageID`. A forward from a consumer mailbox is owner asserted, not shop originated. Oversized attachments drop before the model sees them.
- **Odometer no longer suffers a lost update.** Mileage advances inside SQL.
- **Quick wins.** Pinch zoom restored, demo records tiered as fixtures, amber and caution text darkened for contrast, `role="alert"` on error surfaces, synthetic demo PII, safe dependency advisories cleared.

## Gate 2: done (before real users lean on it)

- **Visit save idempotency.** Every save carries a stable key; the server recognizes a retried or double submitted save and returns the same visit instead of a duplicate. Column `visits.idempotency_key` with a unique index.
- **localStorage migration idempotency.** Each legacy record migrates under a key derived from its id, so two tabs or a mid loop failure recognize what already moved rather than doubling it.
- **Capture save error is shown.** The review step now renders the failure with `role="alert"` instead of silently flipping the button back.
- **Transactions on the multi statement writes.** `amendVisit` (amendment log plus payload update) and `setMileage` (number plus curve point) each commit atomically, so the trust and mileage signals cannot half update. The vehicle write and visit insert in a save also commit together, so no orphan vehicle is left behind.
- **Seed is idempotent.** Stable per record keys mean a raced or double pressed demo load reseeds the same rows rather than doubling them.
- **Detail and log pages fail to a retry.** Vehicle, visit, and log loads catch errors and show a retry instead of an endless skeleton.
- **getGarage cache race fixed.** A late load failure clears only its own cache entry, never a newer in flight one.

## Gate 3: done (accessibility and polish)

- Capture review inputs are labeled (the `Field` component, line items, total, warranty conditions), the date field is a real date picker, and the vehicle and service selects carry accessible names.
- Warranty duration and proration toggles expose their pressed state.
- Extraction progress announces to screen readers; step transitions no longer go silent.
- A global reduced motion media query neutralizes the scan sweep, skeleton pulse, and spinners.
- Bottom nav carries `aria-current`, a nav label, and an active cue that is weight and a rule, not color alone.
- Icon only remove buttons meet the 24px target minimum.
- The garage screen has a real `h1`; the vehicle detail heading matches the other interior pages.
- The odometer reads as a single mileage value to a screen reader rather than spelling out digit boxes.
- Load bearing sub 12px text promoted to 12px; mileage formatting routed through the shared helper.

## Residuals worth knowing

- **Rare orphan vehicle.** If a brand new vehicle capture is submitted from two tabs at the exact same instant, the idempotency key dedupes the visit but one empty vehicle row can remain. Common retries (sequential, after a lost response) are fully covered. Not worth the complexity to close now.
- **Next.js bump still pending.** 16.2.10 to 16.3.x clears the last 3 dependency advisories but is a deliberate step: read the migration notes first, since this Next version carries breaking changes.
- **Business identifiers in the seed and eval fixture** (Pep Boys work order and store numbers) are not personal but are real; swap if the repo staying public is a concern.
- **Multi tab staleness.** A save in one tab does not refresh another open tab until it acts or reloads. Low impact for a single user app; a focus revalidate would close it.
