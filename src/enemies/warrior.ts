// Скелет-воин: идёт на героя. Вблизи — широкий взмах (сектор), чуть дальше — выпад с рывком (полоса).
// Перед каждым ударом горит зона опасности — от удара можно уйти.
import { audio } from '../audio/audio';
import { rand, angleTo, dirFromAngle, wrapAngle } from '../utils';
import { telegraphAhead, type Brain } from './helpers';
import * as THREE from 'three';

const _a = new THREE.Vector3();

export const warrior: Brain = (self, dt) => {
  const { game } = self, hero = self.player, rig = self.rig!, fx = game.fx;
  const d = self.distToPlayer();
  self.stateTime += dt; self.cooldown -= dt;
  switch (self.state) {
    case 'idle': case 'chase': {
      self.walkTo(hero.pos, self.def.speed, dt);
      if (d < 1.0) self.moveSpeed = 0;
      if (self.cooldown <= 0 && d < 2.9 && game.world.hasLineOfSight(self.pos, hero.pos)) {
        self.facing = angleTo(self.pos, hero.pos);
        if (d < 1.55) {
          self.setState('teleSlash'); rig.hold('windup'); audio.play('telegraph');
          self.telegraph = fx.telegraph({ shape: 'sector', pos: self.pos, dir: dirFromAngle(self.facing), radius: 1.75, angle: 2.3, time: 0.5 });
        } else {
          self.setState('teleThrust'); rig.hold('windup'); audio.play('telegraph');
          self.lockDir = dirFromAngle(self.facing);
          self.telegraph = telegraphAhead(self, 3.0, 0.85, 0.6);
        }
      }
      break;
    }
    case 'teleSlash': { // замах → взмах по сектору
      self.moveSpeed = 0;
      if (self.stateTime > 0.5) {
        self.telegraph = null; rig.play('slashE'); audio.play('swing');
        fx.slash(self.pos, dirFromAngle(self.facing), { radius: 1.75, inner: 0.3, angle: 2.4, color: 0xff3a3a, life: 0.22 });
        const inArc = Math.abs(wrapAngle(angleTo(self.pos, hero.pos) - self.facing)) < 1.25;
        if (d < 1.75 + hero.radius && inArc) hero.hurt(self.def.dmg, self.pos);
        self.setState('recover'); self.cooldown = rand(1.2, 1.8);
      }
      break;
    }
    case 'teleThrust': { // первые 0.35 с ещё доворачивается за героем, потом направление зафиксировано
      self.moveSpeed = 0;
      if (self.stateTime < 0.35) {
        self.turnTowards(angleTo(self.pos, hero.pos), dt, 6);
        self.lockDir = dirFromAngle(self.facing);
        if (self.telegraph?.mesh) self.telegraph.mesh.rotation.y = self.facing + Math.PI;
      }
      if (self.telegraph?.mesh) self.telegraph.mesh.position.set(self.pos.x, 0.03, self.pos.z);
      if (self.stateTime > 0.6) {
        self.telegraph = null; rig.play('thrustE'); audio.play('stab');
        self.setState('thrust'); self.thrustLanded = false;
        fx.stab(self.pos.clone().addScaledVector(self.lockDir, 0.4), self.lockDir, { length: 2.4, width: 0.6, color: 0xff5a4a, life: 0.2 });
      }
      break;
    }
    case 'thrust': { // рывок вперёд, бьёт один раз
      self.moveDir.copy(self.lockDir); self.moveSpeed = 12;
      if (!self.thrustLanded && d < self.radius + hero.radius + 0.7) {
        const ahead = _a.subVectors(hero.pos, self.pos).dot(self.lockDir);
        if (ahead > -0.2) self.thrustLanded = hero.hurt(self.def.dmg, self.pos) || true;
      }
      if (self.stateTime > 0.2) { self.setState('recover'); self.cooldown = rand(1.3, 1.9); }
      break;
    }
    case 'recover': {
      self.moveSpeed = 0;
      if (self.stateTime > 0.55) self.setState('chase');
      break;
    }
    default: self.setState('chase');
  }
};
