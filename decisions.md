# DECISIONS.md
**Fernhill Stays — Property Dashboard**
Author: Arjun M · Dataset: `bookings_jan_may_2026.csv` (238 raw rows → 226 clean rows)

> **Line numbers below match exactly what you'd see opening this CSV in Excel or VSCode.**
> Line 1 is the header row. Line 2 is the first booking (`BK1054`). So "line 7" means: open
> the file, count down to the 7th line — that's the row in question. No translation needed.

---

## 1. Data Issues Found & How I Handled Each

I audited every column individually (`df.unique()`, `df.isna().sum()`, regex checks on
date strings, ratio checks on rate vs. total) before writing any cleaning code. I found
**12 distinct issue types**, listed below with the exact lines affected and the exact fix,
mapped to `clean.py`.

---

### Issue 1 — Duplicate bookings (same `booking_id` inserted twice)
**Found:** 8 booking IDs appear twice with identical data.

| booking_id | Lines | property (as stored) | check_in_date | total_amount_inr |
|---|---|---|---|---|
| BK1207 | 14, 161 | Palm Grove Inn | 7 Mar 2026 | 13240 |
| BK1138 | 16, 77 | Lakeview Residency | 05-05-2026 | 8976 |
| BK1044 | 48, 91 | Palm grove inn | 04-15-2026 | 22359 |
| BK1126 | 116, 226 | Birchwood Stay | 04-03-2026 | 294700 |
| BK1285 | 111, 205 | cedar court | 2026-04-28 | 40341 |
| BK1028 | 114, 123 | Palm grove inn | 21/01/2026 | 37415 |
| BK1068 | 157, 199 | Palm Grove Inn | 2026-03-16 | 29736 |
| BK1096 | 182, 209 | Palm Grove Inn | 12/05/2026 | 20406 |

**Fix (`clean.py` lines 14–16):**
```python
before = len(df)
df = df.drop_duplicates(subset='booking_id', keep='first')
print(f"[Issue 1] Removed {before - len(df)} duplicate rows")
```
**Before:** 238 rows. **After:** 230 rows (−8).
**Why:** Booking ID is the natural primary key. Keeping the second copy would double-count
revenue and nights for these 8 stays — exactly the "silently double-counted revenue" red
flag the brief calls out. I kept the first occurrence (the lower line number) arbitrarily
since each pair is byte-identical.

---

### Issue 2 — Property name inconsistency (case + trailing whitespace)
**Found:** 5 real properties stored as **9 distinct string values**. Full line lists,
verified against the file:

| Raw value | Count | Lines |
|---|---|---|
| `Marigold Suites` | 24 | 2, 8, 15, 34, 39, 52, 57, 63, 69, 81, 97, 121, 134, 143, 144, 149, 188, 189, 190, 208, 219, 220, 222, 228 |
| `Marigold Suites ` (trailing space) | 28 | 6, 61, 71, 73, 75, 82, 83, 84, 102, 118, 119, 127, 131, 135, 136, 139, 155, 159, 166, 170, 175, 176, 184, 211, 212, 223, 235, 237 |
| `MARIGOLD SUITES` | 26 | 27, 43, 44, 46, 50, 51, 56, 64, 65, 110, 122, 124, 128, 173, 193, 200, 206, 207, 213, 215, 216, 218, 225, 230, 234, 239 |
| `cedar court` | 20 | 3, 11, 13, 45, 62, 79, 103, 111, 117, 140, 146, 160, 174, 178, 196, 197, 201, 205, 227, 233 |
| `Cedar Court` | 14 | 18, 53, 78, 86, 87, 94, 105, 107, 151, 180, 185, 204, 224, 231 |
| `Palm grove inn` | 32 | 10, 17, 19, 21, 26, 29, 33, 35, 37, 48, 49, 66, 68, 76, 88, 91, 92, 96, 99, 101, 104, 113, 114, 123, 138, 164, 168, 169, 171, 186, 191, 236 |
| `Palm Grove Inn` | 24 | 14, 36, 40, 54, 55, 58, 70, 72, 89, 90, 112, 130, 142, 152, 157, 161, 167, 177, 179, 182, 187, 198, 199, 209 |
| `Lakeview Residency` | 49 | 4, 5, 7, 9, 16, 22, 23, 25, 28, 30, 32, 38, 41, 42, 74, 77, 93, 95, 98, 100, 106, 108, 109, 125, 126, 129, 137, 141, 145, 147, 148, 150, 153, 154, 156, 158, 162, 163, 165, 183, 192, 194, 195, 202, 203, 217, 229, 232, 238 |
| `Birchwood Stay` | 21 | 12, 20, 24, 31, 47, 59, 60, 67, 80, 85, 115, 116, 120, 132, 133, 172, 181, 210, 214, 221, 226 |

