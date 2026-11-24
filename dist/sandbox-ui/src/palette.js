// The display's colours, the same values Phosphor's own painters use
// (sites/phosphor-cursor/dist/viewer-grid-paint.js, lines 6 to 8, and the kit's panel colour).
export const MINT = '#a9e9df';   // a lit pixel
export const DIM = '#558c7e';    // a quiet one: frames at rest, captions, what is not chosen
export const INK = '#06231f';    // text on a lit field
export const PANEL = '#061713';  // the display's own dark
export const AMBER = '#ffc782';  // a warning, and the fixed marks of an instrument
export const RED = '#ff777b';    // an error, a refusal, a marker
export const THERMAL = [[40, 67, 138], [54, 189, 162], [228, 208, 94], [231, 130, 64]];

/** The colour of a level: ok, warn, fail, off. */
export const levelColour = level => ({ok: MINT, warn: AMBER, fail: RED, error: RED, note: DIM, off: DIM})[level] || MINT;
