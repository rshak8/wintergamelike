// Лекарь: не атакует, прячется от героя поближе к союзникам и лечит раненых.
// Отравленных лечить не может («NO HEAL») — поэтому против него хорош кинжал.
import { audio } from '../audio/audio';
import { TEX } from '../fx/textures';
import { rand, angleTo } from '../utils';
import type { Brain } from './helpers';
import type { Enemy } from './enemy';

export const healer: Brain = (self, dt) => {
  const { game } = self, hero = self.player, rig = self.rig!, fx = game.fx;
  self.stateTime += dt; self.cooldown -= dt;
  switch (self.state) {
    case 'idle': case 'flee': {
      self.repathTimer -= dt;
      if (!self.goal || self.repathTimer <= 0) { self.goal = hideSpot(self); self.repathTimer = rand(0.8, 1.4); }
      if (self.pos.distanceTo(self.goal) > 0.35) self.walkTo(self.goal, self.def.speed, dt);
      else self.turnTowards(angleTo(self.pos, hero.pos), dt, 5);
      if (self.cooldown <= 0) {
        const allies = game.enemies.filter((o) => o !== self && !o.dead && !o.spawning && o.hp < o.maxHp && o.pos.distanceTo(self.pos) < 8.5);
        if (allies.length) {
          self.setState('channel'); rig.hold('channel'); self.healTargets = allies;
          self.telegraph = fx.decal(self.pos, { tex: TEX.spawn, size: 2.2, color: 0x5aff9a, life: 0.9, fadeIn: 0.1, grow: 0.2 });
        } else self.cooldown = 0.5;
      }
      break;
    }
    case 'channel': { // руки вверх, зелёные искры, через 0.8 с лучи лечения
      self.moveSpeed = 0;
      if (Math.random() < dt * 40) fx.burst({ x: self.pos.x + rand(-0.4, 0.4), y: 0.1, z: self.pos.z + rand(-0.4, 0.4) }, { count: 1, color: 0x6aff9a, speed: 0.2, life: 0.6, size: 0.22, gravity: -3, up: 1 });
      if (self.stateTime > 0.8) {
        self.telegraph = null; audio.play('heal');
        const from = self.pos.clone(); from.y = 1.1;
        for (const o of self.healTargets) {
          if (o.dead) continue;
          const to = o.pos.clone(); to.y = 0.7;
          if (o.status.poison > 0) {
            fx.bolt([from, to], { color: 0x5a7a5a, life: 0.25, width: 0.08, jag: 0.15 });
            fx.text({ x: o.pos.x, y: 1.4, z: o.pos.z }, 'NO HEAL', { color: '#7aff5a', size: 12 });
            audio.play('healBlocked');
            continue;
          }
          fx.bolt([from, to], { color: 0x5aff9a, life: 0.35, width: 0.12, jag: 0.12 });
          const amount = Math.min(self.def.heal!, o.maxHp - o.hp);
          o.hp += amount;
          fx.text({ x: o.pos.x, y: 1.4, z: o.pos.z }, '+' + Math.round(amount), { color: '#5aff9a', size: 15 });
          fx.burst({ x: o.pos.x, y: 0.6, z: o.pos.z }, { count: 10, color: 0x5aff9a, speed: 1.2, life: 0.6, size: 0.2, gravity: -2, up: 1.5 });
        }
        self.setState('flee'); self.cooldown = self.def.healEvery!;
      }
      break;
    }
    default: self.setState('flee');
  }
};

/** Укрытие: подальше от героя (лучше — за стеной), но рядом с союзниками, чтобы лечение доставало. */
function hideSpot(self: Enemy) {
  const { game } = self, hero = self.player;
  const cells = game.world.floorCells(self.room);
  let best = self.pos.clone(), bestScore = -1e9;
  for (let i = 0; i < 26; i++) {
    const c = cells[(Math.random() * cells.length) | 0];
    const dHero = c.distanceTo(hero.pos);
    let score = Math.min(dHero, 8) * 1.2 - c.distanceTo(self.pos) * 0.35;
    if (!game.world.hasLineOfSight(c, hero.pos)) score += 6;
    if (dHero < 3) score -= 10;
    let near = 0; for (const o of game.enemies) if (o !== self && !o.dead && o.pos.distanceTo(c) < 7) near++;
    score += Math.min(near, 2);
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}
