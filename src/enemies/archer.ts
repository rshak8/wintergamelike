// Скелет-лучник: держит дистанцию 4–7 клеток, целится (красная линия) и стреляет.
// В конце прицеливания линия замирает и становится шире — пора уходить в сторону.
import { audio } from '../audio/audio';
import { rand, angleTo, dirFromAngle } from '../utils';
import { rayLength, muzzle, type Brain } from './helpers';

const LOCK_AT = 0.55;   // после этого прицел больше не следит за героем
const SHOOT_AT = 0.85;

export const archer: Brain = (self, dt) => {
  const { game } = self, hero = self.player, rig = self.rig!, fx = game.fx;
  const d = self.distToPlayer();
  self.stateTime += dt; self.cooldown -= dt;
  switch (self.state) {
    case 'idle': case 'move': {
      self.repathTimer -= dt;
      if (!self.goal || self.repathTimer <= 0 || self.pos.distanceTo(self.goal) < 0.4) { self.goal = self.pickSpot(4.2, 7); self.repathTimer = rand(1.2, 2.2); }
      if (d < 3) self.goal = self.pickSpot(5, 8); // герой слишком близко — отходим
      self.walkTo(self.goal, self.def.speed, dt);
      if (self.cooldown <= 0 && d < 11 && game.world.hasLineOfSight(self.pos, hero.pos)) {
        self.setState('aim'); rig.hold('aim'); audio.play('telegraph');
        self.facing = angleTo(self.pos, hero.pos);
        self.aimLength = rayLength(game, self.pos, dirFromAngle(self.facing), 14);
        self.telegraph = fx.telegraph({ shape: 'rect', pos: self.pos, dir: dirFromAngle(self.facing), length: self.aimLength, width: 0.12, time: SHOOT_AT, color: 0xff3030 });
      }
      break;
    }
    case 'aim': {
      self.moveSpeed = 0;
      if (self.stateTime < LOCK_AT) self.turnTowards(angleTo(self.pos, hero.pos), dt, 14);
      // линия прицела поворачивается вместе с лучником и упирается в стены
      if (self.telegraph?.mesh) {
        const len = rayLength(game, self.pos, dirFromAngle(self.facing), 14);
        self.telegraph.mesh.rotation.y = self.facing + Math.PI;
        self.telegraph.mesh.position.set(self.pos.x, 0.03, self.pos.z);
        self.telegraph.mesh.scale.set(self.stateTime > LOCK_AT ? 2.2 : 1, 1, len / self.aimLength);
      }
      if (self.stateTime > SHOOT_AT) {
        self.telegraph = null;
        rig.play('shoot'); audio.play('bowShot');
        const dir = dirFromAngle(self.facing);
        game.projectiles.shootEnemy('arrow', muzzle(self, dir, 0.4, 0.55), dir, { speed: 15, dmg: self.def.dmg });
        self.setState('recover'); self.cooldown = rand(1.5, 2.2);
      }
      break;
    }
    case 'recover': self.moveSpeed = 0; if (self.stateTime > 0.35) self.setState('move'); break;
    default: self.setState('move');
  }
};