(`Lakeview Residency` and `Birchwood Stay` only ever appear in one canonical form in this
file — included for completeness, not because they needed fixing.)

Without normalizing this, a naive `GROUP BY property` would split Marigold Suites into 3
fake "properties," and Palm Grove Inn / Cedar Court into 2 each — directly breaking the
client's first question ("how is each property doing").

**Fix (`clean.py` lines 21–28):**
```python
property_map = {
    'marigold suites': 'Marigold Suites',
    'cedar court': 'Cedar Court',
    'lakeview residency': 'Lakeview Residency',
    'palm grove inn': 'Palm Grove Inn',
    'birchwood stay': 'Birchwood Stay',
}
df['property'] = df['property'].str.strip().str.lower().map(property_map)
```
**Before:** 9 unique strings, 5 real properties. **After:** exactly 5 canonical names.

---

### Issue 3 — Status field case inconsistency
**Found:** 4 real statuses stored as 6 string variants:

| Raw value | Count | Lines |
|---|---|---|
| `Checked-out` | 44 | 2, 8, 16, 17, 27, 42, 43, 60, 62, 67, 69, 70, 77, 82, 93, 96, 103, 105, 115, 116, 118, 120, 122, 129, 132, 134, 142, 145, 156, 158, 159, 160, 166, 170, 185, 189, 198, 200, 201, 202, 212, 216, 226, 227 |
| `CHECKED OUT` | 36 | 3, 4, 6, 11, 19, 22, 23, 25, 34, 48, 52, 58, 63, 68, 71, 78, 80, 83, 91, 102, 106, 125, 126, 127, 131, 133, 151, 152, 153, 155, 163, 172, 178, 193, 207, 213 |
| `confirmed` | 37 | 15, 28, 30, 32, 38, 40, 44, 45, 53, 54, 73, 74, 90, 104, 107, 109, 110, 112, 128, 135, 144, 147, 148, 149, 154, 157, 164, 169, 174, 175, 184, 191, 199, 220, 228, 233, 234 |
| `Confirmed` | 34 | 20, 24, 29, 33, 50, 57, 59, 61, 64, 79, 81, 84, 101, 111, 114, 123, 130, 140, 141, 146, 150, 162, 167, 173, 183, 188, 190, 197, 205, 208, 221, 225, 235, 239 |
| `Cancelled` | 42 | 7, 13, 14, 21, 26, 31, 36, 37, 41, 49, 51, 66, 72, 86, 97, 98, 100, 117, 136, 139, 161, 165, 168, 176, 180, 187, 196, 203, 206, 210, 211, 215, 217, 219, 222, 223, 224, 230, 231, 232, 236, 237 |
| `No-show` | 45 | 5, 9, 10, 12, 18, 35, 39, 46, 47, 55, 56, 65, 75, 76, 85, 87, 88, 89, 92, 94, 95, 99, 108, 113, 119, 121, 124, 137, 138, 143, 171, 177, 179, 181, 182, 186, 192, 194, 195, 204, 209, 214, 218, 229, 238 |

There's no separate lowercase "no show" variant in this file — only the two case variants
shown above for `checked-out` and `confirmed`. `Cancelled` and `No-show` each only appear
in one casing here. I kept the extra `'no show'` key in the mapping defensively for future
exports, even though it matches 0 lines in this specific file.

