# FRANKENSTEIN

A 2D maze arcade game for the browser, built with HTML Canvas, CSS and vanilla JavaScript modules. No framework, no build step, no backend, no external services.

Inspired by Mary Shelley's *Frankenstein*.

**Status: one playable story level.** The Creature stalks a Victorian village while Victor tries to catch it. William Frankenstein waits in the village square. Catch the Creature before it reaches the boy, and William and Justine are safe. Fail, and the novel's tragedy follows.

## Project structure

```text
index.html          Menu, HUD, pause overlay, result overlay, instructions
css/
  base.css          Design tokens, reset, app layers, shared buttons
  menu.css          Menu, difficulty, HUD timer/lives, overlays, cast, modal
js/
  main.js           Boot: composes settings, audio, input, renderer, game
  config.js         Settings, difficulty tuning, time limits, capture rules
  maze.js           ASCII layout, tiles, directions, actor spawns
  camera.js         Fit-all camera that scales the maze to any viewport
  actor.js          Shared grid-aware, collision-safe movement
  player.js         Victor's movement controller and buffered turns
  creature.js       Base Creature AI, lives and respawn invulnerability
  story.js          William's tile, outcomes and the story-seeking Creature
  pathing.js        BFS distance fields and escape-route lookahead
  timer.js          Wall-clock countdown, star scoring, clock formatting
  sprites.js        Pixel-art cast, directional frames and cast portraits
  renderer.js       Canvas: stone maze, gaslight, actors and hit effects
  loop.js           Shared requestAnimationFrame loop with clamped delta
  game.js           State machine, timer/lives loop, pause and results
  menu.js           DOM controller for screens, HUD, overlays and cast
  audio.js          Synthesised UI, hit, victory and defeat sounds
  input.js          Keyboard state + WASD/arrow mapping
  storage.js        Guarded localStorage for player settings
```

## Visual direction

- Dark stone masonry, mortar, bevels and moss replace the earlier neon outline walls.
- Cobbled streets, drifting fog, moonlight, a cold vignette and warm flickering gas lamps build the Victorian village atmosphere.
- All six characters are drawn as cached pixel-art sprites on a 32×32 design grid and scaled with image smoothing disabled:
  - **Victor** — navy frock coat, white cravat, spectacles and a faint green vial.
  - **The Creature** — taller and broader, with green skin, stitched chest and face, bolts and amber eyes.
  - **William** — small flat cap, red scarf and a lantern.
  - **Justine** — slate dress with a white apron and cap.
  - **Henry** — brown coat, green waistcoat and pocket watch.
  - **Elizabeth** — burgundy gown, shawl, long auburn hair and a gold locket.
- Victor and the Creature have four-direction walk cycles. Right-facing frames mirror the left-facing drawings.
- Successful touches spawn a gold ring-and-spark burst; the final capture is larger. Losing a life flashes a red edge vignette and shakes the HUD life counter while the spent diamond pulses.
- The portrait cast is available in the instructions modal, keeping the main HUD uncluttered.

## The village level

- The Creature wants **William**, who stands at the village square tile `(17, 7)`. The Creature is a level-specific `StoryCreature` that follows the shortest walkable route to him.
- Victor must spend all three of the Creature's lives first.
- **If the Creature reaches William first:** William dies. Justine Moritz is later executed after being falsely accused of his murder. Justine is **not** physically killed by the Creature.
- **If Victor catches the Creature first:** William survives and Justine is never accused.
- If the timer expires, the Creature finds William and the same tragedy follows.
- The result overlay gives the short outcome, the recorded time and the star rating, with a **Restart** button.

The story layer lives in `js/story.js` and holds William's location, reach detection and outcome text. It does not contain movement, collision, timer or base-AI code.

## Timer and scoring

| Difficulty | Time limit | 3 stars | 2 stars |
| ---------- | ---------- | ------- | ------- |
| Easy       | 120 s      | ≤ 60 s  | ≤ 95 s  |
| Normal     | 90 s       | ≤ 40 s  | ≤ 70 s  |
| Hard       | 60 s       | ≤ 25 s  | ≤ 45 s  |

- The clock starts when the run begins and is displayed in the stage HUD.
- `P` pauses the run; the timer banks its elapsed time and only resumes when you do.
- The timer stops on either ending.
- Victories record `game.lastResult` with the exact elapsed milliseconds, star count and story ending.
- Timing uses `performance.now()` timestamps rather than accumulated frame deltas.

## Capture loop

- Victor is invulnerable; the Creature owns the lives.
- The Creature starts each wave with **3 lives** (`CREATURE_RULES.lives`).
- Touching it removes one life, resets it to `CREATURE_SPAWN`, and grants **2 seconds** of invulnerability.
- Collisions are distance checks in tile units (`CREATURE_RULES.hitDistance`). A successful hit sets invulnerability before the next frame, so one overlap cannot drain multiple lives.
- The base Creature's `wander`, `evade` and `outwit` strategies remain in `creature.js`; the village level uses the goal-seeking `StoryCreature` subclass instead.

## Run locally

ES modules cannot load over `file://`, so serve the folder over HTTP:

```bash
python -m http.server 8080
```

Then open the local URL printed by the server (normally port 8080). Append `?debug=1` to expose `window.__FRANKENSTEIN_GAME__` for automated checks.

## Deploy to GitHub Pages

1. Push the repository to GitHub.
2. Open **Settings → Pages**.
3. Choose **Deploy from a branch**, then select `main` and `/ (root)`.
4. Save, wait for the Pages build, then open `https://<username>.github.io/<repository>/`.

The game is already a static site: all HTML, CSS, JavaScript, sprites and the favicon use relative or inline paths. There is no build step, no server-side code, no API keys and no external service dependency.

The `python -m http.server` command above is only a local preview because ES modules cannot load from `file://`. GitHub Pages serves the same files directly; the deployed game requires no local server.

## Controls

| Key                   | Action                        |
| --------------------- | ----------------------------- |
| `W` `A` `S` `D`       | Move Victor                   |
| `↑` `↓` `←` `→`       | Move Victor                   |
| `P`                   | Pause / resume the timer      |
| `Esc`                 | Leave the maze / close dialog |
| `Enter`               | Start from the menu           |

## Next build

- Final animation polish and additional gothic set dressing
- Additional story levels, if requested
