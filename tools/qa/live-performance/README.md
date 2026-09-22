# Live performance diagnosis — 2026-09-22

Measured the user's actual Chrome file:// game: 1,116 × 750 viewport, four tanks,
25 slugs. Each capture lasts 20 seconds after an eight-second settling period.
No screen captures/input were issued during the main sampling period. Profiling
wraps selected functions, tracks nested inclusive/exclusive time, then restores
the original functions. It never writes save data or changes simulation state.

Saved `baseline.json`, `detailed-before.json`, and `after.json` contain raw results.
The live population, gait and positions continue changing between runs. These
are real observations, not a deterministic A/B benchmark or a guaranteed FPS gain.

| Metric | Detailed before | After |
|---|---:|---:|
| Observed mean FPS | 26.29 | 31.80 |
| Frame p95 | 51.0 ms | 50.1 ms |
| Total drawFloor CPU time/frame | 25.74 ms | 18.55 ms |
| drawPerson inclusive/frame | 8.12 ms | 5.98 ms |
| drawObject inclusive/frame | 6.46 ms | 5.32 ms |
| stepTankSlugs inclusive/frame | 4.55 ms | 1.62 ms |
| decorSolidSet exclusive/frame | 1.62 ms | 0.073 ms |
| decorCellSet exclusive/frame | 0.986 ms | 0.157 ms |
| foodPath exclusive/frame | 1.463 ms | 0.123 ms |

Findings and changes:
- Collision and front/back occlusion sets were regenerated every frame although
  decorations did not move. Cache by placement, definition-array identity and
  shape, with union invalidation on adding/removing/reordering/replacing objects.
  Definition files are immutable during play; replacing them refreshes the cache.
- Food pathfinding ran 9,514 times in the before capture. Cache failed routes
  only while start cell, size, breeding scale, zone, tank dimensions, target and
  collision-mask identity are unchanged. Successful paths are never shared,
  because the feeding loop consumes the path array. Limit 128 failed targets/slug.
- Deduplicated bag vertex positions offline and reused seam scratch containers.
  Same triangle geometry: maximum before/after coordinate difference < 1e-14.
  Scratch references are released after each pose.
- Corrected the FPS display's misleading "other work" label to "queue wait".
  MessageChannel latency includes browser scheduling/wait and is not CPU time.
  Each message now carries its own timestamp instead of using an overwritten one.

Validation passed: JavaScript syntax/diff checks, 16 collision-mask equivalence
and invalidation cases, 22 food-route equivalence/invalidation cases, repeated
failed-route BFS avoidance, bag/seam regression and geometry-equivalence checks.
Mask microbenchmark (18 decorations × 240 cells, 200 warm samples): p50 about
3.52 → 0.051 ms, p95 6.58 → 0.101 ms. This isolates mask work; it is not FPS.

Remaining: p95 still approximately 50 ms. Building/shading person poses and
drawing tank objects dominate the remaining CPU work. GPU/compositor time is
not separated by this profiler; max-duration spikes cannot be attributed to GC
without a browser trace. No save calls occurred during these captures.

Reproduce using `index.html?profile=1`. The profiler is disabled without that
query flag. The profile is temporary, capped and restores wrappers on completion.
