# Optional captures

All shaders, viewers, loaders, controls and point-editing tools are included.
The public repo bundles **Pumpkin!** as a working Gaussian-splat and voxel sample.

The larger Shopping Center and Croissant captures and the two monument scans are
not bundled. Their catalog entries display **NOT BUNDLED** and are disabled.
The procedural cube, Pumpkin, online OSM map and local recording import remain usable.

To install another catalog capture, obtain it from the credited source in
`dist/imported-scenes.js` or `dist/scan-sites.js`, follow its license, prepare its
payload with `tools/package-splats.py` or `tools/import-obj-scan.mjs`, then remove
its ID from `OPTIONAL_CAPTURE_IDS` in `dist/public-assets.js`. Keep the expected
relative asset paths and attribution notices. Installing data locally does not
grant permission to redistribute it.

The Croissant and monument scans use non-commercial licenses. They are separate
from the UI code. No private recordings or browser settings are included.

For recordings, use **Open .mcap**, drop a compatible file on the viewer, or pass
`viewer.html?mcap=<url>` for a URL that permits your browser origin. Files opened
locally are decoded in the browser. The reader expects the documented depth,
camera-info and pose schemas in `dist/mcap-replay.js`; arbitrary MCAP schemas
are not automatically supported.
