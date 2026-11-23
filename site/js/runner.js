// Memoised engine runner shared by the pages.
import { buildRunScenario } from './scenarios.js';

export const PEN_STEPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

export class Runner {
  constructor(engine, defaults) {
    this.engine = engine;
    this.defaults = defaults;
    this.cache = new Map();
  }
  // spec: { seedId, subsidyId, pathway, penetration (0-100), params } or { scenario, penetration }
  scenarioFor(spec) {
    if (spec.scenario) return { ...spec.scenario, penetration: spec.penetration != null ? spec.penetration / 100 : spec.scenario.penetration };
    return buildRunScenario(this.defaults, { ...spec, penetration: (spec.penetration || 0) / 100 });
  }
  keyOf(scn) { return JSON.stringify(scn); }
  remember(key, res, ms) {
    res._ms = ms;
    // a result is ~100 KB in memory; keep the most recent 1,000 (the Replica check needs ~530)
    while (this.cache.size >= 1000) this.cache.delete(this.cache.keys().next().value);
    this.cache.set(key, res);
    return res;
  }
  run(spec) {
    const scn = this.scenarioFor(spec);
    const key = this.keyOf(scn);
    if (this.cache.has(key)) return this.cache.get(key);
    const t0 = performance.now();
    return this.remember(key, this.engine.run(scn), performance.now() - t0);
  }
  // All penetration levels for one scenario. Uses engine.runLevels() when the
  // engine offers it (shares the farmer ranking across levels), else run() per level.
  curve(spec, pens = PEN_STEPS) {
    const scns = pens.map(p => this.scenarioFor({ ...spec, penetration: p }));
    const keys = scns.map(s => this.keyOf(s));
    const missing = pens.map((p, i) => i).filter(i => !this.cache.has(keys[i]));
    if (missing.length && typeof this.engine.runLevels === 'function') {
      const t0 = performance.now();
      const base = { ...scns[0] }; delete base.penetration;
      const results = this.engine.runLevels(base, missing.map(i => scns[i].penetration));
      const ms = (performance.now() - t0) / missing.length;
      results.forEach((r, j) => this.remember(keys[missing[j]], r, ms));
    }
    return pens.map((p, i) => this.cache.has(keys[i]) ? this.cache.get(keys[i]) : this.run({ ...spec, penetration: p }));
  }
  national(spec) { return this.run(spec).national; }
}

export const yieldToUI = () => new Promise(r => setTimeout(r, 0));
