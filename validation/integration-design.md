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

### 1. The Glovebox address: a direct shop connection without an integration

The V2 centerpiece, and a reframing of what "email ingestion" is. Every point of sale system in the country already asks "email for your receipt?" So each user gets a permanent intake address, and the ask becomes:

> Next time you're at the counter, give them this as your email: **u-jj42@in.glovebox.app**

The shop types it into their customer profile once. Every future invoice arrives automatically, from every shop the user does this with, forever. That is a direct shop connection with zero shop side integration, zero permission, and zero business development: the shop adopts nothing, it just sends the receipt where the customer asked. Intake stops being a per visit effort and becomes a per relationship setup, which is what kills the capture decay problem: habits fade, a standing connection does not.

- **Needs:** an inbound mail service (Postmark and SendGrid both parse inbound mail to a webhook; Cloudflare Email Routing plus a Worker is the free path if the domain is on Cloudflare), a domain, and the app deployed somewhere the webhook can reach.
- **Shape:** webhook verifies the provider signature, resolves the alias token to a garage, strips quoting and signatures, runs the existing extractor over the body and any PDF attachment, and saves at the `shop_email` or `pdf` tier, the strongest evidence the product accepts.
- **Watch for:** mail forwarded by the user loses original headers, which weakens the provenance claim relative to mail the shop sent directly. Record which one happened rather than treating them as the same tier of evidence.

#### Why a shop cooperates, and later connects directly

Not money. The shop as buyer hypothesis was the one claim refuted outright in the competitive research, and shops already pay their management system vendors $300 to $700 a month. The trade is retention and evidence based selling, and the precedent already exists: thousands of shops opt into reporting service data to CARFAX through Tekmetric and ALLDATA for exactly these reasons.

1. **The record sends customers back to their counter.** Every record carries the shop's name, phone, and work order. The claim packet for lifetime brake pads walks the customer back into the shop that sold them, where the pads are free but the labor is not. Coverage is a retention loop for the shop that issued it.
2. **Evidence approves work.** Shops send digital inspection links because customers approve more work when they can see the measurements. A customer whose own record confirms the wear rate says yes faster and trusts the shop more. Honest shops win in a world where customers can verify, and that selection effect is the pitch.
3. **Declined work comes back.** The quote a customer turns down today surfaces when it is actually due, pointing at the shop that quoted it.
4. **Verification calls are leads.** A used car buyer phoning to confirm a work order is a future customer talking to the service desk.

One boundary, stated up front: a shop connection must never turn the record into the shop's marketing channel. Reminders and nudges belong to the owner, or the entire "on your side of the counter" position collapses.

#### Why the customer wants it, in record terms

- **Provenance.** A shop emailed invoice lands at the top trust tier, and trust is the entire resale story: source plus age is what a skeptical buyer can actually reason about.
- **Completeness without discipline.** Wear rates need two readings and gap analysis needs continuity. The record's value compounds with density, and a standing connection supplies density for free.
- **Prices.** The one thing CARFAX structurally cannot carry: cost per mile, quote comparison, what was paid last time.
- **Claims that succeed.** Email invoices carry the work order and part numbers, exactly what the claim packet needs.

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
