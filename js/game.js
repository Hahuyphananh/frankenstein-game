import { CREATURE_RULES, DIFFICULTIES, isDifficulty } from './config.js';
import { directionForKey } from './input.js';
import { GameLoop } from './loop.js';
import { CORNER_SPAWNS, TILE, chooseStartPositions, restoreMaze } from './maze.js';
import { MenuView } from './menu.js';
import { Player } from './player.js';
import { StoryCreature, StoryLevel } from './story.js';
import { CountdownTimer, starsForTime } from './timer.js';

/**
 * Application state machine. Owns the menu ⇄ stage transition, actors, the
 * countdown/collision/lives loop, pause state and results.
 */
export class Game {
  constructor({ settings, audio, renderer, keyboard, maze, persist }) {
    this.settings = settings;
    this.audio = audio;
    this.renderer = renderer;
    this.keyboard = keyboard;
    this.maze = maze;
    this.persist = persist;
    this.screen = 'menu';
    this.stageStatus = 'idle';
    this.player = null;
    this.creature = null;
    this.story = null;
    this.currentDifficulty = null;
    this.timer = null;
    this.displayedSecond = null;
    this.lastResult = null;
    this.lastStarts = null;

    this.view = new MenuView({
      onPlay: () => this.play(),
      onPlayAgain: () => this.restart(),
      onBack: () => this.backToMenu(),
      onResume: () => this.resume(),
      onDifficulty: (id) => this.setDifficulty(id),
      onSound: () => this.toggleSound(),
      onMapLayout: () => this.toggleMapLayout(),
      onInstructions: () => this.openInstructions(),
      onInstructionsClosed: () => this.audio.play('close'),
    });

    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: () => this.renderer.draw(),
    });
  }

  init() {
    this.view.applySettings(this.settings);
    this.renderer.setMapLayout(this.settings.mapLayout);
    this.view.showScreen('menu');
    this.renderer.setScreen('menu');
    this.keyboard.onKeyDown((event) => this.handleKey(event));
    this.loop.start();
  }

  update(dt) {
    this.renderer.update(dt);
    if (this.screen !== 'stage' || this.stageStatus !== 'playing') return;
    if (!this.player || !this.creature || !this.timer) return;

    const now = performance.now();
    this.syncTimer(now);

    if (this.timer.remaining(now) <= 0) {
      this.loseLevel(now);
      return;
    }

    this.player.update(dt);
    this.story?.update(dt, { creature: this.creature });
    this.creature.update(dt, { victor: this.player, goal: this.story?.goal });
    this.syncCreaturePower();

    // The Creature's arrival at Elizabeth resolves before a same-frame catch.
    if (this.story?.creatureReachedElizabeth(this.creature)) {
      this.loseLevel(now, 'elizabeth');
      return;
    }

    this.checkCollision(now);
  }

  play() {
    if (this.screen === 'stage') return;

    this.screen = 'stage';
    this.startRun();
    this.view.showScreen('stage');
    this.renderer.setScreen('stage');
    this.audio.play('confirm');
  }

  /** Create a fresh run: new actors, full lives, fresh countdown. */
  startRun() {
    const difficulty = DIFFICULTIES[this.settings.difficulty] ?? DIFFICULTIES.normal;

    restoreMaze(this.maze);
    this.renderer.refreshMaze();
    this.currentDifficulty = difficulty;
    this.stageStatus = 'playing';
    const starts = chooseStartPositions(this.maze, { previous: this.lastStarts });
    this.lastStarts = starts;
    this.player = new Player({
      maze: this.maze,
      spawn: starts.victor,
      speed: difficulty.playerSpeed,
    });
    this.story = new StoryLevel({ maze: this.maze, elizabeth: starts.elizabeth });
    this.creature = new StoryCreature({
      maze: this.maze,
      spawn: starts.creature,
      spawnPoints: CORNER_SPAWNS,
      profile: difficulty.creature,
      rules: CREATURE_RULES,
      onWallBreak: (wall) => this.wallBroken(wall),
    });
    this.timer = new CountdownTimer({ limitSeconds: difficulty.timeLimit });
    this.timer.start(performance.now());
    this.displayedSecond = difficulty.timeLimit;

    this.view.hidePause();
    this.view.hideStageResult();
    this.view.setTimer(difficulty.timeLimit, difficulty.timeLimit);
    this.view.setCreatureLives(this.creature.lives, this.creature.maxLives);
    this.syncCreaturePower();
    this.renderer.setPlayer(this.player);
    this.renderer.setCreature(this.creature);
    this.renderer.setStory(this.story);
  }

  restart() {
    if (this.screen !== 'stage') return;
    this.startRun();
    this.audio.play('confirm');
  }

  /** Keep the dash meter and Hard wall-break state in the stage HUD. */
  syncCreaturePower() {
    const creature = this.creature;
    if (!creature) return;
    this.view.setCreaturePower({
      cooldown: creature.dashCooldownRemaining,
      limit: creature.profile.dashCooldown ?? 0,
      dashing: creature.dashing,
      canBreakWalls: Boolean(creature.profile.destroyWalls),
      wallBreakAvailable: creature.wallBreakAvailable,
      wallBreakPerLife: Boolean(creature.profile.wallBreakPerLife),
    });
  }

  /** Now = timestamp; keeps the visual clock and expiry check in sync. */
  syncTimer(now) {
    if (!this.timer || !this.currentDifficulty) return;
    const seconds = this.timer.remainingSeconds(now);
    if (seconds === this.displayedSecond) return;

    this.displayedSecond = seconds;
    this.view.setTimer(seconds, this.currentDifficulty.timeLimit);
  }

  pause() {
    if (this.stageStatus !== 'playing') return;

    this.stageStatus = 'paused';
    this.timer.pause(performance.now());
    this.freezeActors();
    this.view.showPause();
    this.audio.play('open');
  }

  resume() {
    if (this.stageStatus !== 'paused') return;

    this.timer.resume(performance.now());
    this.stageStatus = 'playing';
    this.view.hidePause();
    this.audio.play('close');
  }

  togglePause() {
    if (this.stageStatus === 'playing') this.pause();
    else if (this.stageStatus === 'paused') this.resume();
  }

  /**
   * Victor is invulnerable; touching the Creature costs it one life. `hit()`
   * sets respawn protection immediately, so continuous overlap cannot drain
   * multiple lives from a single collision.
   */
  checkCollision(now) {
    const creature = this.creature;
    if (!creature || creature.invulnerable || creature.lives <= 0) return;
    if (!creature.touches(this.player)) return;

    const hitX = creature.x;
    const hitY = creature.y;
    if (!creature.hit(this.player)) return;

    const final = creature.lives === 0;
    this.renderer.catchEffect(hitX, hitY, { final });
    this.renderer.lifeLost();
    this.audio.play('hit');
    this.view.setCreatureLives(creature.lives, creature.maxLives);
    this.syncCreaturePower();

    if (creature.lives === 0) this.winLevel(now);
  }

  winLevel(now = performance.now()) {
    if (this.stageStatus !== 'playing') return;

    this.stageStatus = 'won';
    const elapsedMs = this.timer.stop(now);
    const stars = starsForTime(elapsedMs, this.currentDifficulty.starThresholds);
    const story = this.story?.resolve('caught') ?? null;

    this.freezeActors();
    this.syncTimer(now);
    this.lastResult = {
      outcome: 'won',
      difficulty: this.currentDifficulty.id,
      elapsedMs,
      stars,
      story: story?.ending ?? null,
    };
    this.view.showStageResult({ outcome: 'won', elapsedMs, stars, story });
    this.audio.play('win');
  }

  loseLevel(now = performance.now(), ending = 'timeout') {
    if (this.stageStatus !== 'playing') return;

    this.stageStatus = 'lost';
    const elapsedMs = this.timer.stop(now);
    const story = this.story?.resolve(ending) ?? null;

    this.freezeActors();
    this.displayedSecond = 0;
    this.lastResult = {
      outcome: 'lost',
      difficulty: this.currentDifficulty.id,
      elapsedMs,
      stars: 0,
      cause: ending,
      story: story?.ending ?? null,
    };
    this.view.setTimer(0, this.currentDifficulty.timeLimit);
    this.view.showStageResult({ outcome: 'lost', elapsedMs, stars: 0, story });
    this.audio.play('lose');
  }

  freezeActors() {
    if (this.player) this.player.moving = false;
    if (this.creature) this.creature.moving = false;
    if (this.story?.elizabeth) this.story.elizabeth.moving = false;
  }

  /** Hard-mode dash shattered a wall; refresh terrain and all path caches. */
  wallBroken(wall) {
    this.maze.tiles[wall.row][wall.col] = TILE.EMPTY;
    this.renderer.refreshMaze();
    this.renderer.wallBreakEffect(wall.col, wall.row);
    this.creature?.invalidatePathing();
    this.story?.invalidatePathing();
    this.audio.play('shatter');
  }

  backToMenu() {
    if (this.screen === 'menu') return;

    this.timer?.stop(performance.now());
    this.timer = null;
    this.screen = 'menu';
    this.stageStatus = 'idle';
    this.player = null;
    this.creature = null;
    this.story = null;
    this.currentDifficulty = null;
    this.renderer.setPlayer(null);
    this.renderer.setCreature(null);
    this.renderer.setStory(null);
    this.view.hidePause();
    this.view.hideStageResult();
    this.view.showScreen('menu');
    this.renderer.setScreen('menu');
    this.audio.play('back');
  }

  setDifficulty(id) {
    if (!isDifficulty(id) || !DIFFICULTIES[id]) return;
    this.settings.difficulty = id;
    this.view.setDifficulty(id);
    this.audio.play('move');
    this.persist(this.settings);
  }

  toggleSound() {
    this.settings.sound = !this.settings.sound;
    this.audio.setEnabled(this.settings.sound);
    this.view.setSound(this.settings.sound);
    this.persist(this.settings);
    if (this.settings.sound) this.audio.play('toggle');
  }

  /** Full-screen immersive map by default; the button switches to windowed. */
  toggleMapLayout() {
    const layout = this.settings.mapLayout === 'full' ? 'windowed' : 'full';
    this.settings.mapLayout = layout;
    this.view.setMapLayout(layout);
    this.renderer.setMapLayout(layout);
    this.persist(this.settings);
    this.audio.play('move');
  }

  openInstructions() {
    this.audio.play('open');
    this.view.openInstructions();
  }

  handleKey(event) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if (this.view.isDialogOpen()) return;

    if (this.screen === 'stage') {
      if (event.code === 'KeyP') {
        event.preventDefault();
        this.togglePause();
        return;
      }

      if (event.code === 'KeyF') {
        event.preventDefault();
        this.toggleMapLayout();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        this.backToMenu();
        return;
      }

      const direction = directionForKey(event.code);
      if (direction) {
        event.preventDefault();
        if (this.stageStatus === 'playing') this.player?.requestDirection(direction);
      }
      return;
    }

    const target = event.target;
    const onControl =
      target instanceof Element &&
      Boolean(target.closest('button, a, input, select, textarea, [contenteditable]'));

    if (event.key === 'Enter' && !onControl) {
      event.preventDefault();
      this.play();
    }
  }
}
