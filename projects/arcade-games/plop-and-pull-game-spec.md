# Plop & Pull: Game Design

> Built from this design. The shipped numbers live in `plop-and-pull/src/data.js` and moved during balancing: ring lure reach 280, no-touch pull 190, Big Tug speeds 95/170/300, three-star lines 50/150/290 for one boat and 80/270/480 for two. Three art calls also differ: Boxy is lime so it stands apart from Bobble, the photo flash is a local sparkle rather than a full-screen flash, and sideways play sits between rock walls.

**Pitch:** Plop your ring in the sea, pull a friend up the whole tall screen, and watch it leap over your boat for a photo.

**The special thing, the Long Pull:** the child pulls every catch up the full height of the screen, and friends hop onto the line on the way. Depth is the length of the pull, so the screen itself is the progress bar.

**Name check:** searches found no game called Plop & Pull. An unrelated itch.io game is called Plop [1].

"Guess" marks an untested assumption. "Model" means a throwaway simulation of these numbers, not a build. All numbers are starting values for `data.js`.

## 1. What the cabinet is

The photo confirms the brief and adds detail:

- **How-to panel (blurred, my reading):** aim and press the button to lower the hook; reel in quickly after a hit; reach the score for tickets or prizes.
- **Controls:** a drum with a centre button, and a lever by up and down arrows. Pump or crank is a guess. Relatives reel by hand [2, 3, 4].
- **HUD:** five stars, a countdown, 3 coins to start, and what looks like a prize counter (guess).
- **In the water:** apples, mugs and cans as junk, plus bubbles for "double score", "frozen ocean" and a crystal.

I could not find this exact cabinet. The closest documented relative is Sega's Big Sea Fishing: four players, twin 65" screens, "reel in as fast as possible to confirm the catch" [3]. How the hook is aimed is undocumented.

**Takeaway:** the fun is a quick drop, then a frantic physical reel. Lasso Ranch's rope retracts by itself, so the reel is unclaimed ground.

**Prior art:** Ridiculous Fishing catches on the way up, then launches fish skyward [5]; keep both, without the shooting. Gold Miner makes time the cost of a catch [6]; keep that as pull length, reject its swing.

## 2. Core loop

1. **Plop.** Touch anywhere. The boat zips over and the ring drops. A fish there stops and waits.
2. **Hop on.** The fish swims into a soft swim ring. There is no hook.
3. **Pull.** Tap, hold or do nothing. The line rises, faster with effort. From Level 2, friends it brushes hop on.
4. **Leap.** The line bursts through the surface. Each fish arcs over the boat, gets a photo flash, dives home and waves.
5. **Pearls.** Thank-you pearls fly into the jar. Touch again.

**Caught fish** get a ride, a photo and a splash home, and can be met again. The angler is a capybara, a plant-eater, so nothing hints at dinner.

**No dice:** anything the ring reaches is caught. Spawns vary; catch results never do.

## 3. Controls

| Scheme | Random tapper | Young hands | Uses height | Verdict |
|---|---|---|---|---|
| A. Swinging hook, tap to launch | Often misses | Needs timing; repeats Lasso's timed throw | Poor: a pivot fitted to the deep corners reaches only ±66 u at y 400 | No |
| B. Hold to sink, lift to reel | Barely leaves the surface | Long press 40-60% success at ages 2-3 [7] | Strong | No |
| C. Drag the hook | Works | Finger continuity is hard [8] | Hand hides the deep water | No |
| D. On-screen crank | Taps do nothing | Feasible [7], but needs a widget per child | Fair | No |
| **E. Touch to plop, then pull anywhere** | Every tap helps | Tap is the most intuitive gesture [8] | Strong | **Yes** |

**Rule: no touch is ever wrong.** Register on touch-down, not lift [8]. Every touch draws a ripple and ticks within one frame.

| State | Lasts | Tap | Hold | Drag | No touch |
|---|---|---|---|---|---|
| Ready | Until touched | Cast | Cast, then pull | Cast at first point | Hint at 6 s [8] |
| Plop, Hop on | 0.3-1.3 s | Ripple | Carries to Pull | Ignored | Continues |
| Pull | 0.2-6 s | +55 u ÷ weight | 520 u/s ÷ weight | Held finger leans the ring toward it, 260 u/s max | 170 u/s ÷ weight |
| Pop | 0.25 s | Ripple | Ignored | Ignored | Ready |

**Cast rules:**
- Ring drops at 1100 u/s, boat moves at 1400 u/s. The ring passes through other fish going down.
- Snap to the nearest free fish within 120 u plus its radius [9]. It stops.
- Otherwise the ring goes to the touch, clamped to the floor, and the nearest fish within 240 u swims over at 300 u/s.
- If none comes, the ring brings up a Funny Find. **A cast never comes up empty.**
- A held finger never re-casts.

