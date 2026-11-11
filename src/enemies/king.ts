// Король скелетов (босс). Чередует атаки, не повторяя одну и ту же дважды подряд:
//   wave   — веер летящих полумесяцев;
//   nova   — удар об пол вокруг себя + кольцо пуль;
//   charge — рывок с вращением через комнату, в конце кольцо пуль и головокружение;
//   summon — (во второй фазе) призыв двух воинов.
// Ниже половины здоровья впадает в ярость: быстрее, больше полумесяцев и пуль.
import { audio } from '../audio/audio';
import { TEX } from '../fx/textures';
import { rand, angleTo, dirFromAngle } from '../utils';
import { rayLength, muzzle, type Brain } from './helpers';
import type { Enemy } from './enemy';

const TAU = Math.PI * 2;

/** Направления полумесяцев волны: n штук веером вокруг facing. */
function waveAngles(self: Enemy, enraged: boolean) {
  const n = enraged ? 5 : 3, spread = enraged ? 0.95 : 0.6;
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(self.facing + (i - (n - 1) / 2) * (spread / Math.max(1, (n - 1) / 2)) * 0.5);
  return out;
}

/** Кольцо пуль во все стороны. */
function bulletRing(self: Enemy, count: number, speed: number, angleOffset = 0) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + angleOffset;
    const dir = dirFromAngle(a);
    self.game.projectiles.shootEnemy('bullet', muzzle(self, dir, 0.8, 0.5), dir, { speed, dmg: 1 });
  }
}

