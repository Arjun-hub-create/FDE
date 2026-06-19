# TEST-REPORT.md
**Fernhill Stays — Property Dashboard**

I tested this the way I'd want someone testing a thing I'm about to hand to a paying
client: assume the data is hostile, assume the UI will be opened by someone who doesn't
know how it works, and write down what actually broke — not just what I expected to break.

---

## 1. Data edge cases

### 1.1 Duplicate bookings (Issue 1 in DECISIONS.md)
**Test:** confirm `clean.py` actually removes duplicates and doesn't just log that it did.
**Method:** counted unique `booking_id` values before and after `drop_duplicates()`.
**Result:** 238 raw rows → 230 after dedup. All 8 duplicate pairs (BK1028, BK1044, BK1068,
BK1096, BK1126, BK1138, BK1207, BK1285) collapsed to one row each. Confirmed by re-running
`df['booking_id'].duplicated().sum()` on the output — returns 0.
**Status:** ✅ Pass.

### 1.2 Zero-night bookings (Issue 7)
**Test:** what happens to revenue if a booking has `nights = 0` but a non-zero
`total_amount_inr`?
**Method:** checked the 4 affected rows (BK1220, BK1133, BK1268, BK1107) directly — all 4
have a `nightly_rate_inr` recorded but `nights = 0`, which makes `rate × nights = 0`
regardless of what `total_amount_inr` says.
**Finding:** if these rows weren't dropped, BK1133 alone would have contributed ₹29,320 of
phantom revenue for a stay that, by definition, didn't happen. Two of the four
(BK1133, confirmed; BK1268, No-show) aren't even checked-out, so they wouldn't hit revenue
regardless — but the other two needed the explicit `nights > 0` filter to be safe.
**Fix verified:** all 4 rows are absent from the cleaned output. **Status:** ✅ Pass.

### 1.3 Negative revenue (Issue 8)
**Test:** does `.abs()` correctly recover the right magnitude, or could it mask a real
data problem?
**Method:** for all 5 negative rows, checked that `nightly_rate_inr × nights` matches the
absolute value of `total_amount_inr` exactly (or within rounding).
**Result:** all 5 matched exactly (e.g. BK1250: 4071 × 7 = 28497, raw value was −28497).
This confirms it's a sign error, not an unrelated negative number that `.abs()` would
incorrectly "fix" into a wrong positive value.
**Risk I checked for and ruled out:** if any of these 5 rows had a magnitude that did
*not* match rate × nights, blindly taking `.abs()` would silently launder a different,
unrelated data error into the dashboard as if it were correct. That's not the case here,
but I want to flag that `.abs()` is only safe *because* I verified the magnitude first —
not as a general-purpose rule.
**Status:** ✅ Pass.

### 1.4 10x typo detection (Issue 9)
**Test:** does the ratio-band check (8x–12x) ever fire on a row it shouldn't?
**Method:** ran the typo filter against the full cleaned dataset and manually inspected
every row it flagged, not just the count.
**Result:** exactly 6 distinct bookings flagged (7 rows including the BK1126 duplicate),
every one with a ratio of precisely 10.0 — not 8.4 or 11.2, which is what a coincidental
match would look like. No false positives found.
**What I didn't test:** I don't have a way to verify against the property's real PMS
records whether `nightly_rate_inr` itself is correct for these rows — I'm trusting it as
the source of truth and treating `total_amount_inr` as the error. If `nightly_rate_inr`
were the wrong field instead, this fix would be wrong in the opposite direction. Noted as
a known limitation, not silently assumed away.
**Status:** ✅ Pass (with documented assumption).

### 1.5 Missing nightly_rate_inr / total_amount_inr (Issues 10–11)
**Test:** confirm recovered values multiply back correctly.
**Method:** spot-checked row 161 (BK1243): `total_amount_inr=6702`, `nights=1`,
`nightly_rate_inr` was null → recovered as 6702/1 = 6702. And row 168 (BK1239):
`nightly_rate_inr=7539`, `nights=5`, `total_amount_inr` was null → recovered as
7539 × 5 = 37695.
**Status:** ✅ Pass.

### 1.6 What happens to a booking that's missing *both* rate and total?
**Test:** searched the cleaned dataset for any row where neither field could be recovered.
**Result:** no such row exists in this dataset — every row missing one of the two fields
had the other one present. This is good luck in this dataset, not a guarantee; if a future
export has a row missing both, the current `clean.py` would leave it with a null
`total_amount_inr`, which would currently show as `₹0` or `NaN` in the dashboard depending
on how the aggregation handles it.
**Status:** ⚠️ Not currently handled — see Section 4 (What I Decided Not to Fix).

