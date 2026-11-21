# FRANKENSTEIN

A 2D maze arcade game for the browser, built with HTML Canvas, CSS and vanilla JavaScript modules. No framework, no build step, no backend, no external services.

Inspired by Mary Shelley's *Frankenstein*.

**Live:** https://hahuyphananh.github.io/frankenstein-game/

**Status: one playable story level.** The Creature stalks a Victorian village while Victor tries to catch it. Elizabeth moves through the looping streets, fleeing whenever the Creature gets close. Catch the Creature before it reaches her, and Elizabeth and Justine are safe. Fail, and the novel's tragedy follows.

## Project structure

```text
index.html          Menu, HUD, pause overlay, result overlay, instructions
css/
  base.css          Design tokens, reset, app layers, shared buttons
  menu.css          Menu, HUD, overlays, cast, modal, immersive map layout
js/
  main.js           Boot: composes settings, audio, input, renderer, game
  config.js         Settings, difficulty tuning, dash cooldowns, capture rules
  maze.js           Looped 25x15 layout, tile updates, corners and spawns
  camera.js         Fit-all camera that scales the maze to any viewport
  actor.js          Shared grid-aware, collision-safe movement
  player.js         Victor's movement controller and buffered turns
  creature.js       Creature AI, dash, wall-break grants and corner respawns
  story.js          Moving Elizabeth, story outcomes and the goal-seeking Creature
  pathing.js        BFS distance fields and escape-route lookahead
  timer.js          Wall-clock countdown, star scoring, clock formatting
  sprites.js        Pixel-art cast, directional frames and cast portraits
  renderer.js       Canvas: cobbled maze, gaslight, actors, dash and hit effects
  loop.js           Shared requestAnimationFrame loop with clamped delta
  game.js           State machine, timer/lives loop, pause and results
  menu.js           DOM controller for screens, HUD, overlays and cast
  audio.js          Synthesised UI, hit, wall-break, victory and defeat sounds
  input.js          Keyboard state + WASD/arrow mapping
  storage.js        Guarded localStorage for player settings
```

## Visual direction

- Clear warm-grey cobbled streets contrast against dark, raised stone blocks with bright cap edges and deep shadows.
- Drifting fog, moonlight, a cold vignette and flickering gas lamps build the Victorian village atmosphere.
- Five characters are drawn as cached pixel-art sprites on a 32×32 design grid and scaled with image smoothing disabled:
  - **Victor** — ivory laboratory coat with lapels, breast pocket, pencils, dark trousers and spectacles.
  - **The Creature** — taller and broader, with green skin, stitched chest and face, bolts and amber eyes.
  - **Justine** — slate dress with a white apron and cap.
  - **Henry** — brown coat, green waistcoat and pocket watch.
  - **Elizabeth** — burgundy gown, shawl, long auburn hair and a gold locket.
- Victor, the Creature and Elizabeth have directional walk cycles. Right-facing frames mirror the left-facing drawings.
- A dash draws speed ghosts and an ember ring around the Creature. Hard-mode wall breaks throw stone chips and rebuild the street around the new opening.
- Successful touches spawn a gold ring-and-spark burst; the final capture is larger. Losing a life flashes a red edge vignette and shakes the HUD life counter.

## The village level

- The maze is a 25×15 grid of separated stone blocks. Every block has a one-tile street around it, producing many looping routes instead of a single solution path.
- **Elizabeth** starts at `(12, 4)`, moves at `1.1` tiles per second and wanders the streets. When the Creature gets within `5.5` tiles, she uses a BFS field to choose the direction with the most walkable distance behind her.
- The Creature is a level-specific `StoryCreature` that follows Elizabeth's current tile. With several routes around each block, it can circle the village while closing in.
- Victor must spend all three of the Creature's lives.
- **If the Creature reaches Elizabeth first:** Elizabeth dies. Justine Moritz is later executed after being falsely accused of her murder. Justine is **not** physically killed by the Creature.
- **If Victor catches the Creature first:** Elizabeth survives and Justine is never accused.
- If the timer expires, the Creature finds Elizabeth and the same tragedy follows.
- The result overlay gives the outcome, recorded time and star rating, with a **Restart** button.

The story layer lives in `js/story.js` and holds Elizabeth's movement, the outcome text and the goal-seeking Creature. Movement, collision and the timer remain in their own modules.

## Creature powers

| Difficulty | Time limit | Dash cooldown | Hard-mode walls |
| ---------- | ---------- | ------------- | --------------- |
| Easy       | 120 s      | 14 s          | No              |
| Normal     | 90 s       | **10 s**      | No              |
| Hard       | 60 s       | 8 s           | One wall per dash |

- The Creature automatically dashes when Elizabeth is within dash range and the cooldown is ready. Its movement speed temporarily increases, leaving speed ghosts behind.
- On Hard, each dash can shatter one adjacent wall. The new opening remains for the rest of the run, and all pathing caches are rebuilt.
- Restart restores every broken wall and starts all actors fresh.
- When caught, the Creature respawns in a random unused corner: `(1,1)`, `(23,1)`, `(1,13)` or `(23,13)`. Each of its three lives uses a different corner, and the previous position is never reused while alternatives exist.

## Full-screen map

- The stage opens in an immersive viewport layout by default, using the full browser window with a compact HUD overlay.
- Use the **Windowed** button in the HUD, or press `F`, to switch to the smaller framed stage. The button then reads **Fullscreen**; the choice is stored with the other settings.
- On narrow screens the compact HUD avoids the maze and the stage bar is hidden, leaving the streets uninterrupted.

## Timer and scoring

| Difficulty | Time limit | 3 stars | 2 stars |
| ---------- | ---------- | ------- | ------- |
| Easy       | 120 s      | ≤ 60 s  | ≤ 95 s  |
| Normal     | 90 s       | ≤ 40 s  | ≤ 70 s  |
| Hard       | 60 s       | ≤ 25 s  | ≤ 45 s  |

- The clock starts when the run begins and is displayed in the stage HUD.
- `P` pauses the run; the timer banks its elapsed time and resumes only when you do.
- The timer stops on either ending.
- Victories record `game.lastResult` with the exact elapsed milliseconds, star count and story ending.
- Timing uses `performance.now()` timestamps rather than accumulated frame deltas.

## Capture loop

- Victor is invulnerable; the Creature owns the lives.
- The Creature starts each wave with **3 lives** (`CREATURE_RULES.lives`).
- Touching it removes one life, teleports it to a different corner, and grants **2 seconds** of invulnerability.
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

## Controls

| Key                   | Action                             |
| --------------------- | ---------------------------------- |
| `W` `A` `S` `D`       | Move Victor                        |
| `↑` `↓` `←` `→`       | Move Victor                        |
| `P`                   | Pause / resume the timer           |
| `F`                   | Toggle full-screen / windowed map  |
| `Esc`                 | Leave the maze / close dialog      |
| `Enter`               | Start from the menu                |

## Next build

- Final animation polish and additional gothic set dressing
- Additional story levels, if requested
