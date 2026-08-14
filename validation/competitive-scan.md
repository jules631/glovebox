# Glovebox Competitive Scan

Deep research run 2026-07-17. 21 sources fetched, 98 claims extracted, 25 adversarially verified with 3 votes each: 22 confirmed, 3 refuted. Confidence labels below reflect that process.

## The incumbent (high confidence, verified against CARFAX's own docs)

- CARFAX Car Care is free, 4.8 of 5 across ~125K App Store ratings, 1M+ Android downloads, claimed 30M+ drivers. Any paid product competes with a free, well liked incumbent.
- Its moat and its blind spot are the same thing. History auto populates only from shops that opt in through their shop management systems. Anything a user adds manually, including DIY work and indie shop receipts, is explicitly excluded from the CARFAX Vehicle History Report. Their own support article says user added records "will not be included on the CARFAX Vehicle History Report." Users cannot even attribute a record to an arbitrary independent shop; reviewers as recent as Feb 2026 log shop work as "Self."
- The shop reporting pipeline is opt in, lags up to 10 days, and excludes price data entirely. The ALLDATA feed to myCARFAX explicitly does not collect "Cost of Services." CARFAX service histories structurally contain no prices.
- CARFAX already has receipt photos, but as dumb attachments: no OCR, no AI extraction, and user reports of receipts stranded on one device that never sync.

## The wedge (medium confidence)

AI extraction of any receipt into a structured, price inclusive record appears unoccupied. The closest verified AI entrant (Maintain It, 4 App Store ratings) applies AI only to warranty documents. Caveat: Drivvo, Simply Auto, Fuelly, and AUTOsist produced no surviving verified claims, so their AI status is unconfirmed rather than disproven.

## The warranty angle (high confidence, FTC verified)

- FTC explicitly warns a warranty claim "might be denied" without maintenance records and advises keeping receipts.
- Under Magnuson Moss it is illegal to deny warranty coverage because maintenance was done by an indie shop or the owner. Any shop and DIY records are legally valid proof.
- Extended service contracts can be voided for undocumented maintenance.
- Caveat: the FTC frames denial as a risk, not a frequency. No data on how often it actually happens.

## Positioning gap statement

Product thesis (JJ): Glovebox is about understanding the service history health of the vehicle, knowing the state of your car, what was done, what is wearing, what is due, what is covered. Not resale value.

Under that lens the verified gap is this: nobody can show an owner the complete health picture of their car. CARFAX structurally cannot, because it only sees work at opted in reporting shops; indie work and DIY are invisible to it by its own documentation, and its feeds carry no prices and no measurements beyond what shops report. A car that visits a dealer, an indie, and a driveway has no single record anywhere. Glovebox can hold the complete picture because the receipt is the one artifact every service produces regardless of who did the work, and AI extraction turns it into structured vitals (services, odometer, tire and brake measurements, warranty terms) owned by the driver. The durable moat is the complete, owner controlled health record; receipt capture is just the intake.

## Kill signals (watch these honestly)

1. CARFAX could ship OCR on the receipt photos it already holds. The wedge would collapse to privacy and ownership alone.
2. Shop management integrations (Tekmetric, ALLDATA, Identifix, Shopmonkey) are steadily shrinking the indie shop blind spot.
3. The health gap may be felt too rarely to sustain a habit. If interviewees are comfortably ignorant of their car's state (questions 1 and 2 of the kit) and cannot recall it ever costing them, the thesis fails regardless of how real the CARFAX blind spot is.
4. The shop as buyer hypothesis is unresolved; its one supporting claim was refuted 0 to 3.
5. Warranty denial frequency is unknown; a fear based pitch may overstate real incidence.
6. The complaints Glovebox exploits are minority gripes against a 4.8 star free product.

## What this means for the interviews

Under the vehicle health thesis, the interviews (interview-kit.md) test whether the incompleteness gap is felt:
- Do owners actually know their car's state (next service due, last brake and tire readings)? Uncertainty they have tried to fix is signal; comfortable ignorance is a kill signal.
- The multi shop and DIY segments matter most: they are exactly who the verified CARFAX blind spot leaves without a complete record.
- Warranty and coverage awareness (the Pep Boys moment): question 4 measures real incidence of paying for covered or duplicate work, which research could only frame as risk.
- Shop as buyer unresolved by research (its supporting claim was refuted 0 to 3): the shop owner interviews are the tiebreaker.
- Resale is demoted to a secondary probe. The premium is unquantified in the literature and it is not the product thesis.

## Key sources

- support.carfax.com/article/can-i-add-a-diy-service-into-carfax-car-care/ (against interest admission)
- support.tekmetric.com CARFAX Integration FAQS (pipeline mechanics)
- alldata.com Enabling and Using myCARFAX (no price data in feed)
- consumer.ftc.gov/articles/auto-warranties-and-auto-service-contracts (warranty proof)
- apps.apple.com CARFAX Car Care listing (ratings, reviews)