### 1.7 Monthly revenue totals consistency check
**Test:** do the five monthly revenue values for each property in the cleaned JSON add up
to that property's `totalRevenue`?
**Method:** summed each property's `monthlyTrend` array and compared to `totalRevenue`.
**Result:** all five match exactly with zero gap — Birchwood ✅, Cedar Court ✅, Lakeview ✅,
Marigold ✅, Palm Grove ✅.
**Why this test existed at all:** an earlier version of `clean.py` failed it. The original
`parse_date` function used a `dayfirst=True` fallback which was silently pushing 51
bookings into months 6–12 — months that don't exist in the aggregation loop. For Marigold
Suites specifically, the monthly trend was summing to ₹2.88L while the total revenue card
showed ₹4.57L — a ₹1.69L gap that's immediately visible if you actually add up the bars.
I caught it by checking this exact sum, traced it to the date parser, rewrote `parse_date`
as four explicit `strptime` rules with no fallback (see AI-WORKFLOW.md), and re-ran. All
five gaps closed to zero.
**Status:** ✅ Pass (after fix).

---

## 2. UI states

### 2.1 Loading state
**Test:** does the dashboard show a loading indicator while `cleaned_data.json` fetches,
rather than a blank screen?
**Method:** the `loading` state in `App.jsx` renders a spinner with "Loading dashboard…"
until the fetch resolves.
**Status:** ✅ Pass — confirmed visually on `localhost:5173` during initial load.

### 2.2 Error state — missing or malformed JSON
**Test:** what does the dashboard show if `public/cleaned_data.json` is missing or fails
to parse?
**Method:** temporarily renamed `cleaned_data.json` and reloaded the page.
**Result:** the fetch's `.catch()` sets `loading=false` with `data` still `null`, which
renders the explicit "Failed to load data. Check public/cleaned_data.json" message instead
of a blank white screen or a console-only error.
**Status:** ✅ Pass.

### 2.3 Empty state — zero-revenue month and low checkout volume
**Test:** does a property with a ₹0 month, or very low checkout volume, render sensibly
instead of breaking the charts?
**Method:** Palm Grove Inn has January = ₹0 in the cleaned JSON — no checked-out stays
that month, which is genuine signal not a missing data point. Checked its monthly trend
chart specifically. Also checked Birchwood Stay, which has the fewest completed bookings
of all five properties (9 checked-out of 20 total).
**Result:** Palm Grove Inn's January renders as a zero data point on the line chart rather
than a gap or a broken line — ₹0 is real information ("nothing checked out that month"),
not something to hide or interpolate over. Birchwood Stay renders correctly across all
five months with no issues from the low checkout volume.
**Status:** ✅ Pass.

### 2.4 Selecting between properties
**Test:** does switching the selected property in the sidebar correctly update every
chart, not just some of them?
**Method:** clicked through all 5 properties and checked that the health score ring, KPI
cards, monthly trend, and channel breakdown table all updated together.
**Status:** ✅ Pass.

---

## 3. Cross-cutting check — the automatic red flag

**Test:** does any cancelled or no-show booking ever contribute to `totalRevenue` anywhere
in the output?
**Method:** for each property, compared `checkedOut` count against the count of bookings
actually summed into `totalRevenue`. Spot-checked Marigold Suites: 76 total bookings, only
29 checked-out, and `totalRevenue` (₹457,248) was computed only from those 29 — the 12
cancelled and 10 no-show bookings for that property contribute ₹0 each, even though some of
them have a non-null `total_amount_inr` in the raw data.
**Why this is the most important test in this report:** the assignment explicitly calls
this out as an automatic red flag. It's not a hard fix, but it's an easy one to get
silently wrong if the revenue formula doesn't filter on status before summing.
**Status:** ✅ Pass.

---

## 4. What I decided NOT to fix, and why

**Guest count vs. room type mismatches.** 14 bookings have `guests = 4` in a Standard
room (e.g. BK1248, BK1157, BK1023 — full list in my data audit). A Standard room sleeping
4 people is operationally questionable for a boutique property, and it's possible this is
a genuine data-entry issue.

I decided not to fix or flag this in the cleaning pipeline because:
1. **Neither the health score nor the channel/property questions the client asked about
   depend on guest count at all** — fixing it wouldn't change a single number on the
   dashboard.
2. **There's no correct value to impute.** Unlike the rate/total recovery (Issues 10–11),
   I have no second field to derive the "right" guest count from — any fix here would be a
   pure guess, not a recoverable fact.
3. It's exactly the kind of thing worth a one-line question to the actual client
   ("are 4-guest bookings in Standard rooms expected, or a booking-system default?")
   rather than something an engineer should silently decide on their behalf.

I'd rather hand the client an honest "I saw this, didn't touch it, here's why" than fix
something I can't actually verify is wrong.

**Rows missing both `nightly_rate_inr` and `total_amount_inr`.** Doesn't occur in this
specific dataset (verified in Section 1.6), so I didn't build explicit handling for it.
Flagged here so it's not silently undiscovered if a future data export hits this case.

---

## 5. Summary

| Area | Result |
|---|---|
| Data issue fixes (Issues 1–12) | ✅ All verified against real row numbers and values |
| Monthly totals consistency | ✅ All 5 properties sum correctly (caught and fixed a real bug) |
| Revenue/cancellation red flag | ✅ Confirmed cancelled/no-show never enter revenue |
| Loading state | ✅ Pass |
| Error state | ✅ Pass |
| Zero-revenue month / low-volume property | ✅ Pass |
| Edge case: missing both rate & total | ⚠️ Doesn't occur in this dataset; not yet handled |
| Guest/room-type mismatch | Deliberately left unfixed — documented above |