# ขอนไม้: รูปทรงเดียว สี่มุม

## หน้าตัดไม้ล่าสุด: วงปีและฝีแปรงเข้ากับด้านข้าง

แก้หน้าตัดทั้งสองปลายที่เดิมใช้สีเรียบกับวง sine จนดูเป็นก้อนดินคนละวัสดุกับผิวข้าง ใช้ built-in ImageGen สร้าง `wood-end-color.png` โดยอ้างอิง `wood-color.png` แล้วให้วัสดุปลายทั้งสองอ่านภาพด้วย planar UV และ bilinear sampling วงปี รอยแตก และปื้นพู่กันจึงหมุนไปกับชิ้นเดียวกัน ผิวด้านข้าง รูปทรง และมอสไม่เปลี่ยน ค่า geometryHash รวมยังเป็น `c29eddd0197a99923a0163482f1b0daa29b4f753ff03afed3572380836e02e70`

พรอมป์ต์ที่ใช้: Use the existing wood texture as exact palette and painterly brushwork reference. Create a square flat edge-to-edge weathered wood end-grain diffuse texture, muted medium taupe/warm brown, about seven irregular interrupted growth rings, slightly off-center heartwood, two short radial drying cracks, broad broken gouache patches matching the side. Soft illustrated aquarium art, medium detail, matte diffuse light. No log silhouette, bark rim, background, border, cast shadow, perspective, fine scratch noise, regular target circles, spiral, or moss. Rings continue beyond the image edges.

ไฟล์หน้าตัดนี้เป็นอินพุต offline ของ bake script เท่านั้น เกมโหลด PNG tank/shop 8 ใบและ thumbnail ที่อบใหม่ตามเดิม ตรวจภาพ tank ครบสี่มุมและ shop ทั้งสองปลายแล้ว เทสต์ภาพ สเกล ขอบโปร่งใส จุดยึด การหมุน และ cache ผ่าน พร้อม syntax check ยังไม่ได้ตรวจ UI ในเกมซ้ำ

## ปัจจุบัน: มอสมีปริมาตรและใบตั้งขึ้นจากผิวไม้

แก้ปัญหาพุ่มมอสใน texture ถูกยืดแบนตาม UV ของไม้ โดยสร้างฐานมอสโค้งนูนและใบสั้นโค้งแบบพับกลางบนต้นแบบใน `tools/bake-driftwood.cjs` ตำแหน่งและทิศของใบอยู่ในพิกัดวัตถุเดียวกันครบทุกมุม ใช้ random seed คงที่ ใบไม่ได้วาดติดผิวทรงกระบอกแล้ว ผิวไม้กลับไปใช้สีน้ำตาลเข้มก่อนวาดพุ่มมอสแบน

มอสมี 1,196 กอเล็ก รวมต้นแบบ 118,348 vertices / 141,680 triangles เฉพาะขั้นตอนอบภาพ เกมยังใช้ PNG 8 ใบกับ thumbnail เดิม ไม่มี mesh หรือ loop ใหม่ตอนเล่น ความสูงภาพรวมเพิ่มเป็น 6.9 ซม. เผื่อยอดมอส กรอบฉายทุกมุมคำนวณจากกล่องเดียวกันที่ 32 px/cm ไม่ย่อแต่ละภาพให้พอดีกรอบ พื้นที่วางไม้ยังเป็น 20×5 / 5×20 ซม. จุดยึดยังคือกลางฐานเดิม

รูปทรงไม้ล้วนไม่เปลี่ยน: `woodGeometryHash` = `3bc00dca45b6972edb1c769bd8abd67cb5f1f54b65cb76c665cc09b91589f4af` ส่วน hash รวมมอสเปลี่ยนตาม geometry ใหม่ ใช้การแก้ต้นแบบและอบภาพจากโค้ดในรอบนี้ ไม่ใช้การเจนมุมภาพแยกกัน

