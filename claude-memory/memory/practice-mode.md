---
name: practice-mode
description: Practice mode for all four contest tanks — added 2026-09-18 because stretched event timers left nothing to do between challenges
metadata: 
  node_type: memory
  type: project
  originSessionId: 9d616a3c-f788-4825-97b8-9d5c1a02c812
  modified: 2026-09-18T05:38:27.104Z
---

Player felt there was nothing to do between challenges once tank events were stretched to 30–60 min. Fix: **practice mode** (js/slug-practice.js).

- Enter any contest tank (race / tug / eat / throw) and a floating "ซ้อม" button appears; it opens a picker where the player chooses their own slug plus sparring partners **from slugs in that same tank** (not random rival slugs).
- Practice has no wager, no entry fee, no prize; it never touches a pending real challenge or the event timer, and it keeps the player inside the tank afterwards so they can run another one.

**Why:** keeps the minigames available at any time while real challenges stay rare and valuable.
**How to apply:** each mode calls `SlugPractice.sync(key, show, label, onClick)` from its own 1 s tick and builds a match with `practice:true`. Related: [[eat-contest-spec]], [[throw-contest-spec]], [[race-power-spec]], [[tournament-spec]]
