import pandas as pd
import json
import re
from datetime import datetime
from collections import defaultdict

df = pd.read_csv('bookings_jan_may_2026.csv')

print(f"[START] Raw rows: {len(df)}")

# ─────────────────────────────────────────────────────────
# ISSUE 1: Duplicate rows (same booking_id, identical data)
# ─────────────────────────────────────────────────────────
before = len(df)
df = df.drop_duplicates(subset='booking_id', keep='first')
print(f"[Issue 1] Removed {before - len(df)} duplicate rows")

# ─────────────────────────────────────────────────────────
# ISSUE 2: Property name inconsistency (case + whitespace)
# ─────────────────────────────────────────────────────────
property_map = {
    'marigold suites': 'Marigold Suites',
    'cedar court': 'Cedar Court',
    'lakeview residency': 'Lakeview Residency',
    'palm grove inn': 'Palm Grove Inn',
    'birchwood stay': 'Birchwood Stay',
}
df['property'] = df['property'].str.strip().str.lower().map(property_map)
print(f"[Issue 2] Normalized property names")

# ─────────────────────────────────────────────────────────
# ISSUE 3: Status field case chaos
# ─────────────────────────────────────────────────────────
status_map = {
    'checked-out': 'checked-out',
    'checked out': 'checked-out',
    'confirmed': 'confirmed',
    'cancelled': 'cancelled',
    'no-show': 'no-show',
    'no show': 'no-show',
}
df['status'] = df['status'].str.strip().str.lower().map(status_map)
print(f"[Issue 3] Normalized status values")

# ─────────────────────────────────────────────────────────
# ISSUE 4: Booking channel case + nulls
# ─────────────────────────────────────────────────────────
channel_map = {
    'direct': 'Direct',
    'ota-mmt': 'OTA-MMT',
    'ota-booking': 'OTA-Booking',
    'corporate': 'Corporate',
    'walk-in': 'Walk-in',
}
df['booking_channel'] = df['booking_channel'].str.strip().str.lower().map(channel_map).fillna('Unknown')
print(f"[Issue 4] Normalized booking channels, nulls → 'Unknown'")

# ─────────────────────────────────────────────────────────
# ISSUE 5: Room type inconsistency
# ─────────────────────────────────────────────────────────
room_map = {
    'standard': 'Standard',
    'std': 'Standard',
    'deluxe': 'Deluxe',
    'dlx': 'Deluxe',
    'suite': 'Suite',
}
df['room_type'] = df['room_type'].str.strip().str.lower().map(room_map)
print(f"[Issue 5] Normalized room types")

# ─────────────────────────────────────────────────────────
# ISSUE 6: Mixed date formats — 4 explicit formats handled
# FIX: removed dateutil fallback with dayfirst=True which
# was silently misparsing MM-DD-YYYY dates as DD-MM-YYYY
# (e.g. 05-11-2026 → Nov 5 instead of May 11) for any
# date where day ≤ 12. Each format is now parsed with an
# explicit strptime rule verified against the actual data.
# ─────────────────────────────────────────────────────────
def parse_date(date_str):
    date_str = str(date_str).strip()
    try:
        # Format 1: YYYY-MM-DD  (ISO — 57 rows)
        if re.fullmatch(r'\d{4}-\d{2}-\d{2}', date_str):
            return datetime.strptime(date_str, '%Y-%m-%d').strftime('%Y-%m-%d')
        # Format 2: D Mon YYYY  (text month, only "Mar" present — 56 rows)
        if re.fullmatch(r'\d{1,2} [A-Za-z]{3,9} \d{4}', date_str):
            return datetime.strptime(date_str, '%d %b %Y').strftime('%Y-%m-%d')
        # Format 3: DD/MM/YYYY  (slash — first component verified day-first — 60 rows)
        if re.fullmatch(r'\d{1,2}/\d{1,2}/\d{4}', date_str):
            return datetime.strptime(date_str, '%d/%m/%Y').strftime('%Y-%m-%d')
        # Format 4: MM-DD-YYYY  (dash — first component verified month-first — 65 rows)
        if re.fullmatch(r'\d{2}-\d{2}-\d{4}', date_str):
            return datetime.strptime(date_str, '%m-%d-%Y').strftime('%Y-%m-%d')
        return None
    except Exception:
        return None

