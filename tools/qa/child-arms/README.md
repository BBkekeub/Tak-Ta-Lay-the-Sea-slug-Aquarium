# Child arm proportions and jumping

Child arm cross sections are scaled to 80% and hands to 84%. Bone lengths and the existing pose cache are retained. Raised arms no longer inherit head yaw, nodding, or the child's 120% head scale when crossing neck height. IK also respects the minimum reachable distance between unequal bone lengths.

Verified in an isolated browser profile: all four body variants at four viewing directions at the jump apex; 176 sampled jump poses with fixed bone lengths, closed shirt seams and finite geometry. Existing bag-fit regression passed (96 carrying cases, 128 seam cases, cache reuse/offscreen checks). No added triangles. Live FPS and furniture collisions during jumping were not measured in this change.

Run `node tools/test-child-arms.mjs`. Optional `PEOPLE_BEFORE` supplies a prior people.js for comparison; otherwise both gallery passes use the current code. Images and visual-report.json are generated locally. No player save is used.
