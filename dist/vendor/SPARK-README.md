# Spark 2.4.0

Pinned official `@sparkjsdev/spark` npm package, MIT licensed.

- Package: https://registry.npmjs.org/@sparkjsdev/spark/-/spark-2.4.0.tgz
- Source/tag: https://github.com/sparkjsdev/spark/tree/v2.4.0
- License: `SPARK-LICENSE` (retained verbatim).
- Existing Three.js r187 is reused; its core files are unchanged.
- `spark-pass.js` is the official r187 `examples/jsm/postprocessing/Pass.js`, under the adjacent Three `LICENSE`.

Only ESM import paths were changed: Spark's `three` imports point to `./three.module.js`, its FullScreenQuad import points to `./spark-pass.js`, and Pass imports the same Three module. Worker and WASM payloads are embedded in the official bundle. No runtime CDN dependency or package installation is required.

Imported scenes use native Gaussian rendering with all source records and SH3 retained, `extSplats:true`, `lod:false`, and `enableLod:false`. Source PLY transport is lossless gzip. Spark's extended GPU representation still packs some non-position fields; it is not bit-for-bit float32 attribute storage.

SHA-256 (vendored files after import rewriting):

```text
84dfeb2f63451a1aba7ab560fdbb2f329d79a25b2024ab33eb5baac6e369b61b  spark.module.js
51829693e5dccd9ca1daa093991faac3aaa93238eb8fd5f5cb4130af85791d64  SPARK-LICENSE
9d4db16199e0a742f289535cd755904e6063cdda114e0a1972ddff082875cb00  spark-pass.js
```
