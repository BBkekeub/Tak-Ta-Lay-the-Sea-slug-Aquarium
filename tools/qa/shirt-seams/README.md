# Shirt seam repair — 2026-09-22

The baked model assigns entire triangles to separate bones. Their duplicated
boundary vertices used to separate when the torso and sleeves moved differently.
The renderer now matches shirt boundaries in bind space once per model and joins
their posed positions before shading. Existing triangle counts and pose caching
are preserved. The matching table is owned by a WeakMap keyed by the model;
temporary points are local to pose construction. No timer or saved state is added.

Acceptance: connected shirt boundaries in adult/child standing, walking and
carrying poses, with no new triangles and working camera cache reuse.

Passed:
- JavaScript syntax and git diff whitespace checks.
- 128 seam cases across four bodies, adult/child, carrying/empty hands,
  idle/moving and four gait phases: measured seam gaps are zero.
- 96 carrying regression cases: unchanged arm lengths and no hand/forearm
  intersections in the existing local-coordinate collision probe.
- Camera pan/zoom reuses cached geometry; offscreen drawing leaves it unchanged.
- Inspected four-view galleries for male/female standing, male carrying,
  male2/female2 walking: shoulder triangles remain connected.
- No browser page errors in the isolated character test. No player save opened.

Cost in a headless Chrome character microbenchmark (100 warm samples):
pose-build median 1.8 → 2.1 ms, p95 3.0 → 3.9 ms; 3,090 triangles before/after.
This adds some pose-building work; it is not an FPS improvement claim.

Not checked: full-scene GPU rendering, scene transitions, hidden-tab behavior,
and target-device FPS. The initial full-startup wait timed out without page errors;
the test then used loaded character code directly, without requiring scene assets.
Persistence/economy and simulation timing are not applicable to this rendering-only fix.

Run `node tools/test-shirt-seams.mjs`. Set `PEOPLE_BEFORE` to a source snapshot
for a precise before/after comparison; otherwise the baseline is Git HEAD.
The saved results used the working-tree snapshot immediately before this repair.