df['check_in_date'] = df['check_in_date'].apply(parse_date)
print(f"[Issue 6] Normalized date formats")

# ─────────────────────────────────────────────────────────
# ISSUE 7: Zero nights — nonsensical, drop them
# ─────────────────────────────────────────────────────────
before = len(df)
df = df[df['nights'] > 0]
print(f"[Issue 7] Removed {before - len(df)} zero-night rows")

# ─────────────────────────────────────────────────────────
# ISSUE 8: Negative total_amount_inr
# ─────────────────────────────────────────────────────────
neg_count = (df['total_amount_inr'] < 0).sum()
df['total_amount_inr'] = df['total_amount_inr'].abs()
print(f"[Issue 8] Fixed {neg_count} negative total amounts (abs value)")

# ─────────────────────────────────────────────────────────
# ISSUE 9: 10x typo in total_amount (recompute from rate × nights)
# ─────────────────────────────────────────────────────────
has_rate = df['nightly_rate_inr'].notna()
expected = df.loc[has_rate, 'nightly_rate_inr'] * df.loc[has_rate, 'nights']
actual = df.loc[has_rate, 'total_amount_inr']
ratio = actual / expected
typo_mask = has_rate & ((ratio > 8) & (ratio < 12))
df.loc[typo_mask, 'total_amount_inr'] = expected[typo_mask]
print(f"[Issue 9] Fixed {typo_mask.sum()} 10x typo rows in total_amount")

# ─────────────────────────────────────────────────────────
# ISSUE 10: Missing nightly_rate_inr — recompute if possible
# ─────────────────────────────────────────────────────────
missing_rate = df['nightly_rate_inr'].isna() & df['total_amount_inr'].notna() & (df['nights'] > 0)
df.loc[missing_rate, 'nightly_rate_inr'] = (
    df.loc[missing_rate, 'total_amount_inr'] / df.loc[missing_rate, 'nights']
).round(0)
print(f"[Issue 10] Recovered {missing_rate.sum()} nightly rates from total/nights")

# ─────────────────────────────────────────────────────────
# ISSUE 11: Missing total_amount — recompute if possible
# ─────────────────────────────────────────────────────────
missing_total = df['total_amount_inr'].isna() & df['nightly_rate_inr'].notna()
df.loc[missing_total, 'total_amount_inr'] = (
    df.loc[missing_total, 'nightly_rate_inr'] * df.loc[missing_total, 'nights']
)
print(f"[Issue 11] Recovered {missing_total.sum()} total amounts from rate × nights")

# ─────────────────────────────────────────────────────────
# ISSUE 12: Drop rows that still have critical nulls
# ─────────────────────────────────────────────────────────
before = len(df)
df = df.dropna(subset=['property', 'status', 'check_in_date'])
print(f"[Issue 12] Dropped {before - len(df)} rows with unresolvable nulls")

# ─────────────────────────────────────────────────────────
# RULE: Cancelled / no-show → revenue = 0 (NOT excluded,
#        but their total must not count as realized revenue)
# ─────────────────────────────────────────────────────────
df['realized_revenue'] = df.apply(
    lambda r: r['total_amount_inr'] if r['status'] == 'checked-out' and pd.notna(r['total_amount_inr']) else 0,
    axis=1
)

print(f"[DONE] Clean rows: {len(df)}")

# ─────────────────────────────────────────────────────────
# Extract month for trend analysis
# ─────────────────────────────────────────────────────────
df['month'] = pd.to_datetime(df['check_in_date']).dt.strftime('%b')
df['month_num'] = pd.to_datetime(df['check_in_date']).dt.month

ASSUMED_ROOMS = 10
MONTHS_IN_PERIOD = 5
TOTAL_NIGHTS_POSSIBLE = ASSUMED_ROOMS * 30 * MONTHS_IN_PERIOD

properties = sorted(df['property'].dropna().unique().tolist())