export const king: Brain = (self, dt, realDt) => {
  const { game } = self, hero = self.player, rig = self.rig!, fx = game.fx;
  const d = self.distToPlayer();
  self.stateTime += dt; self.cooldown -= dt;

  // вторая фаза
  const phase2 = self.hp < self.maxHp * 0.5;
  if (phase2 && !self.enraged) {
    self.enraged = true; self.clearTelegraph(); self.setState('roar'); rig.play('roar'); audio.play('roar');
    fx.shake(0.8); fx.ring(self.pos, { radius: 4, color: 0xff2020, life: 0.6 });
    fx.text({ x: self.pos.x, y: 2.4, z: self.pos.z }, 'ENRAGED!', { color: '#ff3a3a', size: 32, crit: true, life: 1.4 });
    self.shading.rim.value.setRGB(1.2, 0.15, 0.1);
  }
  if (self.enraged && Math.random() < realDt * 20) fx.burst({ x: self.pos.x + rand(-0.5, 0.5), y: rand(0.1, 1.4), z: self.pos.z + rand(-0.5, 0.5) }, { count: 1, color: 0xff2a1a, speed: 0.3, life: 0.6, size: 0.3, gravity: -2.5, up: 0.5 });
  // касание короля ранит
  if (d < self.radius + hero.radius && self.state !== 'roar') hero.hurt(1, self.pos);
  const speedMult = phase2 ? 1.25 : 1;

  switch (self.state) {
    case 'idle': case 'walk': {
      self.walkTo(hero.pos, self.def.speed * speedMult, dt);
      if (d < 1.6) self.moveSpeed = 0;
      if (self.cooldown > 0) break;
      const options = ['wave', 'nova', 'charge'];
      if (phase2 && (!self.lastSummonTime || game.time - self.lastSummonTime > 11)) options.push('summon', 'summon');
      let pick; do { pick = options[(Math.random() * options.length) | 0]; } while (pick === self.lastAttack && options.length > 1);
      self.lastAttack = pick;
      self.facing = angleTo(self.pos, hero.pos);
      if (pick === 'wave') {
        self.setState('teleWave'); rig.hold('windup'); audio.play('telegraph');
        self.telegraphs = waveAngles(self, phase2).map((a) => fx.telegraph({ shape: 'rect', pos: self.pos, dir: dirFromAngle(a), length: 7, width: 0.5, time: 0.65 }));
      } else if (pick === 'nova') {
        self.setState('teleNova'); rig.hold('raise'); audio.play('telegraph');
        self.telegraph = fx.telegraph({ shape: 'circle', pos: self.pos, radius: 2.4, time: 0.75 });
      } else if (pick === 'charge') {
        self.setState('teleCharge'); rig.hold('windup'); audio.play('telegraph');
        self.lockDir = dirFromAngle(self.facing);
        self.chargeLength = Math.min(9, rayLength(game, self.pos, self.lockDir, 10) - 0.6);
        self.telegraph = fx.telegraph({ shape: 'rect', pos: self.pos, dir: self.lockDir, length: self.chargeLength, width: 1.5, time: 0.75 });
      } else {
        self.setState('summon'); rig.hold('raise'); audio.play('roar');
        self.lastSummonTime = game.time;
      }
      break;
    }
    case 'teleWave': {
      self.moveSpeed = 0;
      if (self.stateTime > 0.65) {
        self.telegraphs = null; rig.play('slashE'); audio.play('slashFire');
        fx.slash(self.pos, dirFromAngle(self.facing), { radius: 2.4, inner: 0.5, angle: 2.6, color: 0xff2020, life: 0.25 });
        for (const a of waveAngles(self, phase2)) {
          const dir = dirFromAngle(a);
          game.projectiles.shootEnemy('crescent', muzzle(self, dir, 0.8, 0.5), dir, { speed: 8.5, dmg: 2 });
        }
        fx.shake(0.3);
        self.setState('recover'); self.cooldown = rand(0.9, 1.4) / speedMult;
      }
      break;
    }
    case 'teleNova': {
      self.moveSpeed = 0;
      if (self.stateTime > 0.75) {
        self.telegraph = null; rig.play('stomp'); audio.play('boom');
        fx.shake(0.8); fx.hitstop(50);
        fx.ring(self.pos, { radius: 2.6, color: 0xff3030, life: 0.4 });
        fx.decal(self.pos, { tex: TEX.scorch, size: 4, life: 3, additive: false, opacity: 0.8, rot: Math.random() * 6 });
        fx.burst({ x: self.pos.x, y: 0.1, z: self.pos.z }, { count: 24, color: 0x5a5060, speed: 4, life: 0.6, size: 0.35, gravity: 5, up: 3, additive: false });
        if (d < 2.4 + hero.radius) hero.hurt(3, self.pos);
        const rings = phase2 ? 2 : 1;
        for (let r = 0; r < rings; r++) bulletRing(self, 14 + r * 4, 4.8 + r * 1.4, r * 0.2);
        self.setState('recover'); self.cooldown = rand(1.0, 1.5) / speedMult;
      }
      break;
    }
    case 'teleCharge': {
      self.moveSpeed = 0;
      if (self.stateTime > 0.75) { self.telegraph = null; rig.hold('spin'); self.setState('charge'); self.chargeFrom = self.pos.clone(); audio.play('swing'); }
      break;
    }
    case 'charge': { // несётся по прямой, вращая мечом
      self.moveDir.copy(self.lockDir); self.moveSpeed = 13;
      if (Math.random() < realDt * 30) audio.play('swing');
      fx.slash(self.pos, dirFromAngle(game.time * 22), { radius: 1.6, inner: 0.6, angle: 1.8, color: 0xff2a2a, life: 0.12 });
      if (d < 1.4 + hero.radius) hero.hurt(2, self.pos);
      if (self.pos.distanceTo(self.chargeFrom) > self.chargeLength || self.stateTime > 1.0) {
        rig.stop(); audio.play('boom'); fx.shake(0.6);
        fx.ring(self.pos, { radius: 2, color: 0xff3030, life: 0.35 });
        bulletRing(self, 10, 5);
        self.setState('dizzy'); self.cooldown = rand(1.2, 1.6) / speedMult;
      }
      break;
    }
    case 'dizzy': { // окно для атаки героя
      self.moveSpeed = 0;
      if (Math.random() < dt * 8) fx.burst({ x: self.pos.x + rand(-0.4, 0.4), y: 2.2, z: self.pos.z + rand(-0.4, 0.4) }, { count: 1, color: 0xffe066, speed: 0.5, life: 0.5, size: 0.25, gravity: 0, up: 0 });
      if (self.stateTime > 1.1) self.setState('walk');
      break;
    }
    case 'summon': {
      self.moveSpeed = 0;
      if (self.stateTime > 0.9) {
        for (let i = 0; i < 2; i++) {
          const p = self.pos.clone().addScaledVector(dirFromAngle(self.facing + (i ? 1.2 : -1.2)), 2);
          game.world.collide(p, 0.4);
          game.spawnEnemy('warrior', p.x, p.z, self.room);
        }
        rig.stop(); self.setState('recover'); self.cooldown = rand(1.0, 1.5);
      }
      break;
    }
    case 'roar': self.moveSpeed = 0; if (self.stateTime > 1.0) { self.setState('walk'); self.cooldown = 0.3; } break;
    case 'recover': self.moveSpeed = 0; if (self.stateTime > 0.5) self.setState('walk'); break;
    default: self.setState('walk');
  }
};
