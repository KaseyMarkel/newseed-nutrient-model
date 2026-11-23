// Plotly charts: dumbbell (before/after by department), box plots by department,
// lollipop (production), KPI trends by seed, and penetration curves for Compare.
import { toDisplayValue, unitLabel, display } from './units.js';
import { KPIS, kpiLabel } from './kpis.js';
import { trendValueText } from './display.js';

const FONT = { family: 'Segoe UI, system-ui, sans-serif', size: 12, color: '#262321' };
const CFG = { displayModeBar: false, responsive: true };
const BRAND = '#b1443b', BRAND_LIGHT = '#e8a39b', OCHRE = '#c9963b', OCHRE_LIGHT = '#e9cf99', GREY = '#9a918a', GREEN = '#2e7d4f';
export const SEED_COLORS = ['#8e3129', '#d9924a', '#4f8a5b', '#2f5f8f', '#7a4f9e', '#b3261e'];

// d3-format for hover labels by unit: whole numbers for counts and money, more decimals for z-scores.
function hoverFmt(key) {
  const u = (KPIS[key] || {}).unit;
  if (['count', 'people', 'gtq', 'kg', 'kcal', 'ha', 'mz', 'mt', 'qq'].includes(u)) return ',.0f';
  if (u === 'z') return '.3f';
  if (u === 'pct' || u === 'pp' || u === 'mg' || u === 'mt_per_ha') return '.2f';
  return ',.2f';
}

function base(extra = {}) {
  return { font: FONT, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', margin: { l: 110, r: 20, t: 10, b: 50 },
    xaxis: { gridcolor: '#eee8e2', zerolinecolor: '#ddd' }, yaxis: { gridcolor: '#f3efe9', automargin: true }, hovermode: 'closest', ...extra };
}

// Plotly renders a small subset of HTML in names and hover text; user-typed names (custom seeds,
// scenarios) are escaped so "<b>" or "%{y}" in a name shows as typed.
export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/%\{/g, '%&#123;');

// Before/after by department (display.js auxSpec / inadequacyByAge kind 'dumbbell'), highest
// "before" at the top. Hover text as the live app: "Before: 70.0%<br>After: 66.3%".
export function dumbbell(el, spec, opts = {}) {
  const rows = spec.rows.slice().sort((x, y) => x.before - y.before);
  const y = rows.map(r => r.region);
  const seg = { type: 'scatter', mode: 'lines', x: [], y: [], line: { color: '#c9c2bb', width: 2 }, hoverinfo: 'skip', showlegend: false };
  rows.forEach(r => { seg.x.push(r.before, r.value, null); seg.y.push(r.region, r.region, null); });
  const ht = '<b>%{y}</b><br>%{text}<extra></extra>';
  const before = { type: 'scatter', mode: 'markers', name: opts.beforeLabel || 'Before', x: rows.map(r => r.before), y, text: rows.map(r => r.text), hovertemplate: ht,
    marker: { color: BRAND_LIGHT, size: 9, line: { color: '#fff', width: 1 } } };
  const after = { type: 'scatter', mode: 'markers', name: opts.afterLabel || 'After', x: rows.map(r => r.value), y, text: rows.map(r => r.text), hovertemplate: ht,
    marker: { color: BRAND, size: 9, line: { color: '#fff', width: 1 } } };
  const layout = base({ xaxis: { title: { text: spec.xTitle }, gridcolor: '#eee8e2', ticksuffix: spec.suffix || '' },
    yaxis: { automargin: true, tickfont: { size: 11 } }, legend: { orientation: 'h', x: 1, xanchor: 'right', y: 1.06 }, margin: { l: 10, r: 20, t: 30, b: 50 } });
  return Plotly.react(el, [seg, before, after], layout, CFG);
}

// One value per department (kind 'lollipop'), largest at the top; hover text as the live app.
export function lollipop(el, spec) {
  const rows = spec.rows.slice().sort((a, b) => a.value - b.value);
  const seg = { type: 'scatter', mode: 'lines', x: [], y: [], line: { color: '#d9d2ca', width: 2 }, hoverinfo: 'skip', showlegend: false };
  rows.forEach(r => { seg.x.push(0, r.value, null); seg.y.push(r.region, r.region, null); });
  const pts = { type: 'scatter', mode: 'markers', x: rows.map(r => r.value), y: rows.map(r => r.region), marker: { color: OCHRE, size: 9, line: { color: '#fff', width: 1 } },
    text: rows.map(r => r.text), hovertemplate: '<b>%{y}</b><br>%{text}<extra></extra>', showlegend: false };
  const layout = base({ xaxis: { title: { text: spec.xTitle }, gridcolor: '#eee8e2', zeroline: true, zerolinecolor: '#ddd' }, yaxis: { automargin: true, tickfont: { size: 11 } }, margin: { l: 10, r: 20, t: 10, b: 50 } });
  return Plotly.react(el, [seg, pts], layout, CFG);
}

