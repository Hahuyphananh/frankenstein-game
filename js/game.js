import {
  CREATURE_RULES,
  DIFFICULTIES,
  PLAYER_CREATURE_PROFILE,
  VICTOR_POWERS,
  isDifficulty,
} from './config.js';
import { directionForKey } from './input.js';
import { GameLoop } from './loop.js';
import {
  CORNER_SPAWNS,
  TILE,
  chooseHuntStartPositions,
  generateMazeLayout,
  restoreMaze,
} from './maze.js';
import { MenuView } from './menu.js';
import {
  PlayerCreature,
  STORY_RULES,
  StoryLevel,
  pickProtectedCharacter,
} from './story.js';
import { VictorHunter } from './victor.js';

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

    this.view = new MenuView({
      onPlay: () => this.play(),
      onPlayAgain: () => this.restart(),
      onBack: () => this.backToMenu(),
      onResume: () => this.resume(),
      onDifficulty: (id) => this.setDifficulty(id),
      onSound: () => this.toggleSound(),
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
    this.view.showScreen('menu');
    this.renderer.setScreen('menu');
    this.keyboard.onKeyDown((event) => this.handleKey(event));
    this.loop.start();
  }

  update(dt) {
    this.renderer.update(dt);
    if (this.screen !== 'stage' || this.stageStatus !== 'playing') return;
    if (!this.player || !this.creature) return;

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

    this.screen = 'stage';
    this.startRun();
    this.view.showScreen('stage');
    this.renderer.setScreen('stage');
    this.audio.play('confirm');
  }

  /** Create a fresh run: new village, new actors, full dash charge. */
  startRun() {
    const difficulty = DIFFICULTIES[this.settings.difficulty] ?? DIFFICULTIES.normal;

    // Every run rebuilds the village, keeping multiple entrances and routes.
    restoreMaze(this.maze, generateMazeLayout());
    this.renderer.refreshMaze();
    this.currentDifficulty = difficulty;
    this.stageStatus = 'playing';
    this.warningPlayed = false;

    const starts = chooseHuntStartPositions(this.maze, { previous: this.lastStarts });
    this.lastStarts = starts;

    this.player = new VictorHunter({
      maze: this.maze,
      spawn: starts.victor,
      speed: difficulty.victorSpeed,
      surgeSpeed: difficulty.victorSurgeSpeed,
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
    this.view.setStage(this.story.protectedCharacter);
    this.syncCreaturePower();
    this.syncVictorPower();
    this.renderer.setPlayer(this.player);
    this.renderer.setCreature(this.creature);
    this.renderer.setStory(this.story);
  }

  restart() {
    if (this.screen !== 'stage') return;
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

  /** Keep Victor's rage countdown visible, since it is the main threat. */
  syncVictorPower() {
    const victor = this.player;
    if (!victor) return;

    // A single alarm sounds when the wind-up begins; the HUD keeps pulsing
    // until the surge actually fires.
    if (victor.warning && !this.warningPlayed) {
      this.warningPlayed = true;
      this.audio.play('alarm');
    } else if (!victor.warning) {
      this.warningPlayed = false;
    }

    this.view.setVictorPower({
      warning: victor.warning,
      windup: victor.windupFor,
      surging: victor.surging,
      remaining: victor.surgeRemaining,
      cooldown: victor.powerCooldown,
      interval: victor.powerInterval,
      duration: victor.powerDuration,
      power: VICTOR_POWERS[victor.activePower] ?? VICTOR_POWERS.rage,
      next: VICTOR_POWERS[victor.nextPower] ?? null,
    });
  }

  pause() {
    if (this.stageStatus !== 'playing') return;

    this.stageStatus = 'paused';
    this.freezeActors();
    this.view.showPause();
    this.audio.play('open');
  }

  resume() {
    if (this.stageStatus !== 'paused') return;

    this.stageStatus = 'playing';
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
    const story = this.story?.resolve(ending) ?? null;

    this.freezeActors();
    if (!won) {
      this.renderer.catchEffect(this.creature.x, this.creature.y, { final: true });
      this.renderer.lifeLost();
    }

    this.lastResult = {
      outcome: won ? 'won' : 'lost',
      difficulty: this.currentDifficulty.id,
      cause: ending,
      story: story?.ending ?? null,
    };
    this.view.showStageResult({ outcome: won ? 'won' : 'lost', story });
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