**Fix (`clean.py` lines 34–42):**
```python
status_map = {
    'checked-out': 'checked-out', 'checked out': 'checked-out',
    'confirmed': 'confirmed', 'cancelled': 'cancelled',
    'no-show': 'no-show', 'no show': 'no-show',
}
df['status'] = df['status'].str.strip().str.lower().map(status_map)
```
**Why this matters more than cosmetics:** this field gates revenue recognition. If
`'CHECKED OUT'` weren't normalized to match `'checked-out'`, 36 lines' worth of real
revenue would be silently excluded from the dashboard.

---

### Issue 4 — Booking channel case inconsistency + missing values
**Found:**

| Raw value | Count | Lines |
|---|---|---|
| `Direct` | 28 | 2, 6, 12, 15, 18, 30, 33, 39, 40, 53, 56, 104, 112, 119, 121, 126, 131, 133, 135, 139, 159, 162, 186, 190, 196, 212, 217, 219 |
| `direct` | 32 | 3, 10, 24, 28, 29, 35, 42, 43, 52, 58, 65, 73, 78, 85, 113, 116, 144, 171, 174, 177, 178, 179, 183, 192, 202, 210, 221, 223, 226, 233, 235, 238 |
| `OTA-MMT` | 35 | 4, 13, 44, 51, 55, 59, 61, 62, 69, 71, 98, 109, 110, 117, 142, 145, 148, 149, 152, 154, 157, 160, 166, 182, 189, 199, 206, 207, 209, 211, 214, 218, 222, 225, 231 |
| `ota-mmt` | 28 | 5, 7, 16, 20, 23, 34, 41, 45, 57, 63, 75, 76, 77, 80, 93, 97, 124, 155, 164, 167, 169, 173, 187, 188, 200, 201, 208, 230 |
| `Corporate` | 35 | 9, 14, 17, 32, 36, 38, 46, 66, 72, 82, 86, 88, 90, 92, 94, 100, 102, 118, 122, 129, 130, 134, 137, 138, 143, 153, 161, 168, 170, 180, 181, 184, 193, 203, 234 |
| `OTA-Booking` | 20 | 8, 21, 25, 31, 79, 95, 99, 107, 108, 132, 141, 158, 163, 165, 185, 198, 215, 220, 228, 232 |
| `Walk-in` | 31 | 19, 22, 37, 47, 49, 50, 64, 67, 70, 81, 83, 84, 87, 89, 96, 101, 111, 120, 125, 136, 146, 151, 175, 176, 194, 204, 205, 213, 216, 227, 237 |
| **(blank/null)** | **29** | 11, 26, 27, 48, 54, 60, 68, 74, 91, 103, 105, 106, 114, 115, 123, 127, 128, 140, 147, 150, 156, 172, 191, 195, 197, 224, 229, 236, 239 |

`Corporate`, `OTA-Booking`, and `Walk-in` only ever appear in one casing in this file —
listed for completeness, not because they needed normalizing.

**Fix (`clean.py` lines 48–55):**
```python
channel_map = {
    'direct': 'Direct', 'ota-mmt': 'OTA-MMT', 'ota-booking': 'OTA-Booking',
    'corporate': 'Corporate', 'walk-in': 'Walk-in',
}
df['booking_channel'] = df['booking_channel'].str.strip().str.lower().map(channel_map).fillna('Unknown')
```
**Decision on the 29 blank cells:** I did **not** drop these rows or guess a channel. I
labeled them `'Unknown'` and kept them as their own category on the Channels tab. Dropping
them would silently shrink revenue; guessing (e.g. defaulting to "Direct") would inflate
the most profitable channel artificially.

---

### Issue 5 — Room type inconsistency (abbreviations)
**Found:**

