// Мимик: притворяется сундуком. Подойдёшь — оживает и прыгает на героя (место приземления
// отмечено кругом); каждый четвёртый раз вместо прыжка бежит кусаться.
// Скелета у мимика нет, поэтому модель он двигает сам.
import * as THREE from 'three';
import { audio } from '../audio/audio';
import { angleTo } from '../utils';
import type { Brain } from './helpers';

const _v = new THREE.Vector3();

export const mimic: Brain = (self, dt, realDt) => {
  const { game } = self, hero = self.player, fx = game.fx;
  const d = self.distToPlayer();
  self.stateTime += dt;
  const lid = self.lid!;
  const model = self.root;
  switch (self.state) {
    case 'dormant': { // стоит сундуком и еле заметно «дышит»
      model.position.copy(self.pos);
      model.scale.set(self.scale, self.scale * (1 + Math.sin(game.time * 3) * 0.015), self.scale);
      if (d < 2.2) {
        self.setState('reveal'); audio.play('mimic');
        self.facing = angleTo(self.pos, hero.pos);
        fx.shake(0.4);
        fx.text({ x: self.pos.x, y: 1.6, z: self.pos.z }, 'MIMIC!', { color: '#ffd040', size: 30, crit: true, life: 1.1 });
        audio.setIntensity(1);
      }
      return;
    }
    case 'reveal': { // подпрыгивает, крышка клацает
      const k = Math.min(1, self.stateTime / 0.7);
      model.position.set(self.pos.x, Math.sin(k * Math.PI) * 1.2, self.pos.z);
      model.rotation.y = self.facing;
      lid.rotation.x = -Math.sin(self.stateTime * 30) * 0.4 - 0.3;
      if (k >= 1) { self.targetable = true; self.setState('rest'); fx.ring(self.pos, { radius: 1.3, color: 0xffd040, life: 0.35 }); fx.shake(0.4); }
      return;
    }
    case 'rest': {
      model.position.set(self.pos.x, 0, self.pos.z);
      lid.rotation.x = -0.15 - Math.abs(Math.sin(self.stateTime * 6)) * 0.2;
      self.turnTowards(angleTo(self.pos, hero.pos), dt, 6);
      if (self.stateTime > 0.55) {
        self.hops += 1;
        if (self.hops % 4 === 0) { self.setState('bite'); }
        else {
          // прыжок туда, где герой будет, но не дальше 4.5 клеток
          self.setState('hopTele');
          self.hopFrom = self.pos.clone();
          self.hopTo = hero.pos.clone().addScaledVector(hero.vel, 0.3);
          _v.subVectors(self.hopTo, self.hopFrom); if (_v.length() > 4.5) self.hopTo.copy(self.hopFrom).addScaledVector(_v.normalize(), 4.5);
          self.telegraph = fx.telegraph({ shape: 'circle', pos: self.hopTo, radius: 1.25, time: 0.75 });
        }
      }
      break;
    }
    case 'hopTele': { // присел перед прыжком
      lid.rotation.x = -0.6;
      model.scale.set(self.scale * 1.15, self.scale * 0.8, self.scale * 1.15);
      if (self.stateTime > 0.25) { self.setState('hop'); model.scale.setScalar(self.scale); }
      break;
    }
    case 'hop': {
      const k = Math.min(1, self.stateTime / 0.5);
      self.pos.lerpVectors(self.hopFrom, self.hopTo, k);
      game.world.collide(self.pos, self.radius);
      model.position.set(self.pos.x, Math.sin(k * Math.PI) * 1.6, self.pos.z);
      model.rotation.x = Math.sin(k * Math.PI) * -0.4;
      lid.rotation.x = -0.9 * Math.sin(k * Math.PI);
      self.facing = angleTo(self.hopFrom, self.hopTo);
      model.rotation.y = self.facing;
      if (k >= 1) { // приземление
        self.telegraph = null; model.rotation.x = 0;
        audio.play('slam'); fx.shake(0.5);
        fx.ring(self.pos, { radius: 1.4, color: 0xffd040, life: 0.35 });
        fx.burst({ x: self.pos.x, y: 0.1, z: self.pos.z }, { count: 16, color: 0x6a5a7a, speed: 3, life: 0.5, size: 0.3, gravity: 5, up: 2, additive: false });
        if (d < 1.25 + hero.radius) hero.hurt(self.def.dmg, self.pos);
        model.scale.set(self.scale * 1.25, self.scale * 0.75, self.scale * 1.25);
        self.setState('rest');
      }
      return;
    }
    case 'bite': { // бежит и клацает крышкой
      self.walkTo(hero.pos, self.def.speed * 1.5, dt);
      lid.rotation.x = -Math.abs(Math.sin(self.stateTime * 18)) * 0.9;
      if (Math.sin(self.stateTime * 18) > 0.95) audio.play('bite');
      if (d < self.radius + hero.radius + 0.15) hero.hurt(self.def.dmg, self.pos);
      if (self.stateTime > 1.1) self.setState('rest');
      break;
    }
  }
  // модель следует за позицией, подпрыгивает при ходьбе и возвращает обычный масштаб
  model.position.x = self.pos.x; model.position.z = self.pos.z;
  if (self.state !== 'hop') model.position.y = Math.abs(Math.sin(self.stateTime * 14)) * (self.state === 'bite' ? 0.25 : 0.05);
  model.rotation.y = self.facing;
  const sc = model.scale; sc.x += (self.scale - sc.x) * Math.min(1, realDt * 10); sc.y += (self.scale - sc.y) * Math.min(1, realDt * 10); sc.z = sc.x;
};
