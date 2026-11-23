// Short amber notes for the engine's own warnings (result.meta.warnings, e.g. "adopting farmers
// lose money on average in this scenario; ...", a nutrient factor below 1) and for a share of
// land the adoption grid could not hit (result.meta.land_share_error_pp). Used by the Explorer,
// Compare and the Scenario Lab preview wherever results are shown.
import { h } from './ui.js';

export const LAND_ERR_PP = 0.1; // official seeds stay within 0.01 pp of the requested share

// results: engine results (or null); who: optional label per result ("2030 Seed", ...).
// opts.landShare = false skips the land-share check (used for whole curves, where only the
// chosen share matters). Returns plain sentences, one per distinct warning.
export function engineWarnings(results, who = [], { landShare = true } = {}) {
  const out = new Map(); // sentence -> labels it applies to
  results.forEach((r, i) => {
    if (!r || !r.meta) return;
    const add = msg => { if (!out.has(msg)) out.set(msg, new Set()); if (who[i]) out.get(msg).add(who[i]); };
    for (const w of r.meta.warnings || []) add(String(w));
    const e = r.meta.land_share_error_pp;
    if (landShare && Number.isFinite(e) && Math.abs(e) > LAND_ERR_PP) {
      add(`the adoption model could not reach the requested share of maize land exactly (${e > 0 ? '+' : ''}${e.toFixed(2)} pp at ${Math.round((r.meta.penetration ?? 0) * 100)}%)`);
    }
  });
  return [...out].map(([msg, labels]) => (labels.size ? `${[...labels].join(' and ')}: ` : '') + msg);
}

export function noteNodes(sentences) {
  return [...new Set(sentences)].map(w => h('div', { class: 'note warn' }, h('strong', {}, 'Model note: '),
    w.charAt(0).toUpperCase() + w.slice(1) + (/[.!?]$/.test(w) ? '' : '.')));
}

export function engineNotes(results, who = [], opts) { return noteNodes(engineWarnings(results, who, opts)); }