| Raw value | Count | Lines |
|---|---|---|
| `Standard` | 48 | 3, 7, 10, 11, 17, 18, 23, 27, 28, 29, 30, 35, 38, 44, 50, 69, 73, 74, 75, 78, 79, 96, 106, 108, 112, 120, 124, 133, 138, 139, 140, 152, 157, 158, 160, 171, 196, 199, 200, 202, 203, 211, 212, 224, 230, 234, 236, 238 |
| `Std` | 49 | 5, 15, 19, 21, 36, 45, 47, 51, 61, 64, 67, 68, 76, 85, 86, 92, 93, 98, 102, 104, 105, 107, 109, 126, 127, 131, 132, 141, 143, 148, 150, 153, 154, 156, 164, 169, 174, 179, 180, 185, 188, 197, 206, 217, 220, 222, 227, 237, 239 |
| `Deluxe` | 57 | 12, 13, 16, 22, 24, 32, 34, 42, 43, 48, 49, 52, 53, 55, 58, 59, 60, 62, 72, 77, 81, 83, 87, 91, 99, 103, 111, 117, 128, 130, 134, 135, 136, 137, 142, 144, 147, 151, 162, 163, 165, 168, 175, 176, 182, 184, 190, 191, 192, 204, 205, 207, 209, 216, 228, 231, 235 |
| `DLX` | 35 | 4, 8, 20, 26, 31, 33, 37, 40, 41, 57, 65, 66, 70, 88, 95, 97, 125, 145, 166, 167, 173, 177, 186, 187, 189, 193, 195, 210, 213, 214, 215, 218, 221, 223, 233 |
| `Suite` | 49 | 2, 6, 9, 14, 25, 39, 46, 54, 56, 63, 71, 80, 82, 84, 89, 90, 94, 100, 101, 110, 113, 114, 115, 116, 118, 119, 121, 122, 123, 129, 146, 149, 155, 159, 161, 170, 172, 178, 181, 183, 194, 198, 201, 208, 219, 225, 226, 229, 232 |

**Fix (`clean.py` lines 61–68):** same strip/lower/map pattern as Issues 2–4. Not used
directly in the health score, but kept clean since the client may want a room-type
breakdown later.

---

### Issue 6 — Four different date formats in one column, no format flag
**Found:** `check_in_date` mixes 4 formats:

| Format | Count | Lines |
|---|---|---|
| `YYYY-MM-DD` | 57 | 2, 6, 11, 22, 28, 32, 36, 43, 53, 64, 67, 69, 71, 80, 85, 86, 87, 88, 93, 94, 96, 101, 102, 103, 109, 111, 118, 121, 127, 129, 130, 131, 132, 142, 152, 157, 160, 173, 176, 178, 181, 184, 195, 196, 199, 205, 206, 207, 208, 211, 218, 222, 224, 227, 231, 232, 239 |
| `D/M/YYYY` or `DD/MM/YYYY` (slash) | 60 | 4, 5, 9, 15, 21, 26, 30, 31, 35, 38, 39, 49, 50, 54, 56, 58, 59, 61, 63, 68, 76, 83, 89, 90, 97, 98, 100, 107, 110, 114, 117, 119, 120, 123, 128, 135, 136, 137, 139, 141, 144, 148, 149, 150, 151, 153, 159, 164, 171, 180, 182, 190, 193, 194, 198, 202, 204, 209, 214, 233 |
| `D Mon YYYY` (text month) | 56 | 3, 7, 12, 13, 14, 17, 19, 24, 27, 33, 34, 40, 52, 55, 57, 62, 65, 70, 72, 75, 78, 81, 82, 92, 95, 105, 124, 126, 133, 145, 146, 154, 156, 161, 163, 168, 169, 170, 172, 177, 179, 185, 186, 188, 192, 212, 216, 219, 223, 225, 228, 229, 234, 235, 236, 237 |
| `XX-XX-YYYY` (dash) | 65 | 8, 10, 16, 18, 20, 23, 25, 29, 37, 41, 42, 44, 45, 46, 47, 48, 51, 60, 66, 73, 74, 77, 79, 84, 91, 99, 104, 106, 108, 112, 113, 115, 116, 122, 125, 134, 138, 140, 143, 147, 155, 158, 162, 165, 166, 167, 174, 175, 183, 187, 189, 191, 197, 200, 201, 203, 210, 213, 215, 217, 220, 221, 226, 230, 238 |