# ─────────────────────────────────────────────────────────
# Compute per-property stats
# ─────────────────────────────────────────────────────────
property_stats = []
for prop in properties:
    pf = df[df['property'] == prop]
    checked_out = pf[pf['status'] == 'checked-out']

    total_revenue = float(checked_out['realized_revenue'].sum())
    total_bookings = len(pf)
    cancelled = len(pf[pf['status'] == 'cancelled'])
    no_show = len(pf[pf['status'] == 'no-show'])
    confirmed = len(pf[pf['status'] == 'confirmed'])

    occupied_nights = float(checked_out['nights'].sum())
    occupancy_rate = min(occupied_nights / TOTAL_NIGHTS_POSSIBLE * 100, 100)

    avg_nightly_rate = float(checked_out['nightly_rate_inr'].mean()) if len(checked_out) > 0 else 0

    # Revenue efficiency: actual vs expected (rate × nights)
    if len(checked_out) > 0 and checked_out['nightly_rate_inr'].notna().any():
        expected_rev = float((checked_out['nightly_rate_inr'] * checked_out['nights']).sum())
        rev_efficiency = min((total_revenue / expected_rev * 100) if expected_rev > 0 else 0, 100)
    else:
        rev_efficiency = 0

    # Channel mix quality: Direct + Corporate = high margin
    direct_corp = len(pf[pf['booking_channel'].isin(['Direct', 'Corporate'])])
    channel_mix_score = (direct_corp / total_bookings * 100) if total_bookings > 0 else 0

    # Cancellation penalty
    cancel_rate = (cancelled + no_show) / total_bookings if total_bookings > 0 else 0
    cancellation_score = max(0, 100 - cancel_rate * 100)

    # Health Score = 0.40*occ + 0.30*rev_eff + 0.20*channel + 0.10*cancel
    health_score = round(
        0.40 * occupancy_rate +
        0.30 * rev_efficiency +
        0.20 * channel_mix_score +
        0.10 * cancellation_score,
        1
    )

    # Monthly revenue trend
    monthly = []
    for month_num in range(1, 6):
        mname = ['Jan', 'Feb', 'Mar', 'Apr', 'May'][month_num - 1]
        mf = checked_out[checked_out['month_num'] == month_num]
        monthly.append({'month': mname, 'revenue': float(mf['realized_revenue'].sum())})

    # Channel breakdown
    ch_group = pf.groupby('booking_channel').agg(
        bookings=('booking_id', 'count'),
        revenue=('realized_revenue', 'sum')
    ).reset_index()
    channels = [
        {'channel': row['booking_channel'], 'bookings': int(row['bookings']), 'revenue': float(row['revenue'])}
        for _, row in ch_group.iterrows()
    ]

    property_stats.append({
        'property': prop,
        'totalRevenue': round(total_revenue),
        'totalBookings': total_bookings,
        'checkedOut': len(checked_out),
        'confirmed': confirmed,
        'cancelled': cancelled,
        'noShow': no_show,
        'occupancyRate': round(occupancy_rate, 1),
        'avgNightlyRate': round(avg_nightly_rate),
        'revEfficiency': round(rev_efficiency, 1),
        'channelMixScore': round(channel_mix_score, 1),
        'cancellationScore': round(cancellation_score, 1),
        'healthScore': health_score,
        'monthlyTrend': monthly,
        'channelBreakdown': channels,
    })

# ─────────────────────────────────────────────────────────
# Overall channel stats (all properties combined)
# ─────────────────────────────────────────────────────────
all_channels = df.groupby('booking_channel').agg(
    bookings=('booking_id', 'count'),
    revenue=('realized_revenue', 'sum'),
    avgValue=('realized_revenue', 'mean')
).reset_index()
channel_summary = [
    {
        'channel': row['booking_channel'],
        'bookings': int(row['bookings']),
        'revenue': float(row['revenue']),
        'avgBookingValue': round(float(row['avgValue']), 0)
    }
    for _, row in all_channels.iterrows()
]

# ─────────────────────────────────────────────────────────
# Data quality summary (for the dashboard badge)
# ─────────────────────────────────────────────────────────
raw_count = 238
clean_count = len(df)

output = {
    'properties': property_stats,
    'channelSummary': channel_summary,
    'dataQuality': {
        'rawRows': raw_count,
        'cleanRows': clean_count,
        'droppedRows': raw_count - clean_count,
        'assumedRoomsPerProperty': ASSUMED_ROOMS,
    }
}

import os
os.makedirs('public', exist_ok=True)
with open('public/cleaned_data.json', 'w') as f:
    json.dump(output, f, indent=2)

print("\n✅ Output written to public/cleaned_data.json")