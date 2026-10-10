---
name: eat-contest-spec
description: "Player's spec for the 4-slug \"drag food home and eat\" contest (movement genes, dash, food sizes S/M/L/XL, chew counts) — agreed 2026-09-17"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9d616a3c-f788-4825-97b8-9d5c1a02c812
  modified: 2026-09-18T13:57:17.182Z
---

Eating contest the player designed (rejected pure button-mash and chew-rhythm proposals):

- 4 slugs (player + 3 bots) in a square arena, one base per corner, food pile in the center, timed. Carry ONE item at a time from the pile back to own base, then eat it there. Score counted at time-up; announce winner like other modes. **No tournament** for this mode.
- Goal: small slugs must be able to shine (other modes they can't do anything).
- Walk speed: smaller body → faster; bigger gill size (gillLen) → slower; more gills (nGill) → faster.
- Dash: uses a gauge; bigger body costs more gauge. Desktop: Space. Mobile: dash button. Dash is a fast ground burst forward, NOT a hop/jump (player rejected double-tap-direction dash: breaks walking rhythm; and hopping wastes time).
- Controls: WASD move — **keys map to the tank floor axes, not screen directions** (screen-space mapping left an 87° gap on the floor so the corner-to-centre diagonal was unreachable; fixed 2026-09-18). The mobile joystick stays screen-space because it is analog. Space = dash, F = pick up/drop (F also chews when at base with food), F/K alternate = chew. Mobile: joystick + pick-up/dash buttons + F/K buttons.
- Carry-back speed depends on food size AND body size.
- At base: press F / K to eat, one press = one chew; a big clear F / K prompt appears as soon as food reaches the base. (Changed from click-mash 2026-09-17.)
- Bases are 4×4 small cells (20×20 cm); the center food area is 4×4 too. A blinking arrow marks the player's slug at start.
- Food-type score multipliers + stackable buffs when an item is finished: algae ×0.8 · neopetrosia ×0.7 + speed +20% 20s · hydroid ×1 · sponge ×1.1 + body size +10% 15s · anemone ×1.2 + gill size +20% 10s.
- Every food type has the same 4 sizes: S −10% speed, 10 pts, 10 chews · M −20%, 15 pts, 20 chews · L −30%, 25 pts, 50 chews · XL −50%, 40 pts, 100 chews.

**Why:** player designed these rules directly; don't re-litigate them.
**How to apply:** implement to this spec; ask only about details not covered. Related: [[tournament-spec]]
