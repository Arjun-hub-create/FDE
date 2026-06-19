// ============================================================================
// "IMPORTS & CONSTANTS"
// Purpose: Import React hooks, chart components, icons, and declare global values.
// ============================================================================
import { useState, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { Building2, TrendingUp, IndianRupee, AlertTriangle, CheckCircle, Wifi } from "lucide-react";

// Global color palette used for graphs and channels
const COLORS = ["#2D4A3E", "#7BAF8E", "#EBAF5A", "#C05A50", "#6B8F71", "#A0C4B0"];

// ============================================================================
// "HELPER FUNCTIONS"
// Purpose: Format numbers and determine dynamic CSS classes based on scores.
// ============================================================================

/**
 * "fmt"
 * Purpose: Formats numbers into a readable currency format in Indian Rupees (₹).
 * It converts thousands to 'K' and lakhs to 'L'.
 */
const fmt = (n) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` :
  n >= 1000   ? `₹${(n / 1000).toFixed(1)}K`   : `₹${n}`;

/**
 * "scoreColor"
 * Purpose: Returns the CSS text color class depending on the health score value.
 */
const scoreColor = (s) =>
  s >= 60 ? "text-green-700" : s >= 45 ? "text-amber-600" : "text-red-600";

/**
 * "scoreBg"
 * Purpose: Returns CSS background/border color classes based on health score status.
 */
const scoreBg = (s) =>
  s >= 60
    ? "bg-green-50 border-green-300"
    : s >= 45
    ? "bg-amber-50 border-amber-300"
    : "bg-red-50 border-red-300";

/**
 * "scoreBar"
 * Purpose: Returns the CSS color class of progress bars corresponding to the health score level.
 */
const scoreBar = (s) =>
  s >= 60 ? "bg-green-600" : s >= 45 ? "bg-amber-500" : "bg-red-500";

// ============================================================================
// "UI SUB-COMPONENTS"
// Purpose: Reusable elements that structure individual cards, rings, and tooltips.
// ============================================================================

/**
 * "ScoreRing"
 * Purpose: Renders a visual circular SVG gauge representing the property's health score.
 * Changes colors dynamically (Green/Yellow/Red) based on performance threshold.
 */
function ScoreRing({ score }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 60 ? "#4A8F66" : score >= 45 ? "#C98A1A" : "#C05A50";
  return (
    <svg width="90" height="90" style={{ transform: "rotate(-90deg)" }}>
      <circle cx="45" cy="45" r={r} fill="none" stroke="#E8E2D9" strokeWidth="8" />
      <circle
        cx="45" cy="45" r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1s ease" }}
      />
      <text
        x="45" y="50" textAnchor="middle" fill={color}
        fontSize="16" fontWeight="bold"
        style={{ transform: "rotate(90deg)", transformOrigin: "45px 45px" }}
      >
        {score}
      </text>
    </svg>
  );
}

/**
 * "StatCard"
 * Purpose: A metric display card presenting a title, numeric value, sub-label, and icon.
 */
function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-stone-500 text-xs">{label}</p>
        <p className="text-stone-900 font-bold text-lg leading-tight">{value}</p>
        {sub && <p className="text-stone-400 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/**
 * "PropertyCard"
 * Purpose: A sidebar selection button displaying a property's name, score, and linear progress bar.
 */
function PropertyCard({ p, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 mb-2 ${
        selected
          ? "bg-white/15 border-white/40"
          : "bg-transparent border-white/10 hover:border-white/30 hover:bg-white/10"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-green-50 truncate">{p.property}</span>
        <span className={`text-sm font-bold ${scoreColor(p.healthScore)}`}>{p.healthScore}</span>
      </div>
      <div className="mt-1.5 h-1.5 bg-white/15 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${scoreBar(p.healthScore)}`}
          style={{ width: `${p.healthScore}%` }}
        />
      </div>
    </button>
  );
}