// Total and biofortified maize eaten by department (consumption page, population coverage).
export function pairChart(el, spec) {
  const rows = spec.rows.slice().sort((a, b) => a.before - b.before);
  const y = rows.map(r => r.region);
  const seg = { type: 'scatter', mode: 'lines', x: [], y: [], line: { color: '#d9d2ca', width: 2 }, hoverinfo: 'skip', showlegend: false };
  rows.forEach(r => { seg.x.push(r.value, r.before, null); seg.y.push(r.region, r.region, null); });
  const ht = '<b>%{y}</b><br>%{text}<extra></extra>';
  const total = { type: 'scatter', mode: 'markers', name: spec.labels[0], x: rows.map(r => r.before), y, text: rows.map(r => r.textBefore), hovertemplate: ht, marker: { color: OCHRE_LIGHT, size: 9, line: { color: '#a0682a', width: 1 } } };
  const bio = { type: 'scatter', mode: 'markers', name: spec.labels[1], x: rows.map(r => r.value), y, text: rows.map(r => r.text), hovertemplate: ht, marker: { color: OCHRE, size: 9, line: { color: '#fff', width: 1 } } };
  const layout = base({ xaxis: { title: { text: spec.xTitle }, gridcolor: '#eee8e2', rangemode: 'tozero' }, yaxis: { automargin: true, tickfont: { size: 11 } },
    legend: { orientation: 'h', x: 1, xanchor: 'right', y: 1.06 }, margin: { l: 10, r: 20, t: 30, b: 50 } });
  return Plotly.react(el, [seg, total, bio], layout, CFG);
}

// Box plots by department from display.js boxRows() (min, q1, median, q3, max of the children);
// the hover (Max / Q3 / Median / Q1 / Min) sits on a transparent marker at the median, as the live app.
export function boxByDepartment(el, rows, opts = {}) {
  rows = rows.slice();
  const has = rows.length && rows[0].med != null;
  const horizontal = !!opts.horizontal;
  if (horizontal) rows.sort((a, b) => (a.med || 0) - (b.med || 0));
  const cat = rows.map(r => r.region);
  const trace = has ? {
    type: 'box', name: opts.name || '', [horizontal ? 'y' : 'x']: cat, q1: rows.map(r => r.q1), median: rows.map(r => r.med), q3: rows.map(r => r.q3),
    lowerfence: rows.map(r => r.min), upperfence: rows.map(r => r.max), orientation: horizontal ? 'h' : 'v',
    marker: { color: OCHRE }, line: { color: OCHRE, width: 1.5 }, fillcolor: 'rgba(201,150,59,0.18)', showlegend: false, hoverinfo: 'skip'
  } : { type: 'bar', x: cat, y: rows.map(r => r.mean), marker: { color: OCHRE }, showlegend: false };
  const hover = { type: 'scatter', mode: 'markers', [horizontal ? 'y' : 'x']: cat, [horizontal ? 'x' : 'y']: rows.map(r => r.med), text: rows.map(r => r.text),
    hovertemplate: '%{text}<extra></extra>', marker: { size: 14, color: 'rgba(0,0,0,0)' }, showlegend: false };
  const shapes = [];
  if (opts.ear != null) {
    shapes.push(horizontal
      ? { type: 'line', x0: opts.ear, x1: opts.ear, y0: -0.5, y1: rows.length - 0.5, line: { color: '#555', width: 1.3, dash: 'dash' } }
      : { type: 'line', x0: -0.5, x1: rows.length - 0.5, y0: opts.ear, y1: opts.ear, line: { color: '#555', width: 1.3, dash: 'dash' } });
  }
  const annotations = opts.ear != null ? [horizontal
    ? { x: opts.ear, y: 1, yref: 'paper', text: 'EAR', showarrow: false, xanchor: 'left', font: { size: 11, color: '#555' } }
    : { x: 1, xref: 'paper', y: opts.ear, text: 'EAR', showarrow: false, xanchor: 'left', font: { size: 11, color: '#555' } }] : [];
  const valueAxis = { title: { text: opts.unit || '' }, gridcolor: '#eee8e2', rangemode: 'tozero' };
  const catAxis = { tickangle: horizontal ? 0 : -45, tickfont: { size: 10 }, automargin: true };
  const layout = base({ xaxis: horizontal ? valueAxis : catAxis, yaxis: horizontal ? catAxis : valueAxis, shapes, annotations,
    margin: { l: horizontal ? 10 : 50, r: 36, t: 10, b: horizontal ? 45 : 90 } });
  return Plotly.react(el, has ? [trace, hover] : [trace], layout, CFG);
}

