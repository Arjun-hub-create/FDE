# AI-WORKFLOW.md
**Fernhill Stays — Property Dashboard**

## Tools used

Claude, mainly through chat. I went in knowing roughly what I wanted — clean the data
properly first, then build something on top of it — and used it as a second pair of
hands for the parts that would've taken me way longer to type out myself: the cleaning
script, the dashboard component, and a first draft of these docs.

I didn't bother switching between multiple tools for this. Once I had context built up in
one conversation with the actual files in it, jumping to ChatGPT or Cursor felt like it'd
cost more time re-explaining the dataset than it'd save.

## How I actually used it

I didn't start with "write me a dashboard." I started with the data, because that's where
the actual decisions live — the dashboard is just rendering whatever the cleaning script
decides is true.

So the order was: dump the raw CSV and ask for every distinct *type* of issue, not just a
list of bad rows. Then go through each issue type myself and decide how to handle it —
drop, recompute, or flag — before any code got written. Then once I had that logic
straight in my head, I had it write `clean.py` to match, and I read through it line by
line rather than just running it and trusting the print statements.

The dashboard came after the data was solid. I gave it the shape of the cleaned JSON and
asked for something that answered the three things the client actually asked for —
property performance, channel value, health score — rather than a generic "nice looking"
dashboard.

## A few prompts that mattered

**Asking for issue categories before any code.** This mattered because the brief says
issues were deliberately planted, and I didn't want a vague "here's some messy data"
response. Forcing it to categorize (duplicates vs. case inconsistency vs. date format vs.
sign errors vs. typos) is what actually let me handle each one differently instead of
running one generic `.dropna()` and calling it done.

**Pushing back on the 10x typo logic instead of accepting it as-is.** The first version
of the check just said "if total is roughly 10x rate×nights, fix it." I didn't take that
at face value — I went and looked at the actual flagged rows myself (BK1118, BK1214,
BK1164, BK1181, BK1146, BK1126) to check the ratios weren't just *close* to 10 by
coincidence on a couple of them. They all landed almost exactly on 10.0, which is what
convinced me it was safe to keep, not the model telling me it was fine.

**Asking for exact row numbers and real before/after values in DECISIONS.md, instead of a
summary.** I didn't want a doc that reads like "we cleaned duplicates and fixed
inconsistent casing" — that's the kind of thing that screams generic AI output, which the
assignment specifically warns against. So I made sure every issue cited actual row indices
from my CSV and the actual numbers before and after the fix, cross-checked against my own
audit, not just whatever came out the first time.

## Something it got wrong

The date-parsing function. This is the one that actually mattered.

I asked it to handle the four date formats in the CSV and it wrote a `parse_date` function
that used `dateutil.parser.parse(date_str, dayfirst=True)` as a fallback for any format
it couldn't pin down early. Looked reasonable at a glance — Indian convention is day-first,
the client is in Bengaluru, seemed defensible. The script ran clean, the print statements
all said the right things, and the data looked fine row by row.

I caught it when I cross-checked the monthly revenue totals against the total revenue
figures for each property. For Marigold Suites the monthly trend was adding up to ₹2.88L
but the total revenue card showed ₹4.57L — a gap of ₹1.69L. That's not a rounding issue.
I traced it back: for any dash-format date where the day was ≤ 12 (e.g. `05-11-2026`),
`dayfirst=True` was reading it as 5 November instead of May 11. That pushed 51 bookings
into months 6–12 which the monthly aggregation loop never collected, so they just
disappeared from the trend charts while still showing up in the total.

The fix was to stop using a fallback entirely. I checked the format order directly from
the data — 30 of 50 unique slash-format values have a first component over 12, which can
only be a day (proving DD/MM/YYYY), and 28 of 52 unique dash-format values have a second
component over 12 (proving MM-DD-YYYY). Then I rewrote `parse_date` as four explicit
`strptime` rules with `re.fullmatch`, no generic fallback. After that, all five
properties' monthly totals matched their total revenue cards exactly.

I also didn't trust that the cancelled/no-show exclusion was applied correctly just because
the `realized_revenue` logic looked right when I read it. For Marigold Suites: 76 total
bookings, 29 checked-out, and I manually confirmed the ₹4.57L revenue total only reflects
those 29 — not all 76. That's the one the assignment specifically flags as an automatic
red flag if it's wrong, so I wasn't going to assume it was fine without checking.

## What I didn't hand off

- Whether to treat the 29 rows with a missing booking channel as "Unknown" vs. dropping
  them vs. guessing — that's a call about what's honest to show a client, and I made it
  myself.
- The actual health score weights (40/30/20/10) and what to deliberately leave out of it
  (seasonality, reviews, raw revenue size). I used a draft formula as a starting point but
  the weighting and the reasoning behind what's excluded is mine — that's the part of this
  whole assignment that's actually testing judgment, not code generation.
- Deciding not to fix the guest-count/room-type mismatches I noticed in the data (4 guests
  in a Standard room, multiple times). I left that one alone on purpose — there's no second
  field to recover the "right" number from, so any fix would just be a guess dressed up as
  a fix. That's a case where doing nothing was the more honest move than doing something
  that looks thorough.