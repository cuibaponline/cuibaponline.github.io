# Lasso Ranch — Game Design & Business Analysis Spec

> **Working title:** *Lasso Ranch* (placeholder, final name TBD)
> **Reference:** "Cowboy Up" kids' arcade cabinet (photographed in a Vietnamese family entertainment centre)
> **Document purpose:** Hand-off to the development team (design, art, engineering, QA)
> **Version:** 1.0 draft

---

## 1. Executive Summary

Lasso Ranch is an offline, single-player, touchscreen web game for iPad. A herd of cartoon ranch animals runs across a field. Each animal wears a number that shows its point value. The player throws a lasso into one of two lanes and tries to catch high-value animals as they cross. The game is organised into short levels with score targets, and each level ends in a timed bonus round.

It reproduces the **gameplay mechanics** of the reference arcade cabinet with **original name, characters, art and audio**. The reference cabinet's logo, characters and assets must not be copied.

| Attribute | Value |
|---|---|
| Genre | Casual arcade / timing |
| Audience | Kids 4–10 (primary), families (secondary) |
| Platform | Web (Safari on iPadOS), installable as a PWA |
| Devices | iPad mini (2025) 8.3", iPad (10th gen / A16) 10.9" |
| Orientation | Landscape, locked |
| Rendering | 2D sprites with light 2.5D depth (parallax, scale-by-distance) |
| Input | Touch only, virtual on-screen controls |
| Connectivity | Fully offline, no server, no accounts |
| Players | Single player |
| Monetisation | None in scope (no ads, no IAP) |
| Session length | 2–5 minutes per level, 10–20 minutes per sitting |

---

## 2. Reference Game Analysis

### 2.1 What the cabinet shows

| Observation (from photos) | Interpretation |
|---|---|
| Title marquee "Cowboy Up" with crown, lasso and wooden sign | Western ranch rodeo theme |
| A herd of 5–6 animals runs left→right, each with a number (2, 5, 9, 17, 23) | Numbers are point values; tougher-looking animals are worth more |
| Animal types: yellow cow (2), Holstein cow (5), blue bull (9), spotted cow with red cape (17), red bison (23) | Value tied to character type, not random |
| Two white arrow markers at bottom centre | Two throwing lanes |
| A hand holding a coiled yellow lasso at the bottom | The player's throwing position |
| Lasso extends vertically up the lane (images 3–4) | Throw travels straight up the chosen lane |
| Caught animals (2 and 23) are pulled down with dizzy stars | Catch feedback: animal is dragged to the player, stunned |
| Two animals caught in one throw sequence | Multiple catches possible (one per lane, or a multi-catch) |
| Horse mascot in the bottom-left corner, reacting with grins | Companion/host character giving emotional feedback |
| Speech bubble "失败了！再来一次!" ("Failed! Try again!") | Fail state with retry prompt |
| Some animals stop and idle (blue bull eating a flower) | Animals vary speed and behaviour; idle animals are easy targets |
| Physical buttons: red, yellow, and a large central SHOOT button | Lane/aim controls plus a throw action |
| Health sticker: "Playing over 180 minutes a day harms your health" | Vietnamese regulatory notice; inspires an in-game play-time reminder |

### 2.2 Core appeal (why kids play it)

1. **One clear action.** Throw the rope. Easy to learn in seconds.
2. **Visible reward.** Big numbers on animals make value obvious, even for pre-readers.
3. **Timing tension.** Animals cross quickly, so there is a satisfying "now!" moment.
4. **Slapstick feedback.** Dizzy stars, funny faces, a grinning horse.
5. **Risk/reward.** Wait for the 23-point bison or grab the easy 2-point cow.

### 2.3 Assumptions (to confirm in playtest)

- The exact role of the red and yellow cabinet buttons is not visible. This spec assumes **left lane / right lane** selection.
- The cabinet is coin-operated with a fixed timer. Our version replaces coins with levels and a timed bonus.

---

## 3. Core Gameplay

### 3.1 Core loop

```
Animals enter → Player picks lane & throws → Lasso flies up lane
   → HIT: animal caught, dragged in, points added
   → MISS: rope retracts, short cooldown
→ Repeat until level timer ends
→ Score ≥ target? → Bonus round → Results (stars) → Next level
                  → No → "Try again!" → Retry level
```

### 3.2 The field

