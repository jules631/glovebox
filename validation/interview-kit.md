# Glovebox Validation Interview Kit

Thesis to test: people do not actually know the service health of their own car, and that gap costs them (duplicate work, missed coverage, blind trust in whatever the shop says). Glovebox is a health record for the vehicle. The interviews test whether that gap is felt, not whether people like the idea.

15 to 20 interviews, 10 minutes each. Never pitch, never describe the app until the very end, past behavior only.

## The script

Open: "I'm researching how people keep track of what's been done to their cars. Can I ask about your actual experience for ten minutes? No pitch, I'm not selling anything."

1. Without looking anything up: what's the next thing your car needs, and when? How confident are you in that answer?
2. When were your brakes or tires last actually measured, and do you know what the readings were?
3. Walk me through your last service. Who did it, and where is that record right now?
4. Have you ever paid for something and later suspected it had already been done, or was still under warranty? (This is the Pep Boys moment. Let them tell it.)
5. When a shop recommends extra work, how do you decide whether it's really needed? What do you check?
6. Your car uses more than one shop, or you do some work yourself. Does any one place have the full picture? Does that ever bite you?

Follow every yes with: "What did that cost you?" and "What did you change afterward?"

Only after all six: show the app if they earned it by describing a real moment. Watch what they do, not what they say.

## What counts as signal

- STRONG: a specific past moment where not knowing the car's state cost money or created real anxiety (paid twice, missed warranty coverage, said yes to work they couldn't evaluate), and they took some action about it afterward.
- MEDIUM: genuine uncertainty answering questions 1 and 2, paired with discomfort about it. Uncertainty alone is not pain; uncertainty they have tried to fix is.
- WEAK: "that sounds really useful," any sentence about the future.
- DISQUALIFYING: they know their car's state cold from a single dealer relationship, or they cannot recall a single moment where not knowing mattered.

## Sourcing (aim for the mix)

- 5 to 6 multi shop households: people who mix dealer, indie, and chain shops. They are the ones no single system sees fully, which research confirmed CARFAX structurally cannot fix.
- 3 to 4 DIY or partial DIY owners (their work is invisible to every reporting system).
- 2 to 3 independent shop owners or service advisors: "Do customers ever ask what's been done or what's due? Do they come in with records? Would a customer who knows their car's history be a better or worse customer for you?" This still tests whether the buyer might be the shop.
- 2 to 3 people with an active warranty or service contract (tests the coverage awareness moment directly).
- Fill the rest from r/MechanicAdvice, local car groups, coworkers. Private sellers are now a secondary source, not the lead; if one comes up, still ask what buyers wanted to know about the car's condition.

## Tracking table

Copy one row per interview into validation/interviews.md as you go.

| # | Who (role, source) | Knows car's state? (Q1 and Q2) | Moment described? | Cost of not knowing | Current system | Shop or driver buyer signal | Verbatim quote |
|---|---|---|---|---|---|---|---|

## Decision gate

Proceed to the iOS build only if at least 5 of 20 describe a specific past moment where not knowing their car's service state cost them something real, or at least one shop owner says they would put it in front of customers. Otherwise: pivot shop side, keep as portfolio piece, or park it. Write the outcome down either way; the kill decision is as good an interview story as the launch.
