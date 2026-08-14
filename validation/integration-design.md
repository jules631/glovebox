# Intake integration design

The goal of every path below is the same: move from the user pushing data in to data arriving and the user confirming it. Capture at the counter is the worst possible ask. Someone has just paid a bill they resented, the app promises 20 to 40 seconds of standing still, and the review form has 15 to 25 fields. Nobody does that. The receipt that survives is the one dealt with later, from the pile, at home.

Two of these are built. The rest are designed and not built, and the reason in each case is infrastructure or business development rather than code.

## Built

**Photograph or PDF.** The original path. Produces the `photo` or `pdf` trust tier.

**Paste an invoice.** Same extractor, no camera. Dealers and chains already email invoices, so pasting one removes the lighting, the glare, and the counter entirely. This is the honest stand in for full email ingestion, and it is why that is the first thing to build next: the parsing already works, only the delivery is manual.

**DIY entry.** Structured entry for work you did yourself. Recorded as `owner_entry`, the weakest tier, and labeled that way in the product. It exists because this work reaches no reporting system anywhere, including CARFAX by their own documentation.

**VIN.** Not a service record, but the reason the app is useful on day one. Decode plus open recalls, from public NHTSA endpoints that need no key.

## Designed, not built

Ranked by burden removed per unit of work.

### 1. Email ingestion

The highest leverage change available. A forwarding alias (`u-<token>@in.glovebox.app`) turns capture into a one time setup and then permanent. Probably covers 40 to 60 percent of visits for anyone who uses a dealer or a chain.

- **Needs:** an inbound mail service (Postmark, Resend, SendGrid) posting parsed mail to a webhook, plus a domain and SPF/DKIM.
- **Shape:** webhook verifies the signature, resolves the alias token to a garage, strips quoting and signatures, and runs the existing extractor over the body and any PDF attachment. Attachments arrive as first class documents, so these land at the `shop_email` or `pdf` tier, the strongest evidence the product accepts.
- **Watch for:** forwarded mail loses original headers, which weakens the provenance claim. Prefer a filter rule that auto forwards on arrival over manual forwarding, and record which one happened.
- **Why it is not built:** needs a domain and a mail provider, not code.

### 2. Digital vehicle inspection links

The underrated one. Tekmetric, Shopmonkey, and AutoVitals text customers a link to a DVI with brake measurements, tire depths, technician notes, and photos. That is richer health data than the receipt, already structured, and sent by default.

- **Needs:** per vendor page parsing, since these are customer facing web pages rather than an API.
- **Shape:** paste the link, fetch, parse to `DiagnosticsSchema`, which already holds exactly this shape.
- **Why it matters:** it is the only inbound source of *measurements*, and measurements are what turn a log into a health record. Two DVIs on the same car is a wear rate.
- **Watch for:** these are unversioned marketing pages and will break without notice. Treat every parser as expected to fail and degrade to the link plus a screenshot.

### 3. Connected car odometer

Smartcar abstracts most major manufacturers behind one consent flow and returns odometer over the air.

- **Needs:** Smartcar client credentials and an OAuth callback.
- **Shape:** store the token per vehicle, poll daily, append to `odometer_readings` with source `connected_car`.
- **Why it is high value:** odometer freshness gates every warranty check and every service interval in the product, and the manual odometer dialog is a chore the app invented for itself. It also adds a genuinely independent source to the mileage curve, which is exactly what makes that curve hard to fabricate.

### 4. Card transaction matching

Plaid gives merchant, amount, and date. No line items.

- **Shape:** match transactions against known automotive merchant categories, then either prompt at the right moment or, when a receipt already exists for that shop, date, and amount, set `payment_matched` and lift that record from `self_captured` to `corroborated`.
- **The underrated half:** this tells the user what is *missing* from their own record. Knowing there was a $412 charge at a shop with no receipt behind it is worth more than another receipt.

### 5. Shop management system integration

Tekmetric, Shopmonkey, and Mitchell1 have APIs. Perfect data, near zero user effort, slow business development, and useless for shops that run on paper. A single shop partnership in one metro is the testable version.

### 6. Photo library scan

Many people already photograph receipts and forget. An on device scan for receipt shaped images clears the backlog in one sitting and is the cold start fix. Costs a heavy permission prompt, so it should be offered after the first successful capture rather than at install.

## What none of these fix

Every path above still ends in a human confirming an extraction. The review step is the heaviest screen in the product and the friction sits in verification, not typing: the schema carries no per field confidence, so the app cannot ask a smaller question than "check all of this against the paper".

The fix is to add confidence to the extraction schema, save immediately, and surface only the two or three low confidence fields for review, with the source image beside them. Trust comes from showing the number next to where it came from, not from making someone retype it. That is a change to `ExtractedReceiptSchema` and the review UI, and it is worth more than any single integration on this list.
