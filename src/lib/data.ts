// Palm Beach Labs - Financial Dashboard Data Layer
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function makeMonthLabels(count: number, startMonth = 2, startYear = 2025): string[] {
  const out: string[] = [];
  let m = startMonth, y = startYear;
  for (let i = 0; i < count; i++) {
    out.push(`${MONTH_NAMES[m]}-${String(y).slice(2)}`);
    m++;
    if (m === 12) { m = 0; y++; }
  }
  return out;
}

export interface Assumptions {
  startVolume: number; rampVolume: number; steadyVolume: number;
  rampMonths: number; acqMonths: number; cac: number; cogs: number;
  month1Price: number; month2Price: number; drVisit: number;
  merchantPct: number; cbPct: number; monthlyOpex: number;
  ret: number[];
}

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  startVolume: 380, rampVolume: 600, steadyVolume: 1200,
  rampMonths: 2, acqMonths: 24, cac: 300, cogs: 65,
  month1Price: 169, month2Price: 239, drVisit: 22.50,
  merchantPct: 3, cbPct: 1, monthlyOpex: 29550,
  ret: [70, 60, 47, 30, 20, 10, 5],
};

export interface ModelResult {
  months: string[]; numMonths: number; numCohorts: number; volumes: number[];
  totalNewCustomers: number[]; totalActiveSubs: number[]; totalRevenue: number[];
  cogsCost: number[]; cacCost: number[]; drVisitCost: number[];
  merchantCost: number[]; chargebackCost: number[]; totalCosts: number[];
  monthlyPnL: number[]; cumulativePnL: number[]; margin: number[];
  totalAcquired: number; peakRevenue: number; peakSubs: number;
  bestPnL: number; worstPnL: number; endCumulativePnL: number;
  ltv: number; ltvCac: number;
  retentionData: { cycle: string; cumulative: number; active1000: number; lost: number }[];
}

export function computeModel(a: Assumptions): ModelResult {
  const cumRet = a.ret.map(v => v / 100);
  const volumes: number[] = [];
  for (let i = 0; i < a.acqMonths; i++) {
    if (i === 0) volumes.push(a.startVolume);
    else if (i < a.rampMonths) volumes.push(a.rampVolume);
    else volumes.push(a.steadyVolume);
  }
  const numCohorts = volumes.length;
  const numMonths = numCohorts + 11;
  const months = makeMonthLabels(numMonths);
  const subs: number[][] = Array.from({ length: numCohorts }, () => Array(numMonths).fill(0));
  for (let c = 0; c < numCohorts; c++) {
    for (let mo = 0; mo < 12; mo++) {
      const col = c + mo;
      if (col >= numMonths) break;
      subs[c][col] = mo === 0 ? volumes[c] : Math.round(volumes[c] * cumRet[Math.min(mo, 7) - 1]);
    }
  }
  const totalNewCustomers = Array(numMonths).fill(0);
  const totalActiveSubs = Array(numMonths).fill(0);
  const totalRevenue = Array(numMonths).fill(0);
  const cogsCost = Array(numMonths).fill(0);
  const cacCost = Array(numMonths).fill(0);
  const drVisitCost = Array(numMonths).fill(0);
  const merchantCost = Array(numMonths).fill(0);
  const chargebackCost = Array(numMonths).fill(0);
  for (let m = 0; m < numMonths; m++) {
    if (m < numCohorts) totalNewCustomers[m] = volumes[m];
    for (let c = 0; c < numCohorts; c++) {
      totalActiveSubs[m] += subs[c][m];
      const mo = m - c;
      if (mo >= 0 && mo < 12 && subs[c][m] > 0) {
        totalRevenue[m] += subs[c][m] * (mo === 0 ? a.month1Price : a.month2Price);
      }
    }
    cogsCost[m] = totalActiveSubs[m] * a.cogs;
    cacCost[m] = totalNewCustomers[m] * a.cac;
    drVisitCost[m] = totalActiveSubs[m] * a.drVisit;
    merchantCost[m] = totalRevenue[m] * (a.merchantPct / 100);
    chargebackCost[m] = totalRevenue[m] * (a.cbPct / 100);
  }
  const totalCosts = totalRevenue.map((_, m) =>
    cogsCost[m] + cacCost[m] + drVisitCost[m] + merchantCost[m] + chargebackCost[m] + a.monthlyOpex
  );
  const monthlyPnL = totalRevenue.map((rev, m) => rev - totalCosts[m]);
  const cumulativePnL: number[] = [];
  monthlyPnL.forEach((pnl, m) => cumulativePnL.push(m === 0 ? pnl : cumulativePnL[m - 1] + pnl));
  const margin = totalRevenue.map((rev, m) => rev === 0 ? 0 : monthlyPnL[m] / rev);
  const totalAcquired = volumes.reduce((s, v) => s + v, 0);
  const peakRevenue = Math.max(...totalRevenue);
  const peakSubs = Math.max(...totalActiveSubs);
  const bestPnL = Math.max(...monthlyPnL);
  const worstPnL = Math.min(...monthlyPnL);
  const endCumulativePnL = cumulativePnL[cumulativePnL.length - 1];
  const ltv = a.month1Price + cumRet.reduce((s, r) => s + r * a.month2Price, 0);
  const ltvCac = ltv / a.cac;
  const retentionData = [
    { cycle: 'Initial', cumulative: 1.0, active1000: 1000, lost: 0 },
    ...cumRet.map((r, i) => ({
      cycle: `Cycle ${i + 1}`,
      cumulative: r,
      active1000: Math.round(r * 1000),
      lost: Math.round((i === 0 ? 1 : cumRet[i - 1]) * 1000) - Math.round(r * 1000),
    })),
  ];
  return {
    months, numMonths, numCohorts, volumes,
    totalNewCustomers, totalActiveSubs, totalRevenue,
    cogsCost, cacCost, drVisitCost, merchantCost, chargebackCost,
    totalCosts, monthlyPnL, cumulativePnL, margin,
    totalAcquired, peakRevenue, peakSubs, bestPnL, worstPnL, endCumulativePnL,
    ltv, ltvCac, retentionData,
  };
}
