# Hardening checklist

A full audit ran on 2026-08-24 (security, concurrency, reliability, accessibility, UI). Findings were grouped into three gates. Gate 1 is done and on the branch that shipped this file. Gates 2 and 3 are open and listed here so the state is visible before an Anthropic key goes on the public deployment.

## Gate 1: done (ship blockers)

- **Trust tier is server decided.** The cookie save path can only mint `photo` or `owner_entry` and never sets `has_source_document`. The shop originated tiers exist only on the inbound webhook, which observes a real shop email. A client can no longer forge a shop record by passing `intakeMethod` in the body.
- **No cross tenant visit writes.** A save against a `vehicleId` this garage does not own is rejected, not silently inserted.
- **Extraction is capped and durable.** `/api/extract` now requires the garage cookie and holds a per client and a global daily cap in Postgres, so no visitor can run up an unbounded bill and the limit survives cold starts. Tune with `EXTRACT_DAILY_PER_CLIENT` (default 15) and `EXTRACT_DAILY_GLOBAL` (default 50).
- **Inbound mail is deduped and sender aware.** Duplicate Postmark deliveries are dropped by `MessageID`. A forward from a consumer mailbox is recorded as owner asserted, not shop originated; only a shop's own domain earns the top tier. Oversized attachments are dropped before the model sees them.
- **Odometer no longer suffers a lost update.** Mileage advances inside SQL, so a concurrent update is not reverted.
- **Quick wins.** Pinch zoom restored, demo records tiered as fixtures (were showing as real photos), amber and caution text darkened to pass contrast, `role="alert"` on error surfaces, real plates and VIN and card swapped for synthetic demo values, safe dependency advisories cleared.

## Gate 2: before real users lean on it

- **Visit save idempotency.** A lost response after a committed save lets a retry write a duplicate. Add a client generated idempotency key, a unique column, and `on conflict do nothing`.
- **localStorage migration idempotency.** Two tabs, or a mid loop failure, can double a migrated history. Key each legacy visit so a re migration is a no op.
- **Render the capture save error.** The review step sets an error but never shows it, so a failed save looks like success. Surface it (the `role="alert"` container is ready).
- **Transactions around multi statement writes.** `amendVisit` especially: it logs an amendment then updates the payload separately, and a failure between them corrupts the amendment count, which is a trust signal. Use the Neon batch transaction API.
- **Seed idempotency and atomicity.** Two tabs can both pass the empty check and half seed a garage that then refuses to reseed. Guard with an advisory lock or a single insert where not exists.
- **Detail pages fail to a retry, not an infinite skeleton.** Vehicle, visit, and log pages have no catch on load.
- **Announce async status to screen readers.** No `aria-live` anywhere; extraction progress, VIN errors, and step transitions are silent.

## Gate 3: accessibility and polish

- Label the capture review inputs (the `Field` component and the line item and condition inputs have no accessible name).
- Reduced motion guards on the scan animation and skeletons.
- `aria-current` and a non color active state on the bottom nav.
- Remove buttons to a 24px minimum target.
- Promote sub 12px load bearing text to 12px.
- Copy, heading style, and empty state consistency across pages.
- The Next.js minor bump (16.2.10 to 16.3.x) clears the last 3 dependency advisories but is a deliberate step: read the migration notes first, since this Next version carries breaking changes.
- Business identifiers in the seed and the eval fixture (Pep Boys work order and store numbers) are not personal but are real; swap if the repo staying public is a concern.
