# Follyworks part art specification

All part art is procedural Canvas 2D painting in `src/render/art/parts.ts`. Gameplay never depends on art: views place these textures in each component's **local frame** (x right, y down, origin = the object's placement point, angle 0, unflipped, "facing right" = +x). Every texture listed below must line up with the physics outline given, so what you see is what collides.

Units: world units (≈ cm). Textures are painted at `scale` pixels per unit (normally 2). Texture size `w × h` is in world units; `origin (ox, oy)` is the texture pixel position (in world units, from the texture's top-left) that sits on the local-frame point named. Unless stated, origin = texture centre = local (0,0).

## Style
Whimsical cinematic 2.5D engineering-diorama look: hand-painted, tactile, slightly worn workshop objects with a **dark warm outline** (≈ #1d1612 at 1.5–2 units), soft form shading (warm key light from upper-left, cool bounce from lower-right), restrained grime and scuffs, small specular highlights. Muted base materials (wood, steel, brass, rubber, ceramic, aged plastic, painted metal) with **selective** saturated accents (safety orange, signal red, cyan indicator, green LED). Parts must read clearly against a mid-dark, desaturated workshop background: strong silhouette, value contrast inside each part. Avoid flat corporate vector, glossy mobile-game style, pixel art. Keep a consistent light direction, outline weight and palette across every part so they look like one family.

## Textures

| key | size | origin → local | must match / contents |
|---|---|---|---|
| `ball` | 32×32 | centre | circle r=14 rubber ball, terracotta/orange-red with a cream stripe band so rotation reads. **No baked highlight.** |
| `shine_xs` / `shine_s` / `shine_m` | 28 / 32 / 48 square | centre | soft specular + rim light overlay for spheres r=12 / 14 / 20, transparent elsewhere, light from upper-left. Drawn non-rotating on top of balls. |
| `bowling_ball` | 44×44 | centre | circle r=20, dark cast iron, three finger holes, faint rust speckle. No baked highlight. |
| `cannonball` | 28×28 | centre | circle r=12, black iron with a casting seam. No baked highlight. |
| `crate_wood` | 48×48 | centre | box 44×44 (corner chamfer 3): wooden slat crate, diagonal brace, nails, faint stencil. |
| `crate_steel` | 48×48 | centre | box 44×44: riveted steel crate, worn paint, hazard-stripe corners. |
| `domino` | 14×60 | centre | box 12×58: ivory domino, black pips, centre line. |
| `plank` (param `length` 40–600) | (length+4)×18 | centre | box length×14: wooden board, end grain at both ends, a few nails; must look good from 40 to 600 long (draw procedurally along the length, not by stretching). |
| `seesaw_plank` (param `length` 120–400) | (length+4)×16 | centre | box length×12: painted board (teal-grey paint, worn) with a steel centre bracket at x=0. Rope hooks at x = ±(length/2 − 10), y = −7 (small eye bolts). |
| `fulcrum` | 52×40 | (26, 2) → local (0,0) | triangle apex (0,2), base corners (±22, 36): steel A-frame, pivot bolt at apex. |
| `trampoline_frame` | 100×34 | centre | covers y −7…15 (body is 96×22 centred at (0,4)): steel frame with short legs, coil springs along the top edge. Leave the top band y −9…−3 empty (mat drawn separately). |
| `trampoline_mat` | 92×8 | centre | stretched black rubber mat, drawn at local (0,−6); game squashes it vertically. |
| `bucket` | 74×74 | (37, 50) → (0,0) | U-shape: bottom slab x −33…33, y 14…22; side walls x ±31 (6 wide) from y −34…22. Galvanised bucket (slight taper ok inside those bounds), wire handle arcing up to y −48 with a grip at (0,−46). Interior visible (darker). |
| `hook` | 26×32 | (13, 12) → (0,0) | wall mounting plate y −12…0 (bolted), steel hook curling down to y ≈ +8; rope ties at (0, 6). |
| `pulley_mount` | 36×46 | (18, 18) → (0,0) | bracket from wall above (y −18) down to the axle at (0,0) with a short back plate. No wheel. |
| `pulley_wheel` | 40×40 | centre | grooved wheel r=18 with 4–5 spokes and hub; rotates. |
| `gear_small` / `gear_medium` / `gear_large` | 60 / 84 / 120 square | centre | pitch radius r = 22 / 34 / 52, teeth tips at r+6, roots at r−3; tooth count ≈ round(r/3); hub, spokes or lightening holes; brass or blued steel. Rotates. |
| `motor_body` | 64×52 | (32, 24) → (0,0) | housing rect 56×40 centred (0,4) (y −16…24): electric motor with cooling fins, nameplate, mounting feet. Leave a clear circular boss r=14 at (0,−2) (the pinion sits there) and leave the spot (−22,16) clear-ish (power socket is drawn by the game). |
| `motor_pinion` | 32×32 | centre | small gear, pitch r=12, teeth to r+4. Rotates. |
| `conveyor` (param `length` 100–600) | (length+4)×30 | centre | rounded belt loop (body length×22, end radius 10) around end rollers, side rail, rivets. Keep the top belt surface y −11…−7 fairly flat/plain (game draws moving tread marks). No legs (it is mounted to the wall). |
| `roller` | 24×24 | centre | end roller / drive wheel r=11 with spokes; rotates; drawn at the left end x = −length/2 + 12. |
| `fan_body` | 60×78 | (30, 40) → (0,0) | physics rect 40×64 centred (−6, 6). Desk fan in 3/4 view facing right (+x): weighted base on the bottom (y ≈ 38), stand, motor housing at the back, elliptical wire cage at the front centred (6,−6), radius ≈ 26 tall / 12 wide (seen at an angle). |
| `fan_blades_0` / `_1` / `_2` | 26×52 | centre (placed at local (6,−6)) | the blade disc inside that ellipse at three rotation phases; game cycles them. |
| `balloon_red` / `_yellow` / `_teal` | 48×60 | (24, 26) → (0,0) | balloon body ≈ r 21 (slightly taller than wide) centred (0,0), tied knot at (0,24). Rubber sheen. String is drawn by the game. |
| `magnet` | 64×52 | centre | body 56×44: electromagnet, copper coil windings around an iron yoke, pole face on the +x side (around x=28), terminal block at (−24,16) left clear-ish. |
| `candle` | 26×56 | (13, 30) → (0,0) | wax candle body x −7…7, y −14…22, on a brass dish holder y 22…29, wick to y −19. **No flame** (game animates it at (0,−27)). |
| `dynamite` | 40×30 | centre | body 34×22: three red sticks bundled with tape, a fuse leaving the top-left and curling up to about (−10,−14). |
| `rocket` | 64×26 | centre | body 54×16, nose at +x (x=27): toy rocket, cream/red, porthole, fins at the tail, nozzle at x −27. |
| `cannon_carriage` | 80×42 | (40, 20) → (0,0) | wooden carriage with one big spoked wheel; occupies body rect 56×30 centred (−4, 6) (y −9…21). |
| `cannon_barrel` | 64×26 | (22, 13) → local (0,−2) | iron barrel from x −22 to the muzzle at x +42, thickness ≈ 20, reinforcing bands, fuse touch-hole at the back top. |
| `glove_box` | 58×40 | (31, 20) → (0,0) | spring box body 50×34 centred (−4,0): painted crate/box with a round opening on the +x side and a trigger plate on the back (x ≈ −30). |
| `glove_spring` | 40×16 | (0, 8) → left end | zig-zag coil spring, horizontal; game stretches it in x. |
| `glove` | 36×32 | (6, 16) → cuff | red boxing glove facing +x, cuff at the left. |
| `battery` | 40×60 | (20, 28) → (0,0) | body 34×52 centred (0,2) (y −24…28): big 6 V lantern battery, label band, + terminal on top at (0,−30). |
| `switch_plate` | 48×58 | (24, 32) → (0,0) | wall-mounted switch plate y −32…20 with screws, lever slot near (0,−12), small LED window at (12,−24). |
| `switch_lever` | 12×34 | (6, 30) → pivot | lever pointing up from its pivot, ball tip at top. Game rotates it ±28° about (0,−12). |
| `plate_base` | 80×16 | (40, 8) → (0,0) | bevelled trapezoid (−38,7) (38,7) (30,−5) (−30,−5): diamond-plate steel base. |
| `plate_top` | 60×6 | centre | yellow/black hazard pad drawn at (0,−6); game moves it down 3 units when pressed. |
| `timer` | 56×50 | (28, 24) → (0,0) | wall-mounted kitchen timer, body 48×42 centred (0,2): enamel case, big dial face centred (0,0) r≈15 with tick marks, a bell on top. No hand. |
| `timer_hand` | 4×18 | (2, 16) → dial centre | dial needle. |
| `logic_box` (param `mode`: and/or/not/xor/toggle) | 56×48 | (28, 23) → (0,0) | wall-mounted grey junction box 48×40 centred (0,1), small enamel label reading AND / OR / NOT / XOR / TOGGLE and a simple gate symbol. Ports drawn by the game at (−26,−8), (−26,10), (26,1). |
| `bulb_off` / `bulb_on` | 40×62 | (20, 32) → (0,0) | wall-mounted bulb in a ceramic socket: glass bulb top half (y −28…6), socket y 6…26, cable stub at (0,28). `bulb_on`: warm glowing filament and tinted glass (glow halo is added by the game). |
| `robot_body` | 40×48 | (20, 26) → (0,0) | Bolt the tiny wind-up robot, facing right, torso+head occupying y −22…10 within the 30×44 body (legs separate): boxy painted tin body, one big round visor eye on the right side of the head, antenna up to (0,−30), wind-up key on the back (−x), small back hook at (−12,−6). Expressive, cute, anime-tinged silhouette. |
| `robot_leg` | 8×16 | (4, 2) → hip | one stubby tin leg with a foot pointing +x; the game swings two of them at hips (−6,10) and (6,10). |
| `robot_eye` | 14×14 | centre | soft cyan glow for the visor. |
| `cactus` | 38×62 | (19, 32) → (0,0) | terracotta pot (x −15…15, y 4…28) with a rounded cactus column (x −9…9, y −29…4) and one or two arms, spines, a little flower. |
| `wall` (params `w`,`h`,`material`: concrete/brick/wood/steel) | (w+4)×(h+4) | centre | solid block w×h; material-appropriate surface drawn procedurally to any size (20…1600 × 20…1200). |
| `tool_rope` / `tool_belt` / `tool_wire` | 64×64 | centre | parts-bin icons: coiled rope, a rubber drive belt loop around two pulleys, a coil of insulated wire with plugs. |

## API

```ts
export interface PaintedTexture { canvas: HTMLCanvasElement; /** origin in canvas pixels */ ox: number; oy: number; }
/** Paint one texture at `scale` px per unit. Unknown keys return a visible magenta placeholder (never throw). Deterministic. */
export function paintPart(key: string, params: Record<string, string | number | boolean>, scale: number): PaintedTexture;
/** A parts-bin icon for a component type (or 'rope'/'belt'/'wire'), fitted into size×size pixels on transparent background, composed from the same painters. */
export function paintIcon(type: string, props: Record<string, string | number | boolean>, size: number): HTMLCanvasElement;
export const PART_KEYS: string[];
```