// KPI trend: one line per seed (solid) and optionally the alternate pathway (dashed).
// series: [{label, x:[pen %], y:[raw], dash?, color}]; hover as the live app ("<b>2026 seed</b>
// <br>Share of maize land biofortified: 50%<br>Stunting prevalence: 44.6 %").
export function trendChart(el, series, key, units, opts = {}) {
  const name = opts.label || kpiLabel(key);
  const traces = series.map((s, i) => ({ type: 'scatter', mode: 'lines+markers', name: esc(s.label), x: s.x, y: s.y.map(v => toDisplayValue(key, v, units)),
    text: s.y.map((v, j) => `<b>${esc(s.label)}</b><br>Share of maize land biofortified: ${s.x[j]}%<br>${name}: ${trendValueText(key, v, units)}`),
    hovertemplate: '%{text}<extra></extra>',
    line: { color: s.color || SEED_COLORS[i % SEED_COLORS.length], width: s.dash ? 1.5 : 2.2, dash: s.dash ? 'dash' : 'solid' },
    marker: { size: s.dash ? 4 : 6, color: s.color || SEED_COLORS[i % SEED_COLORS.length] }, opacity: s.dash ? 0.55 : 1 }));
  const layout = base({ xaxis: { title: { text: 'Share of maize land biofortified (%)' }, ticksuffix: '%', dtick: 10, gridcolor: '#eee8e2' },
    yaxis: { title: { text: unitLabel(key, units) || kpiLabel(key) }, gridcolor: '#f3efe9', automargin: true },
    legend: { orientation: 'h', y: -0.28, x: 0, font: { size: 11 } }, margin: { l: 55, r: 15, t: 10, b: 40 }, hovermode: 'closest' });
  return Plotly.react(el, traces, layout, CFG);
}

// Penetration curves for Compare: baseline vs custom for one KPI.
export function curveChart(el, key, pens, baseVals, custVals, units, labels, opts = {}) {
  const traces = [
    { type: 'scatter', mode: 'lines+markers', name: esc(labels[0]), x: pens, y: baseVals.map(v => toDisplayValue(key, v, units)), line: { color: GREY, width: 2, dash: 'dot' }, marker: { size: 5, color: GREY }, hovertemplate: `${esc(labels[0])}<br>%{x}% of maize land: %{y:${hoverFmt(key)}} ${unitLabel(key, units)}<extra></extra>` },
    { type: 'scatter', mode: 'lines+markers', name: esc(labels[1]), x: pens, y: custVals.map(v => toDisplayValue(key, v, units)), line: { color: BRAND, width: 2.4 }, marker: { size: 6, color: BRAND }, hovertemplate: `${esc(labels[1])}<br>%{x}% of maize land: %{y:${hoverFmt(key)}} ${unitLabel(key, units)}<extra></extra>` }
  ];
  const shapes = opts.marker != null ? [{ type: 'line', x0: opts.marker, x1: opts.marker, y0: 0, y1: 1, yref: 'paper', line: { color: '#b1443b', width: 1, dash: 'dash' }, opacity: 0.5 }] : [];
  const layout = base({ xaxis: { title: { text: 'Share of maize land biofortified (%)' }, ticksuffix: '%', dtick: 20, gridcolor: '#eee8e2' },
    yaxis: { title: { text: unitLabel(key, units) || '' }, gridcolor: '#f3efe9', automargin: true },
    legend: { orientation: 'h', y: -0.3, x: 0, font: { size: 11 } }, margin: { l: 55, r: 15, t: 8, b: 40 }, shapes, hovermode: 'x unified', showlegend: !!opts.legend });
  return Plotly.react(el, traces, layout, CFG);
}

// Horizontal bar of department deltas (Compare).
export function deltaBars(el, rows, key, units, opts = {}) {
  // rows: [{region, delta(raw)}] sorted by delta
  const sorted = rows.slice().sort((a, b) => a.delta - b.delta);
  const good = (KPIS[key] || {}).good;
  const colors = sorted.map(r => { const pos = r.delta >= 0; const isGood = good === 'down' ? !pos : pos; return r.delta === 0 ? '#c9c2bb' : (isGood ? GREEN : '#b3261e'); });
  const trace = { type: 'bar', orientation: 'h', x: sorted.map(r => toDisplayValue(key, r.delta, units)), y: sorted.map(r => r.region), marker: { color: colors },
    text: sorted.map(r => display(key, r.delta, units, { signed: true, delta: true, compact: true }).text), textposition: 'outside', textfont: { size: 10 }, cliponaxis: false,
    hovertemplate: '<b>%{y}</b><br>%{text}<extra></extra>' };
  const layout = base({ xaxis: { title: { text: `Change in ${kpiLabel(key).replace(/ \((%|mz|qq)\)$/, '').toLowerCase()} (${unitLabel(key, units, { delta: true }) || 'n'})` }, gridcolor: '#eee8e2', zerolinecolor: '#999' }, yaxis: { automargin: true, tickfont: { size: 11 } }, margin: { l: 10, r: 60, t: 10, b: 50 } });
  return Plotly.react(el, [trace], layout, CFG);
}

export function purge(el) { try { Plotly.purge(el); } catch (e) { /* ignore */ } }