**Input rules:**
- Use Pointer Events and `touch-action: none`. Treat `pointercancel` as lift.
- Ignore touches starting in the bottom 60 u, where wrists rest [8].
- Treat a touch within 120 ms and 60 u of the last as the same touch. Holdovers reached nearly 10% of tablet touch events [9].

**Sizing:** the smallest fish is 100 u, about 14 mm on iPad mini, above MTAGIC's largest tablet target of 12.7 mm [9]. Snap widens the real target to about 5 cm.

## 4. World

Portrait, 820 x 1180. Scale is `min(w/820, h/1180)`, centred, with sky and water extended to fill spare space.

Sky with sun, jar, boats and leaps is y 0-270. Shallows are 340-600, middle 560-810, deep 830-1030, sea floor 1070 and below.

**Landscape:** iOS ignores manifest `orientation`, and the Screen Orientation API is only partly supported [10]. Preschoolers tend to hold tablets in landscape [8]. So never block play: the same formula gives a centred column, plus a turn-the-iPad icon for 3 s.

## 5. Three levels

A sand shelf hides deeper water, so each level opens more of the screen. The menu is the same cutaway: tap a depth to play it. Finishing a level unlocks the next; stars are never a gate.

| | 1 Sunny Shallows | 2 Kelp Middle | 3 The Deep |
|---|---|---|---|
| Sky | Morning | Noon | Sunset |
| Sun time | 45 s | 60 s | 75 s |
| Floor y | 640 | 850 | 1070 |
| Fish, 1 / 2 boats | 7 / 9 | 10 / 14 | 12 / 16 |
| New creatures | Bobble, Stripes, Hoppa | Boxy, Shelby | Glim, Swoop, Big Hum |
| New idea | Plop and pull | Hop-ons, bubbles | Big Tug |
| First sight | One glowing fish, a ghost hand, three silhouettes on the sand | Sand crumbles; one fish sits on the line's way up | The last sand falls; a huge shape hums below |

**Staying gentle:** levels add things to do, never harder ones. Speeds do not ramp, tapped fish always wait, and nothing is dangerous.

**Hop-ons:** the rising ring collects up to 3 extra fish within 35 u + 0.35 × radius. None join a Funny Find.

**Bubbles:** they rise at 60 u/s, at 20 and 40 s on Level 2, and 15, 35 and 55 s on Level 3. They alternate Double (pearls ×2 for 8 s, not stacking with Golden Glow) and Big Ring (next pull: hop-on radius ×2, 5 extras). Any touch pops them. Contents show on the outside, so no mystery prizes.

**Big Tug:**
- At 70% of the day, Big Hum rises to y 960. A cast on it attaches, and the sun pauses.
- Pull speed: no touch 80 u/s, one child holding 160, both 300. Each tap adds 24 u.
- It breaches nose-first, filling the screen height, then pours 20 pearls.
- At 85% of the day it takes the ring by itself, so every run gets the breach.

## 6. Roster

| Creature | Looks | Band y | Pearls | Speed u/s | Size u | Radius | Weight | Spawn L1/L2/L3 |
|---|---|---|---|---|---|---|---|---|
| Bobble | Round yellow | 340-480 | 1 | 45 | 110×100 | 62 | 1.0 | 4/2/0 |
| Stripes | Orange stripes | 340-560 | 1 | 60 | 120×100 | 62 | 1.0 | 4/2/1 |
| Hoppa | Seahorse, bobs ±30 | 420-600 | 2 | 30 | 100×140 | 70 | 1.0 | 2/2/1 |
| Boxy | Yellow box | 560-700 | 3 | 55 | 140×100 | 75 | 1.1 | 0/3/2 |
| Shelby | Turtle | 640-810 | 4 | 40 | 180×120 | 95 | 1.2 | 0/2/2 |
| Glim | Lantern fish, gummy smile | 830-960 | 5 | 50 | 170×120 | 90 | 1.2 | 0/0/3 |
| Swoop | Manta ray | 860-1030 | 7 | 70 | 240×130 | 125 | 1.3 | 0/0/2 |
| Big Hum | Whale | 960 | 20 | 25 | 560×220 | Body | Big Tug | Event |

Vary speed ±15%. Refill from off-screen after 0.6 s. Funny Finds are a boot, teapot, rubber duck and stripy sock, in fixed rotation, for 1 pearl. The 1, 3, 5, 20 tiers keep the ratio of the cabinet's 10, 29, 49, 200.

## 7. Scoring, stars, finishing