```
┌─────────────────────────────────────────────────────────┐
│ HUD: Level 3   ★ Target 120   Score 85   ⏱ 0:42   ⏸    │
│                                                         │
│   [far fence / barn / cacti — parallax background]      │
│                                                         │
│  →→  🐄5   🐂9      🐃23      🐄2   →→   (herd lanes)     │
│            ↑ Lane L        ↑ Lane R                     │
│                                                         │
│                 ⇧               ⇧    (lane markers)     │
│ 🐴 mascot                                               │
│ [ ◀ LEFT ]        [  THROW  ]         [ RIGHT ▶ ]       │
└─────────────────────────────────────────────────────────┘
```

- **Herd rows:** 1–3 depth rows (2.5D). Animals in back rows are smaller and slower; front rows are bigger and faster.
- **Lanes:** 2 vertical lanes (Left and Right), at roughly 40% and 60% of screen width. Hard mode may add a 3rd centre lane.
- **Throw origin:** bottom centre of the active lane, shown by the hand/lasso sprite.

### 3.3 Lasso mechanics

| Parameter | Easy | Medium | Hard |
|---|---|---|---|
| Lasso travel time (bottom → back row) | 0.45 s | 0.40 s | 0.35 s |
| Catch window (loop radius) | Large (1.3× animal hitbox) | Normal (1.0×) | Tight (0.8×) |
| Cooldown after miss | 0.4 s | 0.7 s | 1.0 s |
| Cooldown after catch | 0.6 s (drag-in animation) | same | same |
| Aim assist (snap to nearest animal) | On, ±15% lane width | Light, ±5% | Off |
| Rope reaches | All rows | All rows | All rows |

**Hit rule:** When the lasso loop reaches an animal's row, it catches the animal whose hitbox overlaps the loop. If several overlap, it catches the one in the **front-most row** (closest to the player). One throw = max one animal, except during the bonus round's "Mega Lasso".

**Throw states:** `Idle → Throwing → (Hit → DraggingIn) | (Miss → Retracting) → Cooldown → Idle`

### 3.4 Animals

All characters are original designs. Value increases with difficulty to catch.

| ID | Character (original) | Points | Speed | Behaviour | Spawn weight |
|---|---|---|---|---|---|
| A1 | Daisy, a chubby yellow calf | 2 | Slow | Steady walk | High |
| A2 | Patch, a spotted dairy cow | 5 | Medium | Steady run | High |
| A3 | Bluebell, a sleepy blue bull | 9 | Medium | Stops to graze 1–2 s, then trots | Medium |
| A4 | Captain Moo, a caped show cow | 17 | Fast | Hops/bounces (hitbox moves up and down) | Low |
| A5 | Rusty, a grumpy red bison | 23 | Very fast | Charges with a short speed burst | Very low |
| S1 | Golden Calf (special) | 50 | Fast | Rare, sparkles, appears max once per level | Rare |
| H1 | Skunk (hazard, Medium+) | −10 | Medium | Catching it costs points and stinks up the screen briefly | Low |
| H2 | Porcupine (hazard, Hard) | 0 + 1.5 s lasso jam | Slow | Catching it locks the lasso | Low |

**Readability rules:**
- The point number is always shown on the animal's side in large white text with a dark outline (min 28 pt).
- Hazards have a red "X" badge instead of a number, so pre-readers can recognise them.
- Each animal has a unique silhouette and colour so they can be told apart without reading.

### 3.5 Scoring

- **Base:** animal points.
- **Combo:** consecutive catches without a miss build a multiplier: ×1 → ×1.5 (3 in a row) → ×2 (6 in a row). A miss resets it. Combo display is on Medium and Hard only. On Easy, combos give a cheer but no multiplier, so failure isn't punished.
- **Hazard penalty:** score never drops below 0.

---

## 4. Level Structure (Levels + Timed Bonus)

### 4.1 Level flow

1. **Intro card** (2 s): level number, target score, any new animal ("New friend: Captain Moo!").
2. **Main round** (45–75 s): catch animals to reach the target.
3. **Result check:** target met → bonus round. Not met → "Try again!" screen with Retry / Menu.
4. **Bonus round** (15 s): see 4.3.
5. **Results:** total score, 1–3 stars, best score, Next button.

### 4.2 Star rating

| Stars | Requirement |
|---|---|
| ★ | Reach target score |
| ★★ | Reach target ×1.5 (main + bonus combined) |
| ★★★ | Reach target ×2 |

Stars unlock the next level (1 star needed). Total stars unlock cosmetic rewards (section 6).

### 4.3 Timed bonus round — "Stampede!"