ผ่าน: ตรวจภาพ tank ครบสี่มุม เห็นยอดใบพ้นขอบไม้; test-driftwood-images และ test-driftwood ผ่าน รวมขอบโปร่งใส ภาพชิ้นเดียว สเกล จุดยึด การหมุนและแคช; syntax ของสคริปต์ผ่าน ยังไม่ได้ตรวจ UI เกมและอุปกรณ์จริงซ้ำในรอบนี้ ไม่อ้างผล FPS

## รุ่นก่อน: มอสใบเล็กวาดใน texture (ถูกแทนที่)

แทนคราบตะไคร่เรียบด้วยพุ่มมอสสีเขียว เห็นกลุ่มใบเล็กและแสงเงานุ่ม เกาะเฉพาะส่วนบนตาม UV เดิม ใช้ built-in ImageGen แก้ `wood-color.png` แล้วอบภาพ tank/shop 8 ใบและ thumbnail ใหม่ ต้นแบบและสเกลเดิม ไม่เพิ่มงานวาดต่อเฟรม

พรอมป์ต์: Edit the existing wood texture, preserve dark warm brown wood, soft gouache brushwork, grain, knot and 2:1 layout. Replace flat algae with lush green moss cushions and short grasslike leafy tufts in 4–5 irregular colonies, only in the top-facing UV strip y=12–38%, centered at 25%. Moss green, sage highlights and deep green crevices, soft painterly miniature foliage; no long grass, flowers or extra objects. Keep all wood outside the moss strip unchanged and keep a flat unwrapped texture format.

ตรวจภาพ tank ครบสี่มุม และทดสอบ `test-driftwood-images.cjs` / `test-driftwood.cjs` ผ่าน ยังไม่ได้ตรวจ UI เกมซ้ำในรอบแก้ผิวมอสนี้

## อัปเดต 27 กันยายน 2026: ไม้เข้มและตะไคร่ด้านบน

กู้ต่อจากงานที่หยุดหลังอบภาพสำเร็จ: ใช้ผิวจาก built-in ImageGen `exec-e894f828-4456-4efa-93b3-31a44f5b6604.png` ซึ่งติดตั้งเป็น `wood-color.png` แล้ว คงความนุ่มและร่องไม้เดิม เพิ่มน้ำตาลเข้มและตะไคร่เขียวหม่นเป็นหย่อมในช่วง UV แนวตั้ง 12–38% ที่ตรงกับด้านบนของไม้ ภาพ tank/shop ทั้ง 8 ใบและ thumbnail ใช้ผิวนี้แล้ว

พรอมป์ต์แก้ภาพ: Preserve the soft gouache treatment, wide grain spacing, broad brush patches and single knot. Darken the wood about 25 percent to muted warm walnut/taupe brown. Add 4–5 separated soft sage/olive algae patches strictly between 12% and 38% from the texture top, strongest at 25%; keep the rest clean wood. Thin matte coating, soft broken edges, no leaves, tufts, fine noise or extra sharp detail. Preserve the flat texture format and composition.

ตรวจต่อแล้ว: ดูภาพ tank ครบ 0/90/180/270 องศา ตะไคร่อยู่ด้านบน; `test-driftwood-images.cjs` และ `test-driftwood.cjs` ผ่านทั้งคู่ รวมสเกล ขอบโปร่งใส การหมุน จุดยึด cache และ culling ไม่ได้ตรวจ UI เกมซ้ำในรอบกู้ต่องานนี้

## ผิวปัจจุบัน: ใช้หินข้าง ๆ เป็น reference

ใช้ assets/decor/pumice-rock-06.png เป็น style reference โดยตรงกับ built-in ImageGen: ปื้นสีพู่กันนุ่ม ไฮไลต์ครีม เงาน้ำตาลอมม่วง และรายละเอียดขนาดกลาง คงร่องไม้ห่างและรูปทรงเดิม อบภาพทั้ง 8 ใบและ thumbnail ใหม่ หน้าตัดปรับสีให้เข้าผิวใหม่