57 + 60 + 56 + 65 = 238. Every line accounted for, no leftover format.

**Proving the field order for the two ambiguous formats, directly from the data —
not assumed:**
- **Slash format:** of the 60 slash-format lines, **39** have a first component > 12
  (e.g. line 9: `22/02/2026` — "22" cannot be a month) — only possible if the format is
  **DD/MM/YYYY**. Checked the opposite direction too: **0** slash lines have a *second*
  component > 12, so there is zero evidence anywhere in the file for MM/DD/YYYY.
  Full list of the 39 proof lines: 9, 15, 26, 30, 39, 49, 50, 54, 56, 58, 59, 61, 63, 68,
  76, 89, 90, 97, 107, 110, 114, 117, 119, 120, 123, 135, 137, 141, 144, 149, 150, 164, 180,
  194, 198, 202, 204, 214, 233.
- **Dash format:** of the 65 dash-format lines, **34** have a *second* component > 12
  (e.g. line 23: `03-20-2026` — "20" cannot be a month) — only possible if the format is
  **MM-DD-YYYY**. Checked the opposite direction: **0** dash lines have a first component
  > 12, so there's zero evidence for DD-MM-YYYY. Full list of the 34 proof lines: 23, 25,
  42, 45, 48, 51, 60, 79, 84, 91, 99, 104, 112, 113, 115, 122, 138, 140, 143, 147, 155, 158,
  162, 165, 175, 187, 189, 197, 200, 210, 217, 220, 230, 238.

Because the unambiguous subset of each format always resolves the same way and never
contradicts itself, I applied that one consistent field order to *every* line in that
format — including lines where the day happens to be ≤ 12 and would otherwise look
ambiguous in isolation (e.g. line 42: `03-21-2026` reads as MM-DD → 21 March 2026, the same
rule as its unambiguous neighbors, rather than guessing DD-MM for that one line alone).

**Fix (`clean.py` lines 79–98):**
```python
def parse_date(date_str):
    date_str = str(date_str).strip()
    try:
        if re.fullmatch(r'\d{4}-\d{2}-\d{2}', date_str):
            return datetime.strptime(date_str, '%Y-%m-%d').strftime('%Y-%m-%d')
        if re.fullmatch(r'\d{1,2} [A-Za-z]{3,9} \d{4}', date_str):
            return datetime.strptime(date_str, '%d %b %Y').strftime('%Y-%m-%d')
        if re.fullmatch(r'\d{1,2}/\d{1,2}/\d{4}', date_str):
            return datetime.strptime(date_str, '%d/%m/%Y').strftime('%Y-%m-%d')
        if re.fullmatch(r'\d{2}-\d{2}-\d{4}', date_str):
            return datetime.strptime(date_str, '%m-%d-%Y').strftime('%Y-%m-%d')
        return None
    except Exception:
        return None
df['check_in_date'] = df['check_in_date'].apply(parse_date)
```
**Why my earlier version of this logic was wrong, and how I caught it:** my first draft
used a generic fallback (`dateutil.parser` with `dayfirst=True`) for any date it couldn't
match exactly, instead of an explicit rule per format. That fallback silently mis-parsed
dash-format dates as DD-MM instead of MM-DD whenever the day was ≤ 12 — e.g. `05-11-2026`
was read as 11 May instead of the correct 5 November... except "5 November" isn't even in
the Jan–May window, which is what tipped me off: the monthly revenue trend chart no longer
summed to the same total shown in the KPI card, because some bookings had silently been
re-dated outside the dataset's own stated range. I caught this by reconciling the monthly
trend total against the property's total revenue figure — they have to match by
definition, and they didn't. Replacing the fallback with four explicit `strptime` rules
(each proven against the data above, not assumed) fixed it: every check-in date now falls
inside Jan–May 2026, with no exceptions.

---

### Issue 7 — Zero-night bookings (logically impossible)
**Found:** 4 lines with `nights = 0` but a non-zero `total_amount_inr`:

| Line | booking_id | property | total_amount_inr | status |
|---|---|---|---|---|
| 72 | BK1220 | Palm Grove Inn | 2915 | Cancelled |
| 110 | BK1133 | MARIGOLD SUITES | 29320 | confirmed |
| 192 | BK1268 | Lakeview Residency | 21504 | No-show |
| 215 | BK1107 | MARIGOLD SUITES | 2915 | Cancelled |

**Fix (`clean.py` lines 104–106):**
```python
before = len(df)
df = df[df['nights'] > 0]
print(f"[Issue 7] Removed {before - len(df)} zero-night rows")
```
**Why drop instead of impute:** there's no defensible stay length to infer for a booking
that, by its own `nights` value, never happened. Two of the four (Cancelled/No-show)
wouldn't hit revenue anyway; the other two can't be corrected without contacting the
property.

---

### Issue 8 — Negative revenue values
**Found:** 5 lines with a **negative** `total_amount_inr` despite positive
`nightly_rate_inr` and `nights`:

| Line | booking_id | property | rate × nights | total_amount_inr (raw) |
|---|---|---|---|---|
| 68 | BK1250 | Palm grove inn | 4071 × 7 = 28497 | **−28497** |
| 101 | BK1179 | Palm grove inn | 4253 × 5 = 21265 | **−21265** |
| 118 | BK1067 | Marigold Suites | 3046 × 3 = 9138 | **−9138** |
| 154 | BK1238 | Lakeview Residency | 5718 × 5 = 28590 | **−28590** |
| 198 | BK1213 | Palm Grove Inn | 3455 × 7 = 24185 | **−24185** |

The magnitude matches `rate × nights` exactly in every case — strong evidence this is a
sign-entry error, not a genuine negative charge.

**Fix (`clean.py` lines 111–112):**
```python
neg_count = (df['total_amount_inr'] < 0).sum()
df['total_amount_inr'] = df['total_amount_inr'].abs()
```
**Before → After:** line 68: −28497 → 28497 (same pattern for the other 4 lines above).

---

### Issue 9 — 10× data-entry typo in total_amount
**Found:** 7 lines (lines 116 and 226 are the same booking, BK1126, also counted under
Issue 1) where `total_amount_inr` is **exactly 10×** `nightly_rate_inr × nights`:

| Line | booking_id | property | rate × nights | total_amount_inr (raw) | ratio |
|---|---|---|---|---|---|
| 7 | BK1118 | Lakeview Residency | 2725 × 3 = 8175 | 81750 | 10.0× |
| 34 | BK1214 | Marigold Suites | 2723 × 2 = 5446 | 54460 | 10.0× |
| 89 | BK1164 | Palm Grove Inn | 3664 × 5 = 18320 | 183200 | 10.0× |
| 103 | BK1181 | cedar court | 3011 × 3 = 9033 | 90330 | 10.0× |
| 106 | BK1146 | Lakeview Residency | 6516 × 3 = 19548 | 195480 | 10.0× |
| 116 | BK1126 | Birchwood Stay | 4210 × 7 = 29470 | 294700 | 10.0× |
| 226 | BK1126 (dup of line 116) | Birchwood Stay | 4210 × 7 = 29470 | 294700 | 10.0× |

At line 116 alone, ₹294,700 vs. the correct ₹29,470 is a ₹265,230 overstatement for one
booking — large enough to swing Birchwood Stay's entire revenue ranking if left in.

**Fix (`clean.py` lines 118–123):**
```python
has_rate = df['nightly_rate_inr'].notna()
expected = df.loc[has_rate, 'nightly_rate_inr'] * df.loc[has_rate, 'nights']
actual = df.loc[has_rate, 'total_amount_inr']
ratio = actual / expected
typo_mask = has_rate & ((ratio > 8) & (ratio < 12))
df.loc[typo_mask, 'total_amount_inr'] = expected[typo_mask]
```
**Before → After:** line 116: 294700 → **29470**.
**Why a band (8–12×) instead of exactly 10:** real-world rounding could put a genuine typo
at 9.98 or 10.02. Because the ratio is computed against *that booking's own* `nights`
value, a coincidental match for an unrelated reason is extremely unlikely — and in this
dataset, every single flagged line landed at precisely 10.0, with zero lines in the 8–10 or
10–12 range that weren't exactly 10. That's a clean signal, not a borderline judgment call.

