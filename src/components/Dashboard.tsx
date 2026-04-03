"use client";

import { useState, useMemo, useCallback } from "react";
import { DEFAULT_ASSUMPTIONS, computeModel, type Assumptions } from "@/lib/data";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend, ComposedChart,
} from "recharts";

// âââ Helpers âââ
const fmt = (n: number) => n < 0
  ? `($${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })})`
  : `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const fmtK = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

const fmtNum = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

const COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: "ð" },
  { id: "pnl", label: "P&L Analysis", icon: "ð°" },
  { id: "cashflow", label: "Cash Flow", icon: "ð" },
  { id: "retention", label: "Retention", icon: "ð" },
  { id: "costs", label: "Cost Analysis", icon: "ð" },
];

// âââ KPI Card âââ
function KpiCard({ label, value, sub, trend, color = "indigo" }: {
  label: string; value: string; sub?: string; trend?: string;
  color?: "indigo" | "emerald" | "amber" | "red";
}) {
  const bgMap = { indigo: "bg-indigo-50", emerald: "bg-emerald-50", amber: "bg-amber-50", red: "bg-red-50" };
  const dotMap = { indigo: "bg-indigo-500", emerald: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500" };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2 h-2 rounded-full ${dotMap[color]}`} />
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
      <div className="flex items-center gap-2 mt-1.5">
        {sub && <span className="text-sm text-gray-500">{sub}</span>}
        {trend && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${bgMap[color]} ${
            color === "emerald" ? "text-emerald-700" :
            color === "red" ? "text-red-700" :
            color === "amber" ? "text-amber-700" : "text-indigo-700"
          }`}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}

// âââ Chart Card âââ
function ChartCard({ title, subtitle, children, className = "" }: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-6 ${className}`}>
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// âââ Custom Tooltip âââ
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-medium text-gray-900 mb-1.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-medium text-gray-900 ml-auto">
            {typeof p.value === "number"
              ? p.value > 1 ? fmt(p.value) : fmtPct(p.value)
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// âââ Driver Input Row âââ
function DriverInput({ label, value, onChange, unit, step = 1, min = 0, max }: {
  label: string; value: number; onChange: (v: number) => void;
  unit?: "$" | "%"; step?: number; min?: number; max?: number;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5">
      <label className="text-xs text-gray-400 flex-1">{label}</label>
      <div className="flex items-center gap-1">
        {unit === "$" && <span className="text-xs text-gray-500">$</span>}
        <input
          type="number" value={value} min={min} max={max} step={step}
          onChange={e => onChange(Number(e.target.value))}
          className="w-[72px] bg-white/[0.08] border border-white/[0.12] rounded-lg px-2 py-1 text-sm text-white text-right outline-none focus:border-indigo-400/60 transition-colors"
        />
        {unit === "%" && <span className="text-xs text-gray-500">%</span>}
      </div>
    </div>
  );
}

function DriverSection({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mt-4 mb-2 pt-3 border-t border-white/[0.06]">
      {label}
    </p>
  );
}

// âââ MAIN DASHBOARD âââ
export default function Dashboard() {
  const [activeNav, setActiveNav] = useState("overview");
  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);
  const [showDrivers, setShowDrivers] = useState(false);

  const set = useCallback(<K extends keyof Assumptions>(key: K, val: Assumptions[K]) => {
    setAssumptions(prev => ({ ...prev, [key]: val }));
  }, []);

  const setRet = useCallback((idx: number, val: number) => {
    setAssumptions(prev => {
      const ret = [...prev.ret];
      ret[idx] = val;
      return { ...prev, ret };
    });
  }, []);

  const M = useMemo(() => computeModel(assumptions), [assumptions]);
  const A = assumptions;

  // Time series for charts
  const timeSeries = useMemo(() => M.months.map((month, i) => ({
    month,
    revenue: M.totalRevenue[i],
    costs: M.totalCosts[i],
    pnl: M.monthlyPnL[i],
    cumulativePnl: M.cumulativePnL[i],
    subscribers: M.totalActiveSubs[i],
    newCustomers: M.totalNewCustomers[i],
    margin: M.margin[i],
  })), [M]);

  // Quarterly for P&L table
  const quarterlyData = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33].map(i => ({
    month: M.months[i] || "",
    revenue: M.totalRevenue[i] || 0,
    costs: M.totalCosts[i] || 0,
    pnl: M.monthlyPnL[i] || 0,
    cumPnl: M.cumulativePnL[i] || 0,
    subs: M.totalActiveSubs[i] || 0,
    margin: M.margin[i] || 0,
  })).filter(d => d.month);

  // Cost breakdown at steady state
  const ss = Math.min(18, M.numMonths - 1);
  const costBreakdown = [
    { name: 'COGS', value: M.cogsCost[ss] },
    { name: 'CAC', value: M.cacCost[ss] },
    { name: 'Dr Visits', value: M.drVisitCost[ss] },
    { name: 'Merchant Fees', value: M.merchantCost[ss] },
    { name: 'Chargebacks', value: M.chargebackCost[ss] },
    { name: 'OpEx', value: A.monthlyOpex },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* âââ Sidebar âââ */}
      <aside className={`${showDrivers ? "w-[300px]" : "w-64"} bg-[#1a1d23] text-gray-400 flex flex-col shrink-0 transition-all duration-200`}>
        <div className="px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-xs font-bold">PBL</span>
            </div>
            <div>
              <h1 className="text-white font-semibold text-sm">Palm Beach Labs</h1>
              <p className="text-xs text-gray-500">Financial Dashboard</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="px-3">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all mb-1 ${
                activeNav === item.id
                  ? "bg-white/10 text-white"
                  : "hover:bg-white/5 hover:text-gray-300"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Drivers Toggle */}
        <div className="px-3 mt-2">
          <button
            onClick={() => setShowDrivers(!showDrivers)}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              showDrivers ? "bg-indigo-600 text-white" : "bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30"
            }`}
          >
            <span>âï¸ Model Drivers</span>
            <span className="text-base">{showDrivers ? "â¾" : "â¸"}</span>
          </button>
        </div>

        {/* âââ DRIVERS PANEL âââ */}
        {showDrivers && (
          <div className="flex-1 overflow-y-auto px-4 pb-4 mt-1">
            <DriverSection label="Acquisition" />
            <DriverInput label="Month 1 Volume" value={A.startVolume} onChange={v => set("startVolume", v)} />
            <DriverInput label="Month 2 Volume" value={A.rampVolume} onChange={v => set("rampVolume", v)} />
            <DriverInput label="Steady Volume" value={A.steadyVolume} onChange={v => set("steadyVolume", v)} />
            <DriverInput label="Ramp Months" value={A.rampMonths} onChange={v => set("rampMonths", v)} min={1} max={12} />
            <DriverInput label="Acq. Duration (mo)" value={A.acqMonths} onChange={v => set("acqMonths", v)} min={1} max={36} />

            <DriverSection label="Pricing" />
            <DriverInput label="Month 1 Price" unit="$" value={A.month1Price} onChange={v => set("month1Price", v)} />
            <DriverInput label="Month 2+ Price" unit="$" value={A.month2Price} onChange={v => set("month2Price", v)} />

            <DriverSection label="Unit Costs" />
            <DriverInput label="CAC" unit="$" value={A.cac} onChange={v => set("cac", v)} />
            <DriverInput label="COGS" unit="$" value={A.cogs} onChange={v => set("cogs", v)} />
            <DriverInput label="Dr Visit" unit="$" value={A.drVisit} onChange={v => set("drVisit", v)} step={0.5} />
            <DriverInput label="Merchant Fee" unit="%" value={A.merchantPct} onChange={v => set("merchantPct", v)} step={0.1} />
            <DriverInput label="Chargeback" unit="%" value={A.cbPct} onChange={v => set("cbPct", v)} step={0.1} />
            <DriverInput label="Monthly OpEx" unit="$" value={A.monthlyOpex} onChange={v => set("monthlyOpex", v)} step={500} />

            <DriverSection label="Cumulative Retention %" />
            {A.ret.map((r, i) => (
              <DriverInput key={i} label={`Cycle ${i + 1}`} unit="%" value={r} onChange={v => setRet(i, v)} max={100} />
            ))}

            <button
              onClick={() => setAssumptions(DEFAULT_ASSUMPTIONS)}
              className="w-full mt-4 py-2 rounded-xl border border-white/15 text-gray-400 text-xs font-semibold hover:bg-white/5 transition-colors"
            >
              Reset to Defaults
            </button>
          </div>
        )}

        {/* Bottom LTV card */}
        {!showDrivers && (
          <div className="mt-auto px-4 py-5 border-t border-white/10">
            <div className="bg-indigo-600/20 rounded-xl px-4 py-3">
              <p className="text-indigo-300 text-xs font-medium">LTV : CAC</p>
              <p className="text-white text-xl font-bold mt-0.5">{M.ltvCac.toFixed(2)}x</p>
              <p className="text-indigo-300/60 text-xs mt-1">LTV ${M.ltv.toFixed(0)} Â· CAC ${A.cac}</p>
            </div>
          </div>
        )}
      </aside>

      {/* âââ Main Content âââ */}
      <main className="flex-1 overflow-y-auto bg-[#f8f9fb]">
        <header className="bg-white border-b border-gray-100 px-8 py-5 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {NAV_ITEMS.find(n => n.id === activeNav)?.label || "Overview"}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">{A.acqMonths}-month acquisition model Â· {M.numMonths} month timeline</p>
            </div>
            <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg font-medium">
              {M.numCohorts} cohorts Â· {M.numMonths} months
            </span>
          </div>
        </header>

        <div className="px-8 py-6 space-y-6">
          {/* âââ OVERVIEW âââ */}
          {activeNav === "overview" && (
            <>
              <div className="grid grid-cols-5 gap-4">
                <KpiCard label="Total Acquired" value={fmtNum(M.totalAcquired)} sub={`${A.acqMonths} months`} color="indigo" />
                <KpiCard label="Peak Revenue" value={fmtK(M.peakRevenue)} sub="/month" trend="Steady state" color="emerald" />
                <KpiCard label="Peak Subscribers" value={fmtNum(M.peakSubs)} sub="active" color="indigo" />
                <KpiCard label="Customer LTV" value={`$${M.ltv.toFixed(0)}`} sub="8 cycles" trend={`${M.ltvCac.toFixed(2)}x CAC`} color="emerald" />
                <KpiCard label="Cumulative P&L" value={fmtK(M.endCumulativePnL)} sub="end of model" color={M.endCumulativePnL >= 0 ? "emerald" : "red"} />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <ChartCard title="Revenue Over Time" subtitle="Monthly gross revenue across all cohorts">
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={timeSeries}>
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.15} />
                          <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={4} stroke="#9ca3af" />
                      <YAxis tickFormatter={fmtK} tick={{ fontSize: 10 }} stroke="#9ca3af" />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#4f46e5" strokeWidth={2} fill="url(#revGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Active Subscribers" subtitle="Total subscribers across all cohorts">
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={timeSeries}>
                      <defs>
                        <linearGradient id="subGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={4} stroke="#9ca3af" />
                      <YAxis tickFormatter={fmtNum} tick={{ fontSize: 10 }} stroke="#9ca3af" />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="subscribers" name="Subscribers" stroke="#10b981" strokeWidth={2} fill="url(#subGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <ChartCard title="Monthly P&L" subtitle="Revenue minus total costs" className="col-span-2">
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={timeSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={4} stroke="#9ca3af" />
                      <YAxis tickFormatter={fmtK} tick={{ fontSize: 10 }} stroke="#9ca3af" />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="pnl" name="Monthly P&L" radius={[4, 4, 0, 0]}>
                        {timeSeries.map((entry, i) => (
                          <Cell key={i} fill={entry.pnl >= 0 ? "#10b981" : "#ef4444"} opacity={0.8} />
                        ))}
                      </Bar>
                      <Line type="monotone" dataKey="cumulativePnl" name="Cumulative" stroke="#4f46e5" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Retention Curve" subtitle="% of original cohort active">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={M.retentionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="cycle" tick={{ fontSize: 9 }} stroke="#9ca3af" />
                      <YAxis tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 10 }} stroke="#9ca3af" />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="cumulative" name="Retention" fill="#4f46e5" radius={[6, 6, 0, 0]} opacity={0.8} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </>
          )}

          {/* âââ P&L âââ */}
          {activeNav === "pnl" && (
            <>
              <div className="grid grid-cols-4 gap-4">
                <KpiCard label="Best Month" value={fmtK(M.bestPnL)} trend="Profitable" color="emerald" />
                <KpiCard label="Worst Month" value={fmtK(M.worstPnL)} trend="Acquisition phase" color="red" />
                <KpiCard label="Monthly OpEx" value={fmtK(A.monthlyOpex)} sub="fixed costs" color="amber" />
                <KpiCard label="End Cumulative" value={fmtK(M.endCumulativePnL)} color={M.endCumulativePnL >= 0 ? "emerald" : "red"} />
              </div>

              <ChartCard title="Revenue vs Costs" subtitle="Monthly comparison over full model timeline">
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={timeSeries}>
                    <defs>
                      <linearGradient id="revGrad2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={3} stroke="#9ca3af" />
                    <YAxis tickFormatter={fmtK} tick={{ fontSize: 10 }} stroke="#9ca3af" />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={2} fill="url(#revGrad2)" />
                    <Area type="monotone" dataKey="costs" name="Costs" stroke="#ef4444" strokeWidth={2} fill="url(#costGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Margin %" subtitle="Monthly profit margin over time">
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={timeSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={4} stroke="#9ca3af" />
                    <YAxis tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 10 }} stroke="#9ca3af" />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="margin" name="Margin" stroke="#8b5cf6" strokeWidth={2} fill="#8b5cf620" />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Quarterly Snapshot" subtitle="Key metrics sampled every 3 months">
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {["Month", "Subscribers", "Revenue", "Costs", "P&L", "Cumulative", "Margin"].map(h => (
                          <th key={h} className={`${h === "Month" ? "text-left" : "text-right"} py-2.5 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {quarterlyData.map((d, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="py-2.5 px-3 font-medium text-gray-900">{d.month}</td>
                          <td className="py-2.5 px-3 text-right text-gray-700">{fmtNum(d.subs)}</td>
                          <td className="py-2.5 px-3 text-right text-gray-700">{fmt(d.revenue)}</td>
                          <td className="py-2.5 px-3 text-right text-gray-700">{fmt(d.costs)}</td>
                          <td className={`py-2.5 px-3 text-right font-medium ${d.pnl >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmt(d.pnl)}</td>
                          <td className={`py-2.5 px-3 text-right font-medium ${d.cumPnl >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmt(d.cumPnl)}</td>
                          <td className="py-2.5 px-3 text-right text-gray-700">{fmtPct(d.margin)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ChartCard>
            </>
          )}

          {/* âââ CASH FLOW âââ */}
          {activeNav === "cashflow" && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <KpiCard label="Peak Inflow" value={fmtK(M.peakRevenue)} sub="/month" color="emerald" />
                <KpiCard label="Peak Outflow" value={fmtK(Math.max(...M.totalCosts))} sub="/month" color="red" />
                <KpiCard label="Cumulative End" value={fmtK(M.endCumulativePnL)} color={M.endCumulativePnL >= 0 ? "emerald" : "red"} />
              </div>

              <ChartCard title="Cash Flow Timeline" subtitle="Monthly net cash and cumulative position">
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={timeSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={3} stroke="#9ca3af" />
                    <YAxis tickFormatter={fmtK} tick={{ fontSize: 10 }} stroke="#9ca3af" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="pnl" name="Monthly Net" radius={[4, 4, 0, 0]}>
                      {timeSeries.map((entry, i) => (
                        <Cell key={i} fill={entry.pnl >= 0 ? "#10b981" : "#ef4444"} opacity={0.7} />
                      ))}
                    </Bar>
                    <Line type="monotone" dataKey="cumulativePnl" name="Cumulative" stroke="#4f46e5" strokeWidth={2.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="New Customers Per Month" subtitle="Acquisition volume over time">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={timeSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={4} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="newCustomers" name="New Customers" fill="#4f46e5" radius={[4, 4, 0, 0]} opacity={0.8} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </>
          )}

          {/* âââ RETENTION âââ */}
          {activeNav === "retention" && (
            <>
              <div className="grid grid-cols-4 gap-4">
                <KpiCard label="Cycle 1 Retention" value={`${A.ret[0]}%`} sub="of original" color="emerald" />
                <KpiCard label="Cycle 3 Retention" value={`${A.ret[2]}%`} sub="of original" color="amber" />
                <KpiCard label="Cycle 7 Retention" value={`${A.ret[6]}%`} sub="of original" color="red" />
                <KpiCard label="LTV" value={`$${M.ltv.toFixed(0)}`} trend={`${M.ltvCac.toFixed(2)}x CAC`} color="emerald" />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <ChartCard title="Cumulative Retention Curve" subtitle="% of original cohort still active at each cycle">
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={M.retentionData}>
                      <defs>
                        <linearGradient id="retGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="cycle" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                      <YAxis tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 10 }} stroke="#9ca3af" />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="cumulative" name="Retention" stroke="#4f46e5" strokeWidth={2.5} fill="url(#retGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Per 1,000 Customers" subtitle="Active vs lost at each cycle">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={M.retentionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="cycle" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                      <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="active1000" name="Active" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.8} />
                      <Bar dataKey="lost" name="Lost" fill="#ef4444" radius={[4, 4, 0, 0]} opacity={0.6} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <ChartCard title="Customer LTV Buildup" subtitle="Revenue per customer weighted by retention at each cycle">
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {["Cycle", "Retention", "Price", "Expected Rev", "Cumulative LTV"].map(h => (
                          <th key={h} className={`${h === "Cycle" ? "text-left" : "text-right"} py-2.5 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {M.retentionData.map((d, i) => {
                        const price = i === 0 ? A.month1Price : A.month2Price;
                        const expectedRev = d.cumulative * price;
                        const cumulativeLtv = M.retentionData.slice(0, i + 1).reduce(
                          (sum, r, j) => sum + r.cumulative * (j === 0 ? A.month1Price : A.month2Price), 0
                        );
                        return (
                          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                            <td className="py-2.5 px-3 font-medium text-gray-900">{d.cycle}</td>
                            <td className="py-2.5 px-3 text-right text-gray-700">{fmtPct(d.cumulative)}</td>
                            <td className="py-2.5 px-3 text-right text-gray-700">${price}</td>
                            <td className="py-2.5 px-3 text-right text-gray-700">${expectedRev.toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-right font-medium text-indigo-600">${cumulativeLtv.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </ChartCard>
            </>
          )}

          {/* âââ COSTS âââ */}
          {activeNav === "costs" && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <KpiCard label="CAC" value={`$${A.cac}`} sub="per customer" color="indigo" />
                <KpiCard label="COGS" value={`$${A.cogs}`} sub="per shipment" color="amber" />
                <KpiCard label="Monthly OpEx" value={fmtK(A.monthlyOpex)} sub="fixed" color="red" />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <ChartCard title="Steady-State Cost Breakdown" subtitle={`Monthly costs at steady state (${M.months[ss]})`}>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={costBreakdown}
                        cx="50%" cy="50%"
                        innerRadius={70} outerRadius={120}
                        paddingAngle={3} dataKey="value" nameKey="name"
                      >
                        {costBreakdown.map((_, i) => (
                          <Cell key={i} fill={COLORS[i]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => fmt(Number(v))} />
                      <Legend formatter={(value: string) => <span className="text-sm text-gray-700">{value}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Cost Trends Over Time" subtitle="Stacked cost components by month">
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={timeSeries.map((d, i) => ({
                      month: d.month,
                      COGS: M.cogsCost[i],
                      CAC: M.cacCost[i],
                      'Dr Visits': M.drVisitCost[i],
                      'Fees & CB': M.merchantCost[i] + M.chargebackCost[i],
                      OpEx: A.monthlyOpex,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={4} stroke="#9ca3af" />
                      <YAxis tickFormatter={fmtK} tick={{ fontSize: 10 }} stroke="#9ca3af" />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="COGS" stackId="1" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.7} />
                      <Area type="monotone" dataKey="CAC" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.7} />
                      <Area type="monotone" dataKey="Dr Visits" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.7} />
                      <Area type="monotone" dataKey="Fees & CB" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.7} />
                      <Area type="monotone" dataKey="OpEx" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.7} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <ChartCard title="Unit Economics" subtitle="Per-customer economics at each price point">
                <div className="grid grid-cols-2 gap-8 py-2">
                  {[
                    { title: "Month 1 Customer", price: A.month1Price },
                    { title: "Month 2+ Customer", price: A.month2Price },
                  ].map(({ title, price }) => (
                    <div key={title}>
                      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">{title}</h4>
                      <div className="space-y-2.5">
                        {[
                          { label: "Price", value: `$${price}` },
                          { label: "COGS", value: `-$${A.cogs}` },
                          { label: "Dr Visit", value: `-$${A.drVisit}` },
                          { label: `Merchant (${A.merchantPct}%)`, value: `-$${(price * A.merchantPct / 100).toFixed(2)}` },
                          { label: `CB (${A.cbPct}%)`, value: `-$${(price * A.cbPct / 100).toFixed(2)}` },
                        ].map((item, i) => (
                          <div key={i} className="flex justify-between py-1 border-b border-gray-50">
                            <span className="text-sm text-gray-600">{item.label}</span>
                            <span className="text-sm font-medium text-gray-900">{item.value}</span>
                          </div>
                        ))}
                        <div className="flex justify-between py-1.5 border-t-2 border-gray-200">
                          <span className="text-sm font-semibold text-gray-900">Net Revenue</span>
                          <span className="text-sm font-bold text-emerald-600">
                            ${(price - A.cogs - A.drVisit - price * (A.merchantPct + A.cbPct) / 100).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ChartCard>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