พรอมป์ต์จริง:

Use attached pumice stair rock ONLY as an ART STYLE reference, not subject or geometry. Create a flat unwrapped WOOD COLOR TEXTURE for a driftwood sprite in the exact same illustrated aquarium art set. Reference style: soft matte hand-painted gouache, broad broken brush-painted color facets, gentle creamy highlights, muted lavender-grey shadow colors, soft irregular painterly transitions, readable medium-size details. Translate this to warm pale honey/taupe WOOD, not purple stone. About SIX widely spaced irregular horizontal wood grain grooves across texture height and ONE broad elongated knot. Grooves have softly rounded painted edges, medium lavender-brown shading not black outlines. Surface has a SMALL number of broad softly faceted brush-color patches like the reference; absolutely no photographic fibers, dense fine scratches, grain noise, tiny stippling or hairline strands. Keep wood recognizable and naturally irregular, not uniform wavy rubber bands. Low-to-medium contrast, soft painted edges, quiet large shapes matching reference finish. Landscape 2:1 flat diffuse color map fills canvas edge to edge, no perspective, no cylinder or log silhouette, no cast shadows, no stone pores or holes, no staircase, no text, no borders. This wraps around a fixed log template; do not change geometry. Match the reference's softness and stylized painted treatment rather than photorealism.

ปรับผิวรอบสมจริง: ผู้ใช้ยอมรับระยะห่างของลายแล้ว จึงคงร่องหลักกว้างและสเกลเดิม ใช้ built-in ImageGen สร้างผิวไม้เก่าสีน้ำตาลเทา ร่องหลักประมาณ 6 แนว ขอบไม่สม่ำเสมอ ตาไม้และสีเนื้อไม้แปรเล็กน้อย ลดลักษณะแถบเรียบแบบยาง หน้าตัดมีวงกว้างไม่สม่ำเสมอกับรอยแตกเบา 1 แนว รูปทรง/hash เดิมทั้งหมด ทดสอบ sprite และไฟล์ภาพผ่านหลังอบใหม่ทั้ง 8 ใบ

พรอมป์ต์ผิวรอบสมจริง: flat diffuse texture for water-worn driftwood, 6 broad irregular longitudinal bands, one weathered elongated knot, softened shallow grooves, muted warm grey-tan, painterly realism; no dense fine grain, scratches, noisy fibers, sharp cracks, baked shadows, perspective or log silhouette. Realism from broad irregular structure and color variation, not increased detail density.

ปรับผิวล่าสุด: เปลี่ยน wood-color.png เป็นลายวาดนุ่มสีน้ำตาลอ่อน มีแถบใหญ่ไม่กี่เส้น ลดแสงเงาจาก .65–1.08 เป็น .82–1.04 และลดหน้าตัดจากวงถี่พร้อม noise เป็นวงกว้างความต่างสี 2.5% รูปทรงและสเกลเดิมทั้งหมด (geometry hash ไม่เปลี่ยน) สร้าง PNG ทั้ง 8 ใบและ thumbnail ใหม่แล้ว

พรอมป์ต์ผิวล่าสุดใช้ built-in ImageGen: flat unwrapped diffuse texture, softly hand-painted casual aquarium game driftwood; 5–7 broad soft horizontal ribbons, muted tan-brown, low contrast, one understated knot; no fine grain, fibers, scratches, noise, sharp cracks, photorealistic bark, baked shadows or perspective.

ชุดนี้แทนภาพสี่มุมที่เจนแยกรูปทรงและตัดจาก sprite sheet ซึ่งมีปัญหาขนาดกับเศษภาพปนกัน

## วิธีสร้าง

`tools/bake-driftwood.cjs` สร้างต้นแบบชิ้นเดียวในพิกัดจริง 20 × 5 × 6 ซม. ล็อกลายผิวไว้บนต้นแบบ แล้วหมุนรอบจุดกลางฐาน 0/90/180/270 องศา ก่อนฉายเป็น PNG แยกทุกภาพ

