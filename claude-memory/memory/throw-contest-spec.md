---
name: throw-contest-spec
description: "Stone-throwing contest mode agreed 2026-09-18 — 150x50 tank, gill-powered throws, timing bar + angle bar"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9d616a3c-f788-4825-97b8-9d5c1a02c812
  modified: 2026-09-18T04:53:26.569Z
---

Stone-throwing mode (js/slug-throw.js), player's spec:
- Tank 150×50 cm, built like the other contest tanks (one per shop, challengers walk in, wager, full-screen tank, podium result).
- Slugs throw the stone **with their gills**; power comes from gill size (gillLen) and gill count.
- Aim: angle first, then arrow length = power. **No foul** — the >90% "เหวี่ยงพลาด" half-speed penalty was removed 2026-09-23 (player felt cheated). 45° goes farthest.
- Then a 5 s **boost phase**: camera zooms onto the stone and F/K mashing pushes it further and further — every press adds real speed with **no cap** (a gauge that fills and stops was rejected); stop mashing and speed decays.
- Then the **falling phase**: waves arrive in rounds, press Space in time for each; a missed wave cuts the stone's speed so it lands nearer. Most of the distance is earned in this phase.
- 2026-09-23: waves get random timing + random speed per throw; the wave timing bar HUD is hidden; hitting the back glass = +10 bonus (below ring bonus); total force ×0.95 because glass hits were too easy.
- Payout (2026-09-23, differs from other contest tanks): 1st +3× wager, 2nd +2×, 3rd 0, 4th −1×.
- Bonus ring randomly placed each turn (scaled to that thrower's max range) and score = sum of all 3 throws + ring bonuses.

**Why:** player's direct design.
**How to apply:** tune constants at the top of slug-throw.js rather than redesigning. Related: [[eat-contest-spec]], [[race-power-spec]], [[tournament-spec]]