- **Pearls** are the only score. They never fall and nothing costs any.
- **Jar:** tall, with two lines. Pre-readers read the fill; early readers read the number beside it.
- **Fish show no numbers.** Pearls fly in one at a time and a "+3" pops, so small catches can be counted.
- **Failure does not exist.** Every level finishes at sunset, and finishing earns ★.

| Jar lines ★★ / ★★★ | L1 | L2 | L3 |
|---|---|---|---|
| One boat | 18 / 36 | 45 / 115 | 85 / 210 |
| Two boats | 34 / 68 | 112 / 270 | 187 / 460 |

**Rewards:** total stars unlock boat cosmetics at 3, 6 and 9: flag, parasol, party lights. The sticker book holds 8 creatures and 4 finds.

## 8. Time

Keep a soft clock. Natural stopping points smooth screen transitions, two-minute warnings made them worse, and parents named autoplay as a major conflict [11].

- The sun crosses the sky to the horizon, with no digits, ticking or warning.
- It pauses in the tutorial, during Big Tug, and after 8 s without touches.
- The last 10 s are Golden Glow: gold light, a key change, pearls ×2.
- Results wait for a tap and never auto-advance.
- After Level 3, a moonlit Goodnight scene shows every friend met. A full pass takes about 5 minutes (guess).

## 9. Players

**Recommendation: co-op, side by side, one jar.** Competition suits a cabinet, not young players sharing one iPad:

- Children aged 4-5 shared more after a cooperative game than after the same game played competitively (randomised, n=120) [12].
- With one input, children aged 8-12 fought for control about 5 times per 10 minutes. Two inputs were more fluid [13].
- Children aged 6-7 with two mice worked in parallel with limited reciprocity [14]. So one moment rewards both: the Big Tug.

None of these are touch-game studies, so they show direction, not proof.

**One boat:** full width. A second child can join any pull just by touching.

**Two boats,** chosen by menu icon:
- Capybara left, duckling right, each in its own half.
- Each finger belongs to the half it started on, as in Bubble Reef, and snaps only there.
- A tap reserves a fish, so it cannot be stolen.
- One jar, one sticker book, no per-child score.
- Both sit at the bottom edge, because the sky has only one up.

**Across the age range (ages are guesses):**

| Player | Does | Gets |
|---|---|---|
| Pre-reader, 3-4 | Taps or mashes | Splashes, leaps, jar, 1-2 stars |
| 5-6 | Picks fish, holds to pull | Silhouettes, stickers, 2 stars |
| Early reader, 7-8 | Goes deep, leans for hop-ons | 3 stars, numbers |

## 10. Feedback, in priority order

1. **Touch:** ripple and tick within a frame.
2. **Pull:** rod bends, line hums, reel ticks on each tap, pitch rises with height.
3. **Breach:** spray, 4 u shake for 120 ms, splash scaled to the catch.
4. **Leap:** arc to y 70, tumble, white photo flash.
5. **Pearls:** one by one on a rising scale; the jar sloshes.
6. **Plop:** water crown, falling bloop.
7. **Hop on:** ring wiggles; each adds a note to a chord.
8. **Stars and stickers:** a star pops off the jar line; a first-meeting sticker crosses the screen.
9. **Big Hum:** low hum, full-width splash.

There are no failure sounds.

## 11. Onboarding

No text. Only touchable things look touchable, and they glow [8].

1. Title: a bobbing boat. Any touch starts and unlocks audio.
2. One big Bobble stops and glows. A ghost hand taps it.
3. Any touch casts to it, so the first cast cannot go wrong.
4. The hand pumps during the pull, but the fish rises anyway, so the tutorial cannot stall.
5. Leap, first sticker, the sun starts, more fish arrive.

After 6 s idle, the nearest fish glows and the hand returns. Add a README parent note on seating and Guided Access.

## 12. Cabinet: keep, change, drop

| Keep | Change | Drop |
|---|---|---|
| Sky over sea | Hook → soft ring | Coins, cost per play |
| Value by depth, 1:3:5:20 | Lever → pull anywhere | Tickets, prizes, prize counter |
| Lower, then reel | 45 s digits → sun, 45-75 s | Freeze bubble: tapped fish already stop |
| Short rounds | Numbers on fish → pearls | Four seats |
| Bonus bubbles | Junk penalty → Funny Finds that pay | All its names, characters, art, text |
| Star goal | Five stars → three | Toothy anglerfish |
| Two on one ocean | Competition → co-op | |

## 13. Against our other games

Bubble Reef is landscape: many shots wear down HP across endless waves. Lasso Ranch is landscape: a timed throw with auto-retract, misses and retries. This game is portrait: one touch, a long pull, no misses, and it always ends at sunset.