---

### Issue 10 — Missing `nightly_rate_inr` (9 lines)
**Found:**

| Line | booking_id | property | nights | total_amount_inr |
|---|---|---|---|---|
| 21 | BK1248 | Palm grove inn | 4 | 30644 |
| 42 | BK1266 | Lakeview Residency | 1 | 3466 |
| 99 | BK1037 | Palm grove inn | 2 | 11564 |
| 102 | BK1056 | Marigold Suites | 4 | 12068 |
| 112 | BK1216 | Palm Grove Inn | 1 | 3042 |
| 159 | BK1001 | Marigold Suites | 1 | 7058 |
| 163 | BK1243 | Lakeview Residency | 1 | 6702 |
| 164 | BK1194 | Palm grove inn | 7 | 47705 |
| 211 | BK1263 | Marigold Suites | 2 | 8072 |

**Fix (`clean.py` lines 129–132):**
```python
missing_rate = df['nightly_rate_inr'].isna() & df['total_amount_inr'].notna() & (df['nights'] > 0)
df.loc[missing_rate, 'nightly_rate_inr'] = (df.loc[missing_rate, 'total_amount_inr'] / df.loc[missing_rate, 'nights']).round(0)
```
**Before → After:** line 163: nightly_rate_inr blank → **6702** (6702 ÷ 1).
Recomputed rather than dropped because both other fields are reliable here.

---

### Issue 11 — Missing `total_amount_inr` (3 lines)
**Found:**

| Line | booking_id | property | nights | nightly_rate_inr |
|---|---|---|---|---|
| 22 | BK1231 | Lakeview Residency | 2 | 4009 |
| 170 | BK1239 | Marigold Suites | 5 | 7539 |
| 197 | BK1081 | cedar court | 2 | 6662 |

**Fix (`clean.py` lines 138–141):**
```python
missing_total = df['total_amount_inr'].isna() & df['nightly_rate_inr'].notna()
df.loc[missing_total, 'total_amount_inr'] = (df.loc[missing_total, 'nightly_rate_inr'] * df.loc[missing_total, 'nights'])
```
**Before → After:** line 170: total_amount_inr blank → **37695** (7539 × 5).

---

### Issue 12 — Residual unresolvable nulls
**Fix (`clean.py` lines 147–149):**
```python
before = len(df)
df = df.dropna(subset=['property', 'status', 'check_in_date'])
print(f"[Issue 12] Dropped {before - len(df)} rows with unresolvable nulls")
```
After Issues 1–11 were resolved, **0 rows** were dropped here in this dataset — every row
had a resolvable `property`, `status`, and `check_in_date`. I kept the guard anyway since a
future weekly export isn't guaranteed to be this clean.

---

### Final row count
**238 raw → 230 after de-duplication (Issue 1) → 226 after dropping 4 zero-night rows
(Issue 7) → 226 final.** Issues 2–6 and 8–12 are *corrections in place*, not row removals.

---

## 2. Cancelled / No-show Revenue — The Most Important Rule in This Project

> **Only bookings with `status == 'checked-out'` count toward `realized_revenue`.**
> `confirmed`, `cancelled`, and `no-show` all contribute **₹0** to every revenue figure,
> even when `total_amount_inr` is non-blank for them.

I did not delete cancelled/no-show rows — they're real signal for the cancellation
component of the health score and for an honest total-bookings count. They're just
excluded from revenue math everywhere it's computed.

---

## 3. Health Score — Definition & Rationale

```
Health Score = 0.40 × Occupancy Rate
             + 0.30 × Revenue Efficiency
             + 0.20 × Channel Mix Quality
             + 0.10 × Cancellation Score
```