- 15 seconds, and a **much denser herd** (spawn rate ×3).
- No hazards spawn.
- **Mega Lasso:** each throw can catch up to 3 animals in the same lane.
- A golden "Bonus" frame and faster music signal the change.
- Points are added to the level total and count toward stars.
- No failure possible. It is purely a reward.

### 4.4 Level progression (World 1 example, 12 levels)

| Level | Time | Target | Animals introduced | Notes |
|---|---|---|---|---|
| 1 | 60 s | 30 | A1, A2 | Tutorial overlay; 1 herd row |
| 2 | 60 s | 50 | — | |
| 3 | 60 s | 70 | A3 | Grazing behaviour taught |
| 4 | 60 s | 100 | — | 2 herd rows |
| 5 | 60 s | 120 | A4 | Bouncing hitbox |
| 6 | 60 s | 150 | S1 | First golden calf |
| 7 | 55 s | 170 | H1 (Medium+) | Hazard tutorial |
| 8 | 55 s | 200 | A5 | |
| 9 | 55 s | 230 | — | 3 herd rows |
| 10 | 50 s | 260 | — | Herd direction alternates per row |
| 11 | 50 s | 290 | H2 (Hard) | |
| 12 | 50 s | 330 | All | "Boss": a Rusty stampede wave at 0:20 |

Targets are tuned so an **Easy** player hits 1 star at ~60% accuracy. All numbers are starting values for balancing (section 11).

Future worlds (out of scope for v1): Desert Canyon, Snowy Ranch, Night Rodeo. Same mechanics, new backgrounds, 2–3 new animals each.

---

## 5. Difficulty Modes

Chosen on the main menu; can be changed anytime. Progress is stored per mode.

| Setting | Easy (kids 4–6) | Medium (7–10) | Hard (10+ / adults) |
|---|---|---|---|
| Herd speed | 0.7× | 1.0× | 1.3× |
| Aim assist | On | Light | Off |
| Catch window | 1.3× | 1.0× | 0.8× |
| Hazards | None | Skunk | Skunk + Porcupine |
| Lanes | 2 | 2 | 3 (from level 5) |
| Target score | 0.7× | 1.0× | 1.25× |
| Level timer | +15 s | base | base |
| Combo multiplier | Off (cheers only) | On | On |
| Fail screen | Gentle: "Almost! Let's try again!" + auto-hint | Standard | Standard |
| Throw control | One-tap (tap a lane button = throw there) | Lane select + Throw | Lane select + Throw |

**Easy mode principle:** a child should never feel stuck. After 2 failed attempts on the same level, offer a "Helper Horse" that slows the herd 20% for that attempt.

---

## 6. Meta Progression & Rewards (offline)

- **Stars:** collected per level, shown on the level map.
- **Sticker book:** catching each animal type for the first time unlocks its sticker with a short fun fact. Encourages catching every type.
- **Cosmetics** unlocked by total stars: lasso colours (5), hat for the mascot horse (5), ranch backgrounds (2). No currency, no shop.
- **Daily-free:** nothing time-gated. All rewards come from play.

---

## 7. Controls & Input

### 7.1 Virtual control layout (landscape)

| Control | Position | Size | Behaviour |
|---|---|---|---|
| LEFT lane button | Bottom-left, above safe area | ≥ 88×88 pt | Medium/Hard: selects left lane. Easy: throws in left lane |
| RIGHT lane button | Bottom-right | ≥ 88×88 pt | Same, for right lane |
| THROW button | Bottom centre | ≥ 120×120 pt, circular | Throws in the selected lane (hidden on Easy) |
| CENTRE lane button | Next to THROW (Hard, 3-lane levels) | ≥ 88×88 pt | Selects centre lane |
| Pause | Top-right | ≥ 56×56 pt | Pauses game, opens menu |

Apple's minimum touch target is 44×44 pt. We use double that for kids.

### 7.2 Alternative gesture (optional, settings toggle)

**Tap-on-lane:** tapping anywhere in the upper half of a lane throws there. Useful for very young players. Off by default to prevent accidental throws.

### 7.3 Input rules

