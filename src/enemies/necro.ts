// Некромант: держится на расстоянии и бросает по дуге шар в точку, куда герой вот-вот придёт.
// Место взрыва заранее отмечено фиолетовым кругом.
import * as THREE from 'three';
import { audio } from '../audio/audio';
import { rand, angleTo } from '../utils';
import type { Brain } from './helpers';

const THROW_DELAY = 0.1; // анимация throwE: рука доходит вперёд примерно через 0.1 с

export const necro: Brain = (self, dt, realDt) => {
  const { game } = self, hero = self.player, rig = self.rig!, fx = game.fx;
  const d = self.distToPlayer();
  self.stateTime += dt; self.cooldown -= dt;
  if (self.weaponModel) self.weaponModel.rotation.y += realDt * 3; // шар в руке вращается
  switch (self.state) {
    case 'idle': case 'move': {
      self.repathTimer -= dt;
      if (!self.goal || self.repathTimer <= 0 || self.pos.distanceTo(self.goal) < 0.4) { self.goal = self.pickSpot(4.5, 8); self.repathTimer = rand(1.5, 2.6); }
      self.walkTo(self.goal, self.def.speed, dt);
      if (self.cooldown <= 0 && d < 10) {
        self.setState('cast'); rig.hold('castE'); audio.play('orbCast');
        self.facing = angleTo(self.pos, hero.pos);
      }
      break;
    }
    case 'cast': { // шар растёт в руке
      self.moveSpeed = 0;
      self.turnTowards(angleTo(self.pos, hero.pos), dt, 8);
      if (self.weaponModel) self.weaponModel.scale.setScalar(1 + self.stateTime * 1.2);
      if (Math.random() < dt * 30) fx.burst(rig.handR!.getWorldPosition(new THREE.Vector3()), { count: 1, color: 0xb060ff, speed: 1.5, life: 0.3, size: 0.2, gravity: 0, up: 0.5 });
      if (self.stateTime > 0.7) {
        rig.play('throwE');
        if (self.weaponModel) self.weaponModel.scale.setScalar(1);
        // шар вылетает, когда рука по анимации заканчивает бросок
        self.schedule(THROW_DELAY, () => {
          // целимся с упреждением, с небольшим разбросом
          const target = hero.pos.clone().addScaledVector(hero.vel, 0.35);
          target.x += rand(-0.4, 0.4); target.z += rand(-0.4, 0.4);
          const from = self.pos.clone(); from.y = 0.9;
          game.projectiles.shootEnemy('orb', from, null, { target, dmg: self.def.dmg, radius: 1.45, speed: 5.2 });
        });
        self.setState('recover'); self.cooldown = rand(2.4, 3.2);
      }
      break;
    }
    case 'recover': self.moveSpeed = 0; if (self.stateTime > 0.4) self.setState('move'); break;
    default: self.setState('move');
  }
};
