---
name: race-power-spec
description: "Slug race redesign agreed 2026-09-18 — out-and-back track, charge gauge with J block wall / K speed boost"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9d616a3c-f788-4825-97b8-9d5c1a02c812
  modified: 2026-09-17T17:19:45.435Z
---

Player found the slug race too short/boring (plain A/D mashing). Agreed changes:
- Out-and-back run (touch far end, come back to start line), no extra input to turn.
- Pressing A/D fills a power gauge; when full choose **J = block** or **K = speed boost**, each lasting 2 s. Bots use powers too.
- Block hits **all** opponents (both in the 3-slug race) and is shown as a **wall that appears ahead of them with some gap**, so they can keep pressing until they reach it.

**Why:** player's direct design; they rejected gene-based skills and track pickups for now.
**How to apply:** keep this control scheme; tune numbers (gauge size, boost multiplier, wall gap) rather than redesigning. Related: [[tournament-spec]], [[eat-contest-spec]]