ทุกไฟล์ใช้ 32 px ต่อหน่วยเซนติเมตรของการฉาย ไม่มีการ fit/stretch แต่ละภาพ จุดยึดคำนวณจาก origin เดียวกันและรวมขอบโปร่งใส 4 px พื้นที่วางในเกมเป็น 20×5 / 5×20 ซม. ตามมุม

ภาพในตู้: u=x+.475y, v=-.525y-.75z

ภาพหน้าร้าน: u=x+y, v=.5x-.5y-z พร้อมชดเชยทิศหมุนตู้ที่กลับแกน Y

ใช้โมเดลเฉพาะขั้นตอนสร้างไฟล์ ไม่โหลดหรือเรนเดอร์ mesh ขณะเล่น เกมใช้ sprite runtime และ cache เดิม ต้นแบบมี 25,671 vertices / 50,176 triangles; hash รูปทรงและ metadata ของทุกภาพอยู่ใน bake.json รูปลักษณ์เปลี่ยนจากภาพตัวอย่างเดิมเพื่อให้ทุกด้านมาจากชิ้นเดียวกัน

## สร้างซ้ำ

`node tools/bake-driftwood.cjs` ใช้ wood-color.png ที่เก็บไว้ และสร้างภาพกับ js/driftwood-decor-defs.js ใหม่

`CODEX_NODE_MODULES` ใช้ระบุตำแหน่ง sharp หากเครื่องอื่นไม่มี bundled runtime ที่ตำแหน่งค่าเริ่มต้น

## ผลตรวจ

- ผ่าน: node tools/test-driftwood.cjs — สี่มุม พื้นที่ชนและขอบตู้ การเซฟมุม จุดยึด การ reuse/cache และข้ามงานวาดนอกจอ/ซ่อน/ไม่ active ใน unit test
- ผ่าน: node tools/test-driftwood-images.cjs — สเกลครบ 8 PNG, ขอบโปร่งใส, กรอบฉายตรงกันของมุมตรงข้าม และแต่ละไฟล์มีขอนไม้ชิ้นเดียว ไม่มีเศษภาพข้างเคียง
- ผ่าน: node --check ในไฟล์ bake, นิยาม และ shop-floor
- ผ่าน: เบราว์เซอร์เซฟทดสอบ 127.0.0.1:8769 โหลดชุดใหม่ เลือกชิ้นเดิม หมุนตรวจภาพครบ 270/0/90/180 และซูมเข้าออก; หน้าร้านแสดงภาพชุด shop
- ยังไม่ได้ตรวจ: หมุนตัวตู้หน้าร้านครบสี่ทิศผ่าน UI, มือถือจริง, frame-time บนเครื่องสเปคต่ำ และการบังทากทุกตำแหน่ง

## พรอมป์ต์ลายผิว — built-in ImageGen

Use case: stylized-concept. Asset type: seamless diffuse COLOR TEXTURE for the unwrapped surface of a single 20x5x6cm aquarium driftwood log, NOT a picture of a whole log. Create one landscape 2:1 rectangular texture completely filled edge to edge with warm medium brown naturally water-worn driftwood grain. Long fibrous weathered grain flows horizontally from left to right, a few subtle elongated dark cracks and two modest knots that bend nearby grain, warm tan worn ridges, dark brown crevices, polished hand-painted aquarium game asset look with fine natural detail. Flattened unwrapped barkless wood SURFACE, photographed/scanned perfectly flat from above with uniform diffuse illumination, no shape silhouette, no ends or cross section, no rounded cylinder, no shadows, no vignette, no border, no labels, no objects, no transparent background. Repeat cleanly in the vertical direction around a log's circumference. Medium contrast, no baked directional highlights, no black deep holes. Texture only. This will be mapped to ONE fixed 3D template and used to bake four geometrically identical rotations, so do not render any perspective or volume into the texture.
