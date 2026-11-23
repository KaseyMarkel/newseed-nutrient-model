// =============================================================================
// ldsum.js: R's sum()/cumsum() accumulator, bit for bit, in plain JS.
//
// R accumulates sum() and cumsum() of doubles in C `long double` (src/main/summary.c
// rsum(), cum.c). On Windows x64 that is the x87 80-bit format: a 64-bit significand,
// round-to-nearest-even after every addition, converted to double at the end. Checked
// on this machine (R 4.6.0): sum(c(1, 2^-60, -1)) = 2^-60, sum(c(1, 2^-64, -1)) = 0,
// sum(c(1, 3 * 2^-65, -1)) = 2^-63.
//
// The running value is held exactly as a pair (hi, lo) with hi = fl(value). Each add
// forms the exact sum as a short expansion (TwoSum), rounds it to a 64-bit significand
// with ties-to-even, and renormalises. value() is (double) of the long double, i.e. hi.
// This matters where Azahar's results sit on a boundary: e.g. 06_01 coverage of a donor
// department that gives away all its surplus is 99.999999999999972 or 100 depending on
// the last bit, and 06_02x then does or does not flag the last child (weight_cumsum <=
// weight_target).
// =============================================================================

const f64 = new Float64Array(1);
const u32 = new Uint32Array(f64.buffer); // little-endian: u32[1] holds sign/exponent

// exact powers of two 2^(i - POW2_BIAS), avoiding Math.pow in the inner loop
const POW2_BIAS = 1200;
const POW2 = new Float64Array(2 * POW2_BIAS + 1);
for (let i = 0; i < POW2.length; i++) POW2[i] = Math.pow(2, i - POW2_BIAS);

function exponentOf(x) { // floor(log2(|x|)) for normal doubles
  f64[0] = x;
  const e = (u32[1] >>> 20) & 0x7ff;
  if (e === 0) return Math.floor(Math.log2(Math.abs(x))); // subnormal (never in practice)
  return e - 1023;
}

function twoSum(a, b) {
  const s = a + b;
  const bb = s - a;
  const err = (a - (s - bb)) + (b - bb);
  return [s, err];
}

export class LDAcc {
  constructor() { this.hi = 0; this.lo = 0; this.nan = false; this.special = 0; }

  add(x) {
    if (Number.isNaN(x)) { this.nan = true; return; }
    if (!Number.isFinite(x) || this.special !== 0) { this.special += x; return; } // +-Inf: plain IEEE
    // exact t = hi + lo + x = h + l2 + e3 (TwoSum steps inlined: this runs millions of times)
    const a = this.hi;
    const s1 = a + x, b1 = s1 - a, e1 = (a - (s1 - b1)) + (x - b1);
    const lo = this.lo;
    const s2 = e1 + lo, b2 = s2 - e1, e2 = (e1 - (s2 - b2)) + (lo - b2);
    let h = s1 + s2; const b3 = h - s1; const l = (s1 - (h - b3)) + (s2 - b3);
    let l2 = l + e2; const b4 = l2 - l; let e3 = (l - (l2 - b4)) + (e2 - b4);
    if (l2 === 0 && e3 === 0) { this.hi = h; this.lo = 0; return; } // exact in 53 bits already
    if (h === 0) { h = l2; l2 = e3; e3 = 0; [h, l2] = twoSum(h, l2); }
    if (h === 0) { this.hi = 0; this.lo = 0; return; }
    // exponent of the exact value (one lower when h is a power of two and the rest pulls below it)
    f64[0] = h;
    const hw = u32[1], lw = u32[0];
    const be = (hw >>> 20) & 0x7ff;
    let E = be === 0 ? exponentOf(h) : be - 1023;
    const rest = l2 + e3;
    if ((hw & 0xfffff) === 0 && lw === 0 && rest !== 0 && (rest < 0) !== (h < 0)) E -= 1;
    const u = POW2[E - 63 + POW2_BIAS]; // spacing of a 64-bit significand at this exponent
    // h is a multiple of 2u, so only the tail (l2 + e3) needs rounding to a multiple of u
    const k = l2 * POW2[63 - E + POW2_BIAS]; // = l2 / u, exact (power-of-two scaling, |k| <= 2^12)
    const fl = Math.floor(k);
    const frac = k - fl;
    // |e3| <= ulp(l2)/2, so e3 can only matter when l2 sits exactly on a half
    let kr;
    if (frac > 0.5) kr = fl + 1;
    else if (frac < 0.5) kr = fl;
    else if (e3 > 0) kr = fl + 1;
    else if (e3 < 0) kr = fl;
    else kr = (fl % 2 === 0) ? fl : fl + 1; // a true tie: even significand (h/u is even)
    const t = kr * u, nh = h + t, bb = nh - h;
    this.hi = nh; this.lo = (h - (nh - bb)) + (t - bb);
  }

  value() {
    if (this.nan) return NaN;
    if (this.special !== 0) return this.special + this.hi;
    return this.hi;
  }
}

// sum(x) of an array (no NA handling; callers filter)
export function ldSum(arr) {
  const a = new LDAcc();
  for (let i = 0; i < arr.length; i++) a.add(arr[i]);
  return a.value();
}