| Component | Weight | What it measures | Formula |
|---|---|---|---|
| Occupancy Rate | 40% | How full the property actually was | checked-out nights ÷ (10 assumed rooms × 150 days), capped at 100 |
| Revenue Efficiency | 30% | Realized revenue vs. what the rate card implies | realized revenue ÷ Σ(rate × nights) for checked-out stays, capped at 100 |
| Channel Mix Quality | 20% | Reliance on higher-margin channels | % of bookings via Direct or Corporate |
| Cancellation Score | 10% | Operational reliability | 100 − (cancelled + no-show) / total bookings × 100 |

**Why occupancy is weighted highest (40%):** an empty room is a loss that can never be
recovered. Revenue depends on occupancy but doesn't capture it directly — a property could
post high revenue from a few expensive stays while sitting mostly empty — so I kept the two
metrics separate rather than letting one stand in for the other.

**Why channel mix is included at all:** the client explicitly asked "which booking
channels are worth it." A property that's mostly OTA-MMT pays commission on almost every
booking even if headline revenue looks fine — channel mix surfaces that margin risk.

**What this score deliberately excludes:**
- **Guest satisfaction / reviews** — not present in this dataset.
- **Seasonality adjustment** — March volume is dramatically higher than every other month
  across all 5 properties. I didn't normalize for this: five months isn't enough data to
  separate "seasonal dip" from "real problem," and a false-precision seasonal adjustment
  would be worse than an honest flat average.
- **Absolute revenue size** — not a direct input, so a large property can score lower than
  a small one if its operations are weaker. Total revenue is still visible on the Overview
  tab — it's just not baked into the score itself.

**Acknowledged weaknesses:**
1. **"10 rooms per property" is an assumption, not in the data.** I kept occupancy in the
   score anyway since it's too central to "how is this property doing" to omit, but the
   assumption is surfaced directly on the dashboard's Health Score tab so the client can
   correct it with one real number.
2. **Revenue Efficiency is capped at 100**, which could mask a property that's genuinely
   upselling above its base rate. I chose the cap because the alternative — letting one
   outlier or uncaught data error push a score above 100 — felt like the worse risk for a
   client-facing 0–100 number.
3. **Channel Mix Quality treats all 29 "Unknown"-channel bookings as low-margin**, even
   though some were probably Direct bookings that just weren't logged. This slightly
   underweights properties with more missing channel data; I surface the raw "Unknown"
   volume separately on the Channels tab so the bias is visible, not hidden.

---

## 4. Assumptions Made (Consolidated)

1. **10 rooms per property, 5-month window (Jan–May 2026)** → 1,500 possible room-nights
   per property, used as the occupancy denominator. Not in the data; stated explicitly.
2. **Slash dates are DD/MM/YYYY; dash dates are MM-DD-YYYY.** Both directions are proven
   directly from the data (39 unambiguous slash lines, 34 unambiguous dash lines — see
   Issue 6) with zero contradicting lines in either format, so the same rule is applied
   consistently to every line in that format, including the ones that would look ambiguous
   in isolation.
3. **Duplicate booking_ids are double-entries, not separate stays** — confirmed by
   identical property, date, amount, and status across both lines in all 8 pairs.
4. **5 distinct properties exist**, derived from the 9 raw string variants by
   case/whitespace normalization.
5. **`Unknown` booking channel is a real category**, not dropped or guessed — guessing
   would distort the channel-mix answer the client explicitly asked for.

---

## 5. What I'd Do With More Time

- **Verify real room counts per property with the client** — removes the single biggest
  assumption in the health score.
- **Investigate the 29 `Unknown`-channel bookings at the source** — likely one property's
  booking system not syncing channel data.
- **Add a seasonality-adjusted occupancy view** once 12+ months of data exist.
- **Cross-check the 6 distinct 10× typo bookings against actual payment records**, since
  I'm currently trusting `nightly_rate_inr` as correct and treating `total_amount_inr` as
  the error — not independently verified against a third source.
- **Add a guest-count sanity check** — multiple lines have `guests = 4` in a Standard room
  (e.g. line 21, BK1248), which is operationally questionable but out of scope for this
  assignment since it doesn't affect the health score or the three questions the client
  asked.