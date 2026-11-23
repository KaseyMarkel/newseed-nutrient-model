// Unit conversion and number formatting.
// Conversions come from Azahar's R code (06_03x: 0.7 ha/mz, 0.04536 mt/qq) and the
// live app (GTQ 7.80 per USD, read from the currency toggle on 2026-10-29).
import { KPIS } from './kpis.js';

export const CONV = {
  GTQ_PER_USD: 7.8,
  HA_PER_MZ: 0.7,
  MT_PER_QQ: 0.04536,
  BAGS_PER_HA: 1 // the live app shows one 20 kg bag per hectare
};

// units: { currency: 'USD'|'GTQ', area: 'ha'|'mz', weight: 'mt'|'qq' }
export const DEFAULT_UNITS = { currency: 'USD', area: 'ha', weight: 'mt' };

const NF = new Map();
function nf(d) {
  if (!NF.has(d)) NF.set(d, new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
  return NF.get(d);
}

export function fmtNum(v, d = 0) {
  if (v == null || !Number.isFinite(v)) return '–';
  return nf(Math.max(0, Math.min(8, d))).format(v);
}

export function fmtCompact(v, d = 1) {
  if (v == null || !Number.isFinite(v)) return '–';
  const a = Math.abs(v);
  if (a >= 1e9) return (v / 1e9).toFixed(d + 1) + ' B'; // Q2.58 B, not Q2.6 B
  if (a >= 1e6) return (v / 1e6).toFixed(d) + ' M';
  if (a >= 1e4) return (v / 1e3).toFixed(0) + ' k';
  return fmtNum(v, a < 10 ? 1 : 0);
}

const ALL_ZERO = /^[0.,]+$/;

// Convert a raw engine value (GTQ, ha, mt) to the display unit and return
// { value, unit, text }. `opts.compact` shortens millions.
// `opts.delta`: the value is a difference of two values of `key`; a difference of
// two percentages is shown in percentage points (pp), never as %.
// Signs go before the currency symbol (+$1.2 M, -Q300). A non-zero value that would
// round to 0 at the chosen decimals gets up to 4 more decimals so the sign is not lost;
// float noise below that shows as an unsigned 0.
export function display(key, raw, units = DEFAULT_UNITS, opts = {}) {
  const meta = KPIS[key] || {};
  let unit = opts.unit || meta.unit || 'number';
  if (opts.delta && unit === 'pct') unit = 'pp';
  if (raw == null || !Number.isFinite(raw)) return { value: raw, unitLabel: '', text: '–' };
  let v = raw;
  let label = '';
  let d = 0;
  const signed = !!(meta.signed || opts.signed);
  switch (unit) {
    case 'gtq':
      if (units.currency === 'USD') { v = raw / CONV.GTQ_PER_USD; label = '$'; } else { label = 'Q'; }
      d = 0;
      break;
    case 'ha':
      if (units.area === 'mz') { v = raw / CONV.HA_PER_MZ; label = ' mz'; } else { label = ' ha'; }
      break;
    case 'mz':
      if (units.area === 'ha') { v = raw * CONV.HA_PER_MZ; label = ' ha'; } else { label = ' mz'; }
      break;
    case 'mt':
      if (units.weight === 'qq') { v = raw / CONV.MT_PER_QQ; label = ' qq'; } else { label = ' mt'; }
      break;
    case 'qq':
      if (units.weight === 'mt') { v = raw * CONV.MT_PER_QQ; label = ' mt'; } else { label = ' qq'; }
      break;
    case 'mt_per_ha':
      if (units.weight === 'qq' && units.area === 'mz') { v = raw / CONV.MT_PER_QQ * CONV.HA_PER_MZ; label = ' qq/mz'; }
      else if (units.weight === 'qq') { v = raw / CONV.MT_PER_QQ; label = ' qq/ha'; }
      else if (units.area === 'mz') { v = raw * CONV.HA_PER_MZ; label = ' mt/mz'; }
      else label = ' mt/ha';
      d = 2;
      break;
    case 'pct': label = '%'; d = 1; break;
    case 'pp': label = ' pp'; d = 1; break;
    case 'z': d = 2; break;
    case 'mg': d = 2; label = ' mg/d'; break;
    case 'g': d = 1; label = ' g/d'; break;
    case 'kcal': d = 0; label = ' kcal/d'; break;
    case 'kg': d = 0; label = ' kg/yr'; break;
    case 'count': case 'people': d = 0; break;
    case 'ratio': d = 2; break;
    default: d = (Math.abs(raw) < 10 ? 2 : 0);
  }
  if (opts.decimals != null) d = opts.decimals;
  const a = Math.abs(v);
  let num;
  if (opts.compact && a >= 1e5) num = fmtCompact(a, 1);
  else {
    num = fmtNum(a, d);
    // keep small non-zero values visible (0.004 pp, not 0.00 pp) when the unit has decimals
    if (a > 0 && ALL_ZERO.test(num) && (d > 0 || ['pct', 'pp', 'z', 'ratio', 'mg', 'g'].includes(unit))) {
      for (let dd = Math.max(d, 1); dd <= d + 4 && ALL_ZERO.test(num); dd++) num = fmtNum(a, dd);
      if (ALL_ZERO.test(num)) num = fmtNum(0, d);
    }
  }
  const zero = ALL_ZERO.test(num);
  const sign = zero ? '' : (v < 0 ? '-' : (signed && v > 0 ? '+' : ''));
  const prefix = label === '$' || label === 'Q' ? label : '';
  const suffix = prefix ? '' : label;
  const text = sign + prefix + num + suffix;
  return { value: v, unitLabel: label.trim(), text };
}

// Relative change as text: +9.4%, -8.6%, +<0.1% for tiny non-zero changes, '' when the base is 0.
export function fmtRel(d, base) {
  if (d == null || base == null || !Number.isFinite(d) || !Number.isFinite(base) || base === 0) return '';
  const r = d / Math.abs(base) * 100;
  if (Math.abs(r) < 0.05) return r === 0 ? '0%' : (r > 0 ? '+<0.1%' : '-<0.1%');
  return (r > 0 ? '+' : '') + r.toFixed(1) + '%';
}

export function fmt(key, raw, units, opts) {
  return display(key, raw, units, opts).text;
}

// Axis/legend unit label for a KPI under the current unit toggles.
// opts.delta: label for a difference of two values (a difference of percentages is pp).
export function unitLabel(key, units = DEFAULT_UNITS, opts = {}) {
  const u = (KPIS[key] || {}).unit;
  switch (u) {
    case 'gtq': return units.currency;
    case 'ha': case 'mz': return units.area;
    case 'mt': case 'qq': return units.weight;
    case 'mt_per_ha': return `${units.weight}/${units.area}`;
    case 'pct': return opts.delta ? 'pp' : '%';
    case 'pp': return 'pp';
    case 'mg': return 'mg/day';
    case 'g': return 'g/day';
    case 'kcal': return 'kcal/day';
    case 'kg': return 'kg/year';
    case 'z': return 'z-score';
    default: return '';
  }
}

// Convert a raw value to display units without formatting (for chart axes).
export function toDisplayValue(key, raw, units = DEFAULT_UNITS) {
  return display(key, raw, units).value;
}
