# Bag fitting — 2026-09-22

Crossbody bags and backpacks now use geometry fitted to each of the four body
models. Straps follow the chest and shoulders; the backpack's inner surface
follows the back. Accessories use the same width, sway, lean, twist and crouch
transforms as the torso. This replaces fixed coordinates and straight straps.

`node tools/build-people-bags.mjs` rebuilds `js/people-bags.js` from the existing
people models. Fitting runs offline; gameplay only looks up shared geometry.
The WeakMap contains four model entries. No new timer, listener, save state,
external dependency or per-frame surface search was introduced.

Passed:
- Syntax and whitespace checks; deterministic asset regeneration.
- Sampled both accessories' actual triangles against the torso on all four
  models: no samples penetrate more than 0.0003 normalized height units.
- All 288 posed combinations have finite geometry: four bodies, three widths,
  adults/children, standing/leaning/crouching and four facing directions.
  This is a geometry smoke check, not proof of collision clearance in every pose.
- Inspected four-angle images of the female crossbody bag standing/crouching,
  female backpack standing/crouching, male2 backpack standing and female2 walking.
- Shared accessory geometry is reused; camera pan/zoom reuses the pose;
  offscreen calls leave the pose unchanged.
- Existing 96 carrying cases and 128 shirt-seam cases still pass.
- No browser page errors. Browser profiles are isolated from player saves.

The fitted crossbody bag has 70 triangles and the backpack 168. More strap
segments are needed to follow the chest instead of crossing it. In the saved
female crossbody benchmark, the complete person changes from 3,916 to 3,932
triangles. Warm pose-build median was 3.2 → 2.7 ms, p95 35.1 → 5.7 ms in this
headless run. These measurements are noisy and do not establish an FPS gain.
Geometry lookup measured 0–0.1 ms; fitting itself is no longer done in-game.

Not checked: live-game GPU rendering, target-device FPS, hidden-tab behavior and
scene transitions. Save/economy and simulation timing are not applicable.

Run `node tools/test-bag-fit.mjs`. Optionally set `PEOPLE_BEFORE` to a previous
people.js snapshot for before/after pictures and timing; otherwise Git HEAD is
used. Saved evidence used the working-tree snapshot before this bag repair.
