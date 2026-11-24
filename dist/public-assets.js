/** Optional capture data is separate from the reusable visual system.
 * Install licensed files at their documented paths, then remove their IDs here to enable them.
 * The public distribution includes Pumpkin's CC BY 4.0 splats; private recordings are never bundled.
 */
export const OPTIONAL_CAPTURE_IDS = Object.freeze([
  'shopping-center', 'snow-globe', 'arch-of-constantine', 'cologne-cathedral'
]);
export const isCaptureAvailable = id => !OPTIONAL_CAPTURE_IDS.includes(id);
export const captureAvailabilityMessage = id => isCaptureAvailable(id) ? '' :
  'Optional capture data is not bundled. See docs/OPTIONAL-ASSETS.md. Showing the calibration cube.';
