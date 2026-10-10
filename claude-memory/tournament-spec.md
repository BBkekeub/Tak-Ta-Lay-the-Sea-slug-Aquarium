---
name: tournament-spec
description: "Player's spec for tug-of-war and slug-race tournaments (8 teams, bracket, prizes, invite mail) — agreed 2026-09-17"
metadata: 
  node_type: memory
  type: project
  originSessionId: c60daf42-f161-44e1-bc0a-398b0250dcff
  modified: 2026-09-18T06:04:45.946Z
---

Tug-of-war tournament (build first), then race tournament using the same frame.

- Invite arrives by in-game computer mail → register, pay 1,000 → 1 minute to move slugs into the tank; the 7 rival teams' people walk in gradually (door queue); normal customers don't interact with that tank.
- 8 teams, 3v3, random seeds 1–8. QF 1v2 · 3v4 · 5v6 · 7v8 → SF winners of each half → final.
- Bot-vs-bot matches are played for real in the tank with a skip button; player sees rival team genes/power (rest fingers / prepare).
- If the player is knocked out, they keep watching the remaining matches to the end (skippable), then get the result/prize.
- Prizes: 1st 3,000 · 2nd 2,000 · 3rd/4th (SF losers) 1,000 · 5th–8th 0.
- Invite frequency: **every 2 hours** per tournament type, race invite offset half a cycle from tug (changed 2026-09-18 from once per real day, because the game is now a paid long-play game); TOUR_TEST switch (10 min) kept for testing. A tournament invite also pushes that tank's normal 1v1 challenge timer back.
- Normal tank challenges (race/tug/eat/throw): every **20–45 min** each, and after any tank's challenge arrives the other tanks wait **5 min** (shared `ShopEvents` clock in config.js). 30–60/3 min was tried first and felt too empty.
- Race tournament: team of 3; each match is best-of-3 heats, each heat 1 slug vs 1 slug, player picks which slug before each heat. A slug that has raced gets vigor −10 for 1 hour (use foodBuffs with its own type). Everything else same as tug tournament.

**Why:** player designed these rules directly; don't re-litigate them.
**How to apply:** implement to this spec; ask only about details not covered here. Related: [[tug-team-modes]]
