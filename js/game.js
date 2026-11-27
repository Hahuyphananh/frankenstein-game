import {
  CREATURE_RULES,
  DEFAULT_PLAYER_NAME,
  DIFFICULTIES,
  PLAYER_CREATURE_PROFILE,
  VICTOR_POWERS,
  isDifficulty,
} from './config.js';
import { directionForKey } from './input.js';
import { GameLoop } from './loop.js';
import {
  CORNER_SPAWNS,
  MAP_POOL,
  TILE,
  chooseHuntStartPositions,
  restoreMaze,
} from './maze.js';
import { MenuView } from './menu.js';
import { RunTimer } from './timer.js';
import {
  fastestTimeForDifficulty,
  loadLeaderboard,
  loadPlayerName,
  recordLeaderboardRun,
  savePlayerName,
} from './storage.js';
import {
  PlayerCreature,
  STORY_RULES,
  StoryLevel,
  pickProtectedCharacter,
} from './story.js';
import { VictorHunter } from './victor.js';

/** Start-of-run countdown shown over the board before the clock starts. */
const COUNTDOWN_SECONDS = 5;

/**
 * Application state machine. Owns the menu ⇄ stage transition, actors, the
 * pause state and results. The player is the Creature; Victor is AI.
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
    this.lastResult = null;
    this.lastStarts = null;
    this.warningPlayed = false;
    this.countdownRemaining = 0;
    this.countdownShown = 0;
    this.runTimer = new RunTimer();
    this.playerName = loadPlayerName();
    this.bestTimeMs = null;
    this.mapIndex = 0;
    this.currentMap = null;

    this.view = new MenuView({
      onPlay: () => this.play(),
      onPlayAgain: () => this.restart(),
      onBack: () => this.backToMenu(),
      onResume: () => this.resume(),
      onDifficulty: (id) => this.setDifficulty(id),
      onSound: () => this.toggleSound(),
      onInstructions: () => this.openInstructions(),
      onInstructionsClosed: () => this.audio.play('close'),
      onLeaderboard: () => this.openLeaderboard(),
      onLeaderboardClosed: () => this.audio.play('close'),
      onNameSubmit: (name) => this.submitPlayerName(name),
    });

    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: () => this.renderer.draw(),
    });
  }

  init() {
    this.view.applySettings(this.settings);
    this.view.showScreen('menu');
    this.renderer.setScreen('menu');
    this.keyboard.onKeyDown((event) => this.handleKey(event));
    this.loop.start();
  }

  update(dt) {
    this.renderer.update(dt);
    if (this.screen !== 'stage') return;

    // Five-second start countdown: the board is visible, the actors stay put
    // and the run clock has not started yet.
    if (this.stageStatus === 'countdown') {
      this.countdownRemaining = Math.max(0, this.countdownRemaining - dt);
      const shown = Math.ceil(this.countdownRemaining);
      if (shown > 0 && shown !== this.countdownShown) {
        this.countdownShown = shown;
        this.view.showCountdown(shown);
      }
      if (this.countdownRemaining <= 0) this.beginPlay();
      return;
    }

    if (this.stageStatus !== 'playing') return;
    if (!this.player || !this.creature) return;

    this.view.setRunTime(this.runTimer.elapsed(), this.bestTimeMs);
    const creature = this.creature;

    // Victor hunts the Creature; the Creature responds to player input and
    // the protected person flees from the Creature.
    this.player.update(dt, { goal: creature, protect: this.story?.elizabeth ?? null });
    creature.update(dt);
    this.story?.update(dt, { creature });
    this.syncCreaturePower();
    this.syncVictorPower();

    // Reaching the protected person wins before a same-frame catch.
    if (this.story?.creatureReachedElizabeth(creature)) {
      this.endRun('won', 'creatureWin');
      return;
    }
    if (creature.touches(this.player)) this.endRun('lost', 'creatureCaught');
  }

  play() {
    if (this.screen === 'stage') return;
    if (!this.playerName) {
      this.view.showNamePrompt();
      this.audio.play('open');
      return;
    }
    this.startGame();
  }

  startGame() {
    this.screen = 'stage';
    this.startRun();
    this.view.showScreen('stage');
    this.renderer.setScreen('stage');
    this.audio.play('confirm');
  }

  submitPlayerName(value) {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) {
      this.view.showNameError('Entrez un nom pour commencer.');
      return;
    }
    this.playerName = savePlayerName(raw);
    this.view.hideNamePrompt();
    this.startGame();
  }

  /** Create a fresh run: next stable village, new actors, full dash charge. */
  startRun() {
    const difficulty = DIFFICULTIES[this.settings.difficulty] ?? DIFFICULTIES.normal;

    // Cycle through eight pre-generated villages. They stay identical between
    // reloads, so a local fastest time can be compared with the same maps.
    const map = MAP_POOL[this.mapIndex % MAP_POOL.length];
    this.mapIndex = (this.mapIndex + 1) % MAP_POOL.length;
    this.currentMap = map;
    restoreMaze(this.maze, map.layout);
    this.renderer.refreshMaze();
    this.currentDifficulty = difficulty;
    this.stageStatus = 'countdown';
    this.warningPlayed = false;

    const starts = chooseHuntStartPositions(this.maze, { previous: this.lastStarts });
    this.lastStarts = starts;

    this.player = new VictorHunter({
      maze: this.maze,
      spawn: starts.victor,
      speed: difficulty.victorSpeed,
      surgeSpeed: difficulty.victorSurgeSpeed,
      power: { duration: difficulty.victorPowerDuration },
      onBlink: (from, to) => this.renderer.blinkEffect(from, to),
    });
    this.creature = new PlayerCreature({
      maze: this.maze,
      spawn: starts.creature,
      spawnPoints: CORNER_SPAWNS,
      profile: { ...PLAYER_CREATURE_PROFILE, speed: difficulty.creatureSpeed },
      rules: CREATURE_RULES,
      onWallBreak: (wall) => this.wallBroken(wall),
    });
    this.story = new StoryLevel({
      maze: this.maze,
      elizabeth: starts.elizabeth,
      protectedCharacter: pickProtectedCharacter(),
      rules: { ...STORY_RULES, elizabethSpeed: difficulty.elizabethSpeed },
    });

    this.view.hidePause();
    this.view.hideStageResult();
    this.view.setStage(this.story.protectedCharacter, difficulty);
    this.syncCreaturePower();
    this.syncVictorPower();
    this.renderer.setPlayer(this.player);
    this.renderer.setCreature(this.creature);
    this.renderer.setStory(this.story);
    this.bestTimeMs = fastestTimeForDifficulty(loadLeaderboard(), difficulty.id);
    this.runTimer.reset();
    this.view.setRunTime(0, this.bestTimeMs);
    this.beginCountdown();
  }

  /** Show the five-second warning; the clock starts when it reaches zero. */
  beginCountdown() {
    this.countdownRemaining = COUNTDOWN_SECONDS;
    this.countdownShown = COUNTDOWN_SECONDS;
    this.view.showCountdown(COUNTDOWN_SECONDS);
  }

  beginPlay() {
    this.stageStatus = 'playing';
    this.countdownRemaining = 0;
    this.view.hideCountdown();
    this.runTimer.start();
    this.view.setRunTime(0, this.bestTimeMs);
    this.audio.play('move');
  }

  restart() {
    if (this.screen !== 'stage') return;
    if (!this.playerName) {
      this.backToMenu();
      this.play();
      return;
    }
    this.startRun();
    this.audio.play('confirm');
  }

  /** Keep the dash meter in the stage HUD. */
  syncCreaturePower() {
    const creature = this.creature;
    if (!creature) return;
    this.view.setCreaturePower({
      enabled: Boolean(creature.profile.dashCooldown),
      cooldown: creature.dashCooldownRemaining,
      limit: creature.profile.dashCooldown ?? 0,
      dashing: creature.dashing,
    });
  }

  /** Keep Victor's active power and its remaining phase visible. */
  syncVictorPower() {
    const victor = this.player;
    if (!victor) return;

    this.view.setVictorPower({
      warning: victor.warning,
      windup: victor.windupFor,
      surging: victor.surging,
      remaining: victor.surgeRemaining,
      cooldown: victor.powerCooldown,
      interval: victor.powerInterval,
      duration: victor.activePowerDuration,
      speed: victor.speed,
      power: VICTOR_POWERS[victor.activePower] ?? VICTOR_POWERS.rage,
      next: VICTOR_POWERS[victor.nextPower] ?? null,
    });
  }

  pause() {
    if (this.stageStatus !== 'playing') return;

    this.stageStatus = 'paused';
    this.runTimer.pause();
    this.view.setRunTime(this.runTimer.elapsed(), this.bestTimeMs);
    this.freezeActors();
    this.view.showPause();
    this.audio.play('open');
  }

  resume() {
    if (this.stageStatus !== 'paused') return;

    this.stageStatus = 'playing';
    this.runTimer.resume();
    this.view.hidePause();
    this.audio.play('close');
  }

  togglePause() {
    if (this.stageStatus === 'playing') this.pause();
    else if (this.stageStatus === 'paused') this.resume();
  }

  /** Resolve the run from the Creature's point of view. */
  endRun(outcome, ending = 'creatureCaught') {
    if (this.stageStatus !== 'playing') return;

    const won = outcome === 'won';
    this.stageStatus = won ? 'won' : 'lost';
    const timeMs = Math.max(10, Math.round(this.runTimer.stop() / 10) * 10);
    this.view.setRunTime(timeMs, this.bestTimeMs);
    const story = this.story?.resolve(ending) ?? null;

    this.freezeActors();
    if (!won) {
      this.renderer.catchEffect(this.creature.x, this.creature.y, { final: true });
      this.renderer.lifeLost();
    }

    let record = null;
    if (won) {
      const character = this.story?.protectedCharacter;
      const run = {
        name: this.playerName ?? DEFAULT_PLAYER_NAME,
        difficulty: this.currentDifficulty.id,
        timeMs,
        characterId: character?.id ?? '',
        characterName: character?.name ?? '',
        mapId: this.currentMap?.id ?? '',
        mapLabel: this.currentMap?.label ?? '',
        at: new Date().toISOString(),
      };
      record = recordLeaderboardRun(run);
    }

    this.lastResult = {
      outcome: won ? 'won' : 'lost',
      difficulty: this.currentDifficulty.id,
      cause: ending,
      story: story?.ending ?? null,
      timeMs,
      mapId: this.currentMap?.id ?? null,
      record,
    };
    this.view.showStageResult({
      outcome: won ? 'won' : 'lost',
      story,
      timeMs,
      record,
      mapLabel: this.currentMap?.label ?? '',
    });
    this.audio.play(won ? 'win' : 'lose');
  }

  freezeActors() {
    if (this.player) this.player.moving = false;
    if (this.creature) this.creature.moving = false;
    if (this.story?.elizabeth) this.story.elizabeth.moving = false;
  }

  /** Terrain changed; refresh the layers and the cached BFS fields. */
  wallBroken(wall) {
    this.maze.tiles[wall.row][wall.col] = TILE.EMPTY;
    this.renderer.refreshMaze();
    this.renderer.wallBreakEffect(wall.col, wall.row);
    this.creature?.invalidatePathing();
    this.player?.invalidatePathing();
    this.story?.invalidatePathing();
    this.audio.play('shatter');
  }

  backToMenu() {
    if (this.screen === 'menu') return;

    this.screen = 'menu';
    this.stageStatus = 'idle';
    this.runTimer.stop();
    this.currentMap = null;
    this.player = null;
    this.creature = null;
    this.story = null;
    this.currentDifficulty = null;
    this.renderer.setPlayer(null);
    this.renderer.setCreature(null);
    this.renderer.setStory(null);
    this.countdownRemaining = 0;
    this.view.hideCountdown();
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

  openInstructions() {
    this.audio.play('open');
    this.view.openInstructions();
  }

  openLeaderboard() {
    this.audio.play('open');
    this.view.showLeaderboard(loadLeaderboard());
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

      if (event.key === 'Escape') {
        event.preventDefault();
        this.backToMenu();
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        if (this.stageStatus === 'playing') this.creature?.requestDash();
        return;
      }

      const direction = directionForKey(event.code);
      if (direction) {
        event.preventDefault();
        if (this.stageStatus === 'playing') this.creature?.requestDirection(direction);
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