The first touch resembles Bubble Reef's on purpose, because tap is the surest gesture. The game lives in what follows: pull, route, leap.

**Keep from them:** 1-3 stars, stickers, star-unlocked cosmetics, a reward finale, gentle tone, Lasso's module layout and balance script.

## 14. Cut list, first to go first

1. Boat cosmetics
2. Goodnight scene
3. Big Ring bubble
4. Silhouettes on the sand
5. Funny Finds down to the boot alone
6. Sticker book screen (keep the sticker flash)
7. Sand-crumble animation (hard cut)
8. Two-boat mode (a second child can still help pull)

**Never cut:** the pull with lean, the leap, never-empty casts, the sun, three levels, Big Tug.

**Art scope:** one parametric fish drawer covers Bobble, Stripes, Boxy and Glim. The rest are custom.

## 15. Risks and tests

| Risk | Test | If it fails |
|---|---|---|
| Too automatic for the oldest child | Does an early reader replay for ★★★? | Raise ★★★ lines |
| Pull feels like waiting | Does a pre-reader touch during pulls? | No-touch speed 220 |
| Two children crowd an iPad mini | 3 rounds on each iPad; count hand-blocking | Use a stand; alternate rounds |
| Palms trigger system gestures | Two children mash for 5 minutes | Guided Access note |
| Memory and frame rate | Log canvas bytes, budget 64 MB (guess); cap DPR at 2; one background at a time. Hold 55 fps with 16 fish on a real iPad, as headless runs missed an earlier crash | Shrink sprites, cut particles |

**Balance checks:** a seeded `balance` script, 300 runs per level, one and two boats. Same seed must give the same score. The Model column covers both modes, excludes bubbles, and counts Big Hum as a flat 20.

| Simulated player | Pass | Model |
|---|---|---|
| Random: 1.5 taps/s, uniform points | ★ 100%, ★★ ≥95%, ★★★ ≤10% | ★★ 97-100%, ★★★ 0% |
| Random | ≥15 casts one boat, ≥80% creatures, 0 empty | 16-20, 83-91%, 0 |
| Random | Mean longest reward gap ≤7 s | 3.3-6.6 s |
| Masher: 4 taps/s | ★★★ ≤25% | 3-18% |
| Holder: 2 s press, 0.7 s lift | Within 20% of Random | Within 15% |
| Focused: best value per second, holds, leans | ★★★ ≥90%, no species over 50% | 94-100%, top 22-44% |

Focused beats Random about 2.5× on Levels 2 and 3, mostly through hop-ons; confirm that feels fair in real play.

## Sources

Sources 2-4 are vendor text. 海钓王 was read through a search summary only.

1. Plop: https://marvincode.itch.io/plop
2. Pirate's Hook: https://mpamusement.com/products/pirate-s-hook-4-player-ticket-arcade-game-1 and https://www.bmigaming.com/Games/Flyers/redemption-arcade-games/pirates-hook-arcade-ticket-videmption-game-brochure-unis-universal-space.pdf
3. Sega Big Sea Fishing: https://segaarcade.com/games/big-sea-fishing and https://creative-arcades.com/products/big-sea-fishing-4-player-competitive-fishing-redemption-arcade
4. 快乐小钓手: https://www.amunion.com/product/252908.html; 海钓王: http://www.youle598.com/article/2821.html
5. Ridiculous Fishing: https://en.wikipedia.org/wiki/Ridiculous_Fishing
6. Gold Miner: https://apps.apple.com/us/app/id1220402922
7. Nacher et al. 2015: https://riunet.upv.es/bitstream/10251/64752/3/VersionAutor.pdf
8. Sesame Workshop 2012: https://joanganzcooneycenter.org/wp-content/uploads/2020/02/SesameWorkshop-2012.pdf
9. Anthony 2019, MTAGIC: https://init.cise.ufl.edu/wp-content/uploads/sites/378/2019/03/anthony-et-al-IJHCS2019-MTAGIC-final-preprint.pdf
10. iOS PWA compatibility: https://firt.dev/notes/pwa-ios/
11. Hiniker et al. 2016: https://www.washington.edu/news/2016/05/05/two-minute-warnings-make-kids-screen-time-tantrums-worse/
12. Cooperative vs competitive, 2025: https://pmc.ncbi.nlm.nih.gov/articles/PMC12268353/
13. Stewart et al. 1998: https://www.cs.umd.edu/projects/hcil/pad++/papers/chi-98-sdg/index.html
14. Stanton and Neale: https://researchportal.bath.ac.uk/en/publications/the-effects-of-multiple-mice-on-childrens-talk-and-interaction/