- Multi-touch is supported, but only one throw can be active at a time (input ignored during cooldown, with a soft "click" sound and button dim).
- Buttons respond on `pointerdown` (not `click`) to avoid 300 ms latency.
- Visual press state: scale 0.92 + darker tint for 100 ms.
- Disable iOS gestures in game: `touch-action: none`, prevent double-tap zoom, pinch zoom, text selection, long-press callout, and pull-to-refresh/overscroll.
- Selected lane is highlighted with a glowing arrow (matching the reference's white arrows).

---

## 8. Screens & UI Flow

```
Splash → Main Menu ─┬─ Play → Difficulty → Level Map → Level Intro → Gameplay
                    │                                                 ├─ Pause → Resume / Restart / Map
                    │                                                 ├─ Fail → Retry / Map
                    │                                                 └─ Bonus → Results → Next / Map
                    ├─ Sticker Book
                    ├─ Wardrobe (cosmetics)
                    └─ Settings (sound, music, tap-on-lane, reset progress, play-time reminder)
```

### 8.1 Screen notes

- **Splash:** logo + "Tap to start". The first tap also unlocks Web Audio (required on iOS).
- **Main Menu:** big icon buttons with short labels; mascot horse animates idly.
- **Level Map:** a winding trail across a ranch; locked levels show a padlock; stars under each node.
- **HUD:** level number, target (with progress bar), score, timer, pause. Timer turns red and pulses in the last 10 s.
- **Fail screen:** mascot says "Oops! Try again!" (speech bubble, English).
- **Results:** stars animate in one by one with sound; "New best!" banner if applicable.
- **Parent gate:** "Reset progress" in Settings requires a simple hold-for-3-seconds to prevent kids wiping data.

### 8.2 Mascot (host character)

An original horse character (e.g., "Biscuit") lives in the bottom-left corner of gameplay and reacts:
- Catch → grin/cheer; high-value catch → big laugh.
- Miss → wince; 3 misses in a row → encouraging line.
- Hazard caught → holds nose.
- Last 10 s → excited/nervous.

Lines are short and also shown as icons, so non-readers understand them.

### 8.3 Play-time reminder

Inspired by the cabinet's health notice. Optional (default ON, settable in Settings): after 30 minutes of continuous play, show a friendly "Time for a break?" card with Continue / Stop. Not a hard lock.

---

## 9. Art & Audio Direction

### 9.1 Visual style

- Bright, saturated cartoon ranch; thick outlines; exaggerated expressions.
- **2.5D:** 3–4 parallax layers (sky, far hills/barn, fence, field). Back-row animals scaled to ~70% and slightly desaturated.
- Original characters only. Do not trace or copy the reference cabinet's characters, logo, or layout.
- Colour-coded animals (yellow, black-white, blue, cream-red, red-brown, gold).

### 9.2 Asset list (v1)

| Category | Items |
|---|---|
| Animals | 8 types × animations: run, idle/graze, caught (dizzy), dragged-in. Hazards add a special reaction |
| Player | Hand + coiled lasso (idle, wind-up, throw), rope segment, loop, 5 colour variants |
| Mascot | Idle, cheer, laugh, wince, nose-hold, excited (6 states) |
| Backgrounds | Ranch World 1: 4 parallax layers; bonus-round golden variant |
| UI | Buttons (lane, throw, pause, menu), HUD frame, progress bar, stars, padlock, speech bubble, level-map nodes, sticker frames |
| FX | Dust puffs, dizzy stars, sparkle, score pop-ups, combo text, skunk cloud, confetti |
| Fonts | 1 rounded display font (headings/numbers), 1 readable UI font; licensed for web embedding |

**Format:** sprite atlases (PNG/WebP) at 2× resolution, or Spine/DragonBones skeletal animation if the team prefers smaller files.

### 9.3 Audio

| Type | Items |
|---|---|
| Music | Menu loop, gameplay loop (country/banjo), bonus loop (faster), results jingle |
| SFX | Lasso swing, throw whoosh, catch "yank", animal sounds per type (moo, snort, bellow), miss, cooldown click, coin/point pop, combo up, star earned, fail, hazard |
| Voice (optional) | Short English mascot lines: "Yeehaw!", "Great catch!", "Try again!" |

All audio must be original or properly licensed. Separate music/SFX volume sliders.

---

## 10. Technical Specification

### 10.1 Target devices

| Device | Screen | Logical resolution (landscape) | Aspect |
|---|---|---|---|
| iPad mini (A17 Pro, current model) | 8.3" | 1133 × 744 pt | ~1.52:1 |
| iPad 10.9" (10th gen / A16) | 10.9" | 1180 × 820 pt | ~1.44:1 |

Confirm the exact "iPad mini 2025" model in the test lab.

**Scaling strategy:** design for a **1200 × 820 logical canvas** with a safe area of 1100 × 744. Use "fit + extend" (letterbox-free): the background extends to fill extra width/height; gameplay elements stay within the safe area. Render at `devicePixelRatio` (2×) for sharpness.

### 10.2 Recommended stack

| Concern | Recommendation |
|---|---|
| Language | TypeScript |
| Engine | **Phaser 3** (mature, scenes, input, audio, tweens, arcade physics), or PixiJS + custom logic if the team prefers lighter |
| Build | Vite |
| Offline | PWA: Web App Manifest + Service Worker (Workbox), precaching all assets on first load |
| Persistence | `localStorage` for settings/progress (small JSON), versioned schema; IndexedDB only if data grows |
| Audio | Web Audio via the engine; unlock on first user gesture (iOS requirement) |
| Hosting | Any static host; after first load, no network needed |

### 10.3 Performance budgets

| Metric | Target |
|---|---|
| Frame rate | 60 fps stable (120 fps not required) |
| Initial download | ≤ 25 MB total precache |
| First load to menu (online, first time) | ≤ 5 s on good Wi-Fi |
| Cold start offline (installed PWA) | ≤ 2 s |
| Input latency (touch → throw start) | ≤ 50 ms |
| Memory | ≤ 300 MB |

### 10.4 iPadOS / Safari considerations

- Add-to-Home-Screen is required for a full-screen standalone experience. Show a one-time "Install for full screen" hint in Safari.
- Lock to landscape via the manifest (`"orientation": "landscape"`). Safari may ignore this in-browser, so show a "Please rotate your iPad" overlay in portrait.
- Use `env(safe-area-inset-*)` for control placement.
- Handle `visibilitychange`: auto-pause the game and mute audio when the app goes to background.
- Storage can be evicted by iOS if unused for a long time; installed PWAs are more durable. Document this limitation; optional "export progress code" is out of scope for v1.

### 10.5 Suggested architecture

```
src/
  main.ts                 // boot, engine config, scale manager
  scenes/
    BootScene.ts          // preload, audio unlock
    MenuScene.ts
    LevelMapScene.ts
    GameScene.ts          // main round + bonus round (mode flag)
    ResultsScene.ts
    UIScene.ts            // HUD + virtual controls overlay (runs parallel)
  systems/
    HerdSpawner.ts        // spawn tables, rows, waves
    LassoController.ts    // state machine, hit detection
    ScoreSystem.ts        // points, combo, stars
    DifficultyConfig.ts   // per-mode multipliers
    SaveManager.ts        // localStorage, schema versioning
    AudioManager.ts
  entities/
    Animal.ts             // behaviour strategies: walk, graze, hop, charge
    Lasso.ts
    Mascot.ts
  data/
    animals.json
    levels.json           // all level tuning, editable without code changes
    difficulty.json
```

**Data-driven tuning:** all numbers in sections 3–5 live in JSON so designers can rebalance without code changes. Optional debug panel (dev builds only) to tweak values live.

### 10.6 Save data schema (v1)

```json
{
  "schemaVersion": 1,
  "settings": { "music": 0.8, "sfx": 1.0, "tapOnLane": false, "breakReminder": true },
  "progress": {
    "easy":   { "unlockedLevel": 4, "levels": { "1": { "stars": 3, "best": 92 } } },
    "medium": { "unlockedLevel": 1, "levels": {} },
    "hard":   { "unlockedLevel": 1, "levels": {} }
  },
  "stickers": ["A1", "A2"],
  "cosmetics": { "owned": ["rope_yellow"], "equipped": { "rope": "rope_yellow", "hat": null } }
}
```

### 10.7 Privacy & child safety

- No network calls after install, no analytics, no third-party SDKs, no ads, no IAP, no accounts, no personal data.
- All data stays on the device.
- No external links in the game (or behind a parent gate if added later).
- Aligns with COPPA / GDPR-K principles by design (no data collection).

---

## 11. Balancing Guidelines

- **Spawn rate (main round):** 1 animal every 0.9–1.5 s per row (random within range), weighted by the spawn table.
- **Expected throws per minute:** ~40–50 on Medium.
- **Target tuning formula (starting point):** `target ≈ expectedCatches × avgPoints × 0.6`, then adjust per playtest.
- **Golden calf:** 0–1 per level, appears in the second half of the round.
- **Fairness:** never spawn a hazard directly behind a high-value animal in the same lane within 0.5 s (prevents unavoidable penalties).
- **Easy-mode goal:** 90% of 5-year-old testers pass levels 1–3 on the first or second try.

---

## 12. User Stories & Acceptance Criteria

| ID | User story | Acceptance criteria |
|---|---|---|
| US-01 | As a player, I want to throw a lasso into a lane by tapping a button | Tap on lane/throw button starts a throw within 50 ms; lasso animates up the selected lane; input ignored during cooldown |
| US-02 | As a player, I want to catch an animal when my lasso hits it | Overlap of loop and hitbox at row arrival = catch; front-most animal wins ties; animal plays dizzy + drag-in animation; points pop up |
| US-03 | As a player, I want to see each animal's value | Every animal shows its number (≥ 28 pt, outlined); hazards show a red X badge |
| US-04 | As a player, I want levels with a goal | HUD shows target and progress; reaching target at timer end leads to bonus; otherwise fail screen |
| US-05 | As a player, I want a bonus round as a reward | 15 s, ×3 spawn rate, no hazards, Mega Lasso catches up to 3 per throw, cannot fail |
| US-06 | As a player, I want stars and unlocks | 1–3 stars per level by thresholds; next level unlocks at 1 star; best score saved |
| US-07 | As a parent, I want an easy mode for my young child | Easy mode applies all settings in section 5; Helper Horse offered after 2 fails |
| US-08 | As a player, I want to play without internet | After first load, game runs fully in airplane mode, including audio and all levels |
| US-09 | As a player, I want my progress saved | Progress persists across app restarts; corrupted save falls back to defaults without crashing |
| US-10 | As a player, I want to pause | Pause button and app backgrounding both pause timer, animation and audio |
| US-11 | As a parent, I want a play-time reminder | After 30 min continuous play (if enabled), a non-blocking break card appears |
| US-12 | As a player in portrait mode | A "rotate your iPad" overlay appears and the game is paused |

---

## 13. QA Test Matrix (summary)

| Area | Cases |
|---|---|
| Devices | iPad mini (2025), iPad 10.9"; latest iPadOS and one version back |
| Modes | Safari tab vs installed PWA |
| Orientation | Landscape left/right, rotate during play |
| Input | Rapid tapping, multi-finger tapping, tap during cooldown, palm resting on screen |
| Offline | Install → airplane mode → full playthrough |
| Interruptions | Home button/gesture, Control Centre, incoming notification, screen lock |
| Audio | Silent switch, Bluetooth headphones, first-tap unlock |
| Save | Kill app mid-level, clear Safari data, schema upgrade |
| Performance | 60 fps during bonus stampede with maximum on-screen animals |

---

## 14. Milestones (suggested)

| Phase | Duration | Deliverables |
|---|---|---|
| M0 Pre-production | 1 week | Final name, character sketches, greybox prototype of lasso + herd |
| M1 Core prototype | 2 weeks | Playable main round with placeholder art, 2 lanes, 3 animals, scoring; internal playtest |
| M2 Vertical slice | 3 weeks | Final art for World 1, levels 1–4, bonus round, Easy/Medium, audio, HUD, menus |
| M3 Content complete | 3 weeks | Levels 1–12, all animals and hazards, Hard mode, stickers, cosmetics, PWA offline |
| M4 Polish & QA | 2 weeks | Balancing with kid playtests, performance, bug fixing, accessibility pass |
| Release v1.0 | — | Hosted static PWA |

---

## 15. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| IP similarity to the reference cabinet | Legal | Original name, characters, art, audio; only mechanics reused; design review before art lock |
| iOS Safari audio/fullscreen quirks | UX | Audio unlock on first tap; install prompt; test PWA early (M1) |
| iOS storage eviction | Lost progress | Encourage PWA install; graceful defaults; document limitation |
| Too hard for young kids | Retention | Easy mode, aim assist, Helper Horse, playtest with ages 4–6 |
| Accidental touches by small hands | Frustration | Large buttons, generous spacing, tap-on-lane off by default |
| Performance during stampede | Jank | Object pooling, sprite atlases, cap on-screen animals (e.g., 18) |

---

## 16. Out of Scope (v1)

Multiplayer, leaderboards, cloud save, accounts, ads, in-app purchases, Android/desktop optimisation (should still run, but not tested), additional worlds beyond World 1, localisation beyond English (keep all strings in a strings file so Vietnamese can be added later).

---

## 17. Open Questions

1. Final game name and mascot name.
2. Should Vietnamese be included at launch alongside English?
3. Art production: in-house, outsourced, or licensed asset pack?
4. Skeletal animation (Spine) or frame-by-frame sprites?
5. Is a 3rd lane on Hard desirable, or keep 2 lanes everywhere to stay closer to the original?