/**
 * "CustomTooltip"
 * Purpose: A custom popup tooltip for charts that formats values and currency labels.
 */
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-stone-300 rounded-lg p-3 shadow-xl">
        <p className="text-stone-500 text-xs mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }} className="text-sm font-semibold">
            {p.name}:{" "}
            {typeof p.value === "number" && p.name.toLowerCase().includes("revenue")
              ? fmt(p.value)
              : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// ============================================================================
// "MAIN APP COMPONENT"
// Purpose: Primary component managing fetch logic, global view state, and layout.
// ============================================================================
export default function App() {
  // ── "STATE VARIABLE DEFINITIONS" ──
  // - data: stores the complete dashboard dataset fetched from the JSON.
  // - selected: index representing currently active/clicked property.
  // - tab: string representing currently selected tab ("overview", "channels", "health").
  // - loading: tracks API/fetch call execution state.
  const [data, setData]       = useState(null);
  const [selected, setSelected] = useState(0);
  const [tab, setTab]         = useState("overview");
  const [loading, setLoading] = useState(true);

  // ── "DATA ACQUISITION" ──
  // Purpose: Fetches properties and analytics payload from local public file.
  useEffect(() => {
    fetch("/cleaned_data.json")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // ── "LOADING FALLBACK VIEW" ──
  // Purpose: Spinner indicating file load progress.
  if (loading)
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-800 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-stone-500">Loading dashboard…</p>
        </div>
      </div>
    );

  // ── "ERROR FALLBACK VIEW" ──
  // Purpose: Informs user if raw JSON retrieval failed.
  if (!data)
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <p className="text-red-600">Failed to load data. Check public/cleaned_data.json</p>
      </div>
    );

  // ── "DATA COMPUTATION & MAPS" ──
  // Purpose: Filters details for the current property selection and reformats data structures
  // to feed into comparison charts.
  const props      = data.properties;
  const p          = props[selected];
  const dq         = data.dataQuality;
  const allRevenue = props.map((x) => ({
    name: x.property.split(" ")[0],
    revenue: x.totalRevenue,
  }));
  const healthData = props.map((x) => ({
    name: x.property.split(" ")[0],
    score: x.healthScore,
  }));

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 flex flex-col">

      {/* ── "HEADER SECTION" ──
          Purpose: Top menu bar holding brand logo, name, dashboard title, and simple 
          statistics regarding loaded vs. cleaned data rows. */}
      <header className="border-b border-stone-200 bg-[#2D4A3E] sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#7BAF8E] p-1.5 rounded-lg">
              <Building2 size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-none">Fernhill Stays</h1>
              <p className="text-green-200/60 text-xs">Property Intelligence Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5">
            <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse" />
            <span className="text-green-100 text-xs">Jan – May 2026</span>
            <span className="text-white/30 text-xs mx-1">|</span>
            <span className="text-green-200/70 text-xs">
              {dq.rawRows} raw → {dq.cleanRows} clean rows
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-screen-2xl mx-auto w-full px-4 py-4 gap-4">

        {/* ── "SIDEBAR SECTION" ──
            Purpose: Sidebar panel presenting property listings with interactive selector buttons,
            and audit statistics outlining general data consistency. */}
        <aside className="w-56 shrink-0 bg-[#2D4A3E] rounded-2xl p-3">
          <p className="text-green-200/50 text-xs uppercase tracking-wider mb-3 px-1">Properties</p>
          {props.map((x, i) => (
            <PropertyCard
              key={x.property} p={x}
              selected={i === selected}
              onClick={() => setSelected(i)}
            />
          ))}

          <div className="mt-4 bg-white/10 border border-white/15 rounded-xl p-3">
            <p className="text-green-200/70 text-xs font-medium mb-2 flex items-center gap-1">
              <Wifi size={12} /> Data Quality
            </p>
            <div className="space-y-1 text-xs">
              {[
                ["Raw rows",    dq.rawRows,      "text-green-50"],
                ["Clean rows",  dq.cleanRows,    "text-green-300"],
                ["Dropped",     dq.droppedRows,  "text-amber-400"],
                ["Issues fixed","12 types",      "text-green-200"],
              ].map(([k, v, c]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-green-200/50">{k}</span>
                  <span className={c}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ── "MAIN CONTENT SECTION" ──
            Purpose: Area holding the primary view logic based on tabs navigation selection. */}
        <main className="flex-1 min-w-0 space-y-4">

          {/* ── "TAB CHANGER BUTTONS" ──
              Purpose: Standard navigation buttons to switch views between property metrics, 
              marketing channels performance, or operational health grades. */}
          <div className="flex gap-2">
            {[
              ["overview", "📊 Overview"],
              ["channels", "📡 Channels"],
              ["health",   "❤️ Health Score"],
            ].map(([key, label]) => (
              <button
                key={key} onClick={() => setTab(key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  tab === key
                    ? "bg-[#2D4A3E] text-white"
                    : "bg-white text-stone-500 hover:text-stone-800 border border-stone-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── "PANEL VIEW: OVERVIEW" ──
              Purpose: Outlines primary operational stats, monthly income graphs, 
              and cross-property financial comparison metrics. */}
          {tab === "overview" && (
            <div className="space-y-4">

              {/* Selected Property Title Card & Health Score Gauge */}
              <div className="bg-white border border-stone-200 rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-stone-900">{p.property}</h2>
                    <p className="text-stone-400 text-sm mt-0.5">
                      Jan – May 2026 · {p.totalBookings} bookings
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-stone-400 text-xs mb-1">Health Score</p>
                    <ScoreRing score={p.healthScore} />
                  </div>
                </div>
              </div>

              {/* KPI row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={IndianRupee}   label="Realized Revenue"  value={fmt(p.totalRevenue)}                    sub="checked-out only"                          color="bg-[#2D4A3E]" />
                <StatCard icon={TrendingUp}    label="Avg Nightly Rate"  value={`₹${p.avgNightlyRate.toLocaleString()}`} sub="checked-out stays"                        color="bg-[#7BAF8E]" />
                <StatCard icon={CheckCircle}   label="Checked Out"       value={p.checkedOut}                           sub={`of ${p.totalBookings} total`}             color="bg-[#6B8F71]" />
                <StatCard icon={AlertTriangle} label="Cancellations"     value={p.cancelled + p.noShow}                 sub={`${p.cancelled} cancel · ${p.noShow} no-show`} color="bg-amber-500" />
              </div>

              {/* Status breakdown */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Checked Out", val: p.checkedOut,  color: "bg-green-600" },
                  { label: "Confirmed",   val: p.confirmed,   color: "bg-[#2D4A3E]"  },
                  { label: "Cancelled",   val: p.cancelled,   color: "bg-red-500"     },
                  { label: "No-Show",     val: p.noShow,      color: "bg-amber-500"   },
                ].map((x) => (
                  <div key={x.label} className="bg-white border border-stone-200 rounded-xl p-3 text-center">
                    <div className={`w-2 h-2 rounded-full ${x.color} mx-auto mb-2`} />
                    <p className="text-stone-900 font-bold text-lg">{x.val}</p>
                    <p className="text-stone-400 text-xs">{x.label}</p>
                  </div>
                ))}
              </div>

              {/* Monthly trend */}
              <div className="bg-white border border-stone-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-stone-600 mb-4">
                  Monthly Revenue Trend — {p.property}
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={p.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E7E2DA" />
                    <XAxis dataKey="month" tick={{ fill: "#78716c", fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => fmt(v)} tick={{ fill: "#78716c", fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone" dataKey="revenue" stroke="#2D4A3E"
                      strokeWidth={2.5} dot={{ fill: "#2D4A3E", r: 4 }}
                      activeDot={{ r: 6 }} name="Revenue"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* All properties bar */}
              <div className="bg-white border border-stone-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-stone-600 mb-4">
                  Revenue Comparison — All Properties
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={allRevenue} barSize={36}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E7E2DA" />
                    <XAxis dataKey="name" tick={{ fill: "#78716c", fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => fmt(v)} tick={{ fill: "#78716c", fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]}>
                      {allRevenue.map((_, i) => (
                        <Cell key={i} fill={i === selected ? "#2D4A3E" : "#D6D0C4"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── "PANEL VIEW: CHANNELS" ──
              Purpose: Inspects reservation sources (e.g. OTA vs direct bookings) and average reservation sizes. */}
          {tab === "channels" && (
            <div className="space-y-4">

              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                {[...data.channelSummary]
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((c, i) => (
                  <div key={c.channel} className="bg-white border border-stone-200 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i] }} />
                      <span className="text-sm font-medium text-stone-800">{c.channel}</span>
                    </div>
                    <p className="text-lg font-bold text-stone-900">{fmt(c.revenue)}</p>
                    <p className="text-xs text-stone-400">
                      {c.bookings} bookings · avg {fmt(c.avgBookingValue)}
                    </p>
                    <div className="mt-2 h-1 bg-stone-200 rounded-full">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(c.revenue / Math.max(...data.channelSummary.map((x) => x.revenue))) * 100}%`,
                          background: COLORS[i],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Pie + Bar */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-stone-200 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-stone-600 mb-4">
                    Revenue by Channel (All Properties)
                  </h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={data.channelSummary} dataKey="revenue" nameKey="channel"
                        cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={3}
                      >
                        {data.channelSummary.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(v)} />
                      <Legend
                        iconType="circle" iconSize={8}
                        formatter={(v) => (
                          <span style={{ color: "#78716c", fontSize: 11 }}>{v}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white border border-stone-200 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-stone-600 mb-4">
                    Avg Booking Value by Channel
                  </h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={[...data.channelSummary].sort((a, b) => b.avgBookingValue - a.avgBookingValue)}
                      barSize={28}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E7E2DA" />
                      <XAxis dataKey="channel" tick={{ fill: "#78716c", fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => fmt(v)} tick={{ fill: "#78716c", fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="avgBookingValue" name="Avg Value" radius={[4, 4, 0, 0]}>
                        {data.channelSummary.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Per-property table */}
              <div className="bg-white border border-stone-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-stone-600 mb-4">
                  Channel Breakdown — {p.property}
                </h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200">
                      <th className="text-left text-stone-400 font-medium py-2">Channel</th>
                      <th className="text-right text-stone-400 font-medium py-2">Bookings</th>
                      <th className="text-right text-stone-400 font-medium py-2">Revenue</th>
                      <th className="text-right text-stone-400 font-medium py-2">Avg Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...p.channelBreakdown]
                      .sort((a, b) => b.revenue - a.revenue)
                      .map((c, i) => (
                      <tr
                        key={c.channel}
                        className="border-b border-stone-100 hover:bg-stone-50 transition-colors"
                      >
                        <td className="py-2.5 text-stone-800">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full inline-block"
                              style={{ background: COLORS[i % COLORS.length] }}
                            />
                            {c.channel}
                          </span>
                        </td>
                        <td className="py-2.5 text-right text-stone-500">{c.bookings}</td>
                        <td className="py-2.5 text-right text-stone-900 font-medium">{fmt(c.revenue)}</td>
                        <td className="py-2.5 text-right text-stone-500">
                          {c.bookings > 0 ? fmt(Math.round(c.revenue / c.bookings)) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── "PANEL VIEW: HEALTH SCORE" ──
              Purpose: Deep-dive analysis of property wellness scorecard calculations and weightings. */}
          {tab === "health" && (
            <div className="space-y-4">

              {/* Formula box */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <h3 className="text-green-900 font-semibold text-sm mb-1">Health Score Formula</h3>
                <p className="text-stone-500 text-xs leading-relaxed">
                  <span className="text-stone-800 font-mono">
                    Score = 0.40×Occupancy + 0.30×Revenue Efficiency + 0.20×Channel Mix + 0.10×Cancellation Score
                  </span>
                  <br />
                  Assumes {dq.assumedRoomsPerProperty} rooms per property over 5 months.
                  Only checked-out stays count toward occupancy and revenue.
                  Cancelled / no-show bookings penalise the cancellation component.
                </p>
              </div>

              {/* Score rings for all properties */}
              <div className="grid grid-cols-5 gap-3">
                {props.map((x, i) => (
                  <button
                    key={x.property} onClick={() => setSelected(i)}
                    className={`rounded-xl border p-4 text-center transition-all ${scoreBg(x.healthScore)} ${
                      i === selected ? "ring-2 ring-green-800" : ""
                    }`}
                  >
                    <ScoreRing score={x.healthScore} />
                    <p className="text-stone-800 text-xs font-semibold mt-2 leading-tight">{x.property}</p>
                  </button>
                ))}
              </div>

              {/* Health bar chart */}
              <div className="bg-white border border-stone-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-stone-600 mb-4">
                  Health Score — All Properties
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={healthData} barSize={48}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E7E2DA" />
                    <XAxis dataKey="name" tick={{ fill: "#78716c", fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#78716c", fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="score" name="Health Score" radius={[6, 6, 0, 0]}>
                      {healthData.map((x, i) => (
                        <Cell
                          key={i}
                          fill={x.score >= 60 ? "#4A8F66" : x.score >= 45 ? "#C98A1A" : "#C05A50"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Component breakdown */}
              <div className="bg-white border border-stone-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-stone-600 mb-4">
                  Score Breakdown — {p.property}
                </h3>
                {[
                  { label: "Occupancy Rate",       value: p.occupancyRate,    weight: "40%", desc: "Checked-out nights ÷ possible nights (10 rooms × 150 days)" },
                  { label: "Revenue Efficiency",   value: p.revEfficiency,    weight: "30%", desc: "Actual realized revenue vs expected (rate × nights)"         },
                  { label: "Channel Mix Quality",  value: p.channelMixScore,  weight: "20%", desc: "% of bookings via Direct or Corporate (higher margin)"        },
                  { label: "Cancellation Score",   value: p.cancellationScore,weight: "10%", desc: "100 minus the % of cancellations + no-shows"                  },
                ].map((item) => (
                  <div key={item.label} className="mb-4 last:mb-0">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <span className="text-stone-800 text-sm font-medium">{item.label}</span>
                        <span className="text-stone-400 text-xs ml-2">weight {item.weight}</span>
                      </div>
                      <span className={`text-sm font-bold ${scoreColor(item.value)}`}>
                        {item.value.toFixed(1)}
                      </span>
                    </div>
                    <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${scoreBar(item.value)}`}
                        style={{ width: `${item.value}%` }}
                      />
                    </div>
                    <p className="text-stone-400 text-xs mt-0.5">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}