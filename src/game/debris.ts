// Обломки: части тел убитых врагов и щепки ящиков. Летят, кувыркаются, отскакивают, исчезают.
import * as THREE from 'three';
import { audio } from '../audio/audio';
import { rand } from '../utils';
import type { Game } from './game';

interface Piece {
  obj: THREE.Object3D;
  vel: THREE.Vector3;
  spin: THREE.Vector3;       // скорость вращения
  life: number;
  small: boolean;            // щепка (без звука удара)
  baseScale: THREE.Vector3;  // исходный масштаб — в конце жизни уменьшаем от него
}

export class Debris {
  private pieces: Piece[] = [];

  constructor(private game: Game) {}

  add(obj: THREE.Object3D, vel: THREE.Vector3, life: number, small = false) {
    this.pieces.push({ obj, vel, life, small, spin: new THREE.Vector3(rand(-12, 12), rand(-12, 12), rand(-12, 12)), baseScale: obj.scale.clone() });
  }

  update(dt: number) {
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const d = this.pieces[i];
      d.life -= dt;
      d.vel.y -= 20 * dt;
      d.obj.position.addScaledVector(d.vel, dt);
      if (d.obj.position.y < 0.08) {
        d.obj.position.y = 0.08;
        if (d.vel.y < -1.5) { d.vel.y *= -0.38; d.spin.multiplyScalar(0.6); if (!d.small && Math.random() < 0.3) audio.play('crunch'); }
        else d.vel.y = 0;
        d.vel.x *= 0.7; d.vel.z *= 0.7;
      }
      if (this.game.world.isSolid(d.obj.position.x, d.obj.position.z)) { d.vel.x *= -0.5; d.vel.z *= -0.5; } // отскок от стены
      d.obj.rotation.x += d.spin.x * dt; d.obj.rotation.y += d.spin.y * dt; d.obj.rotation.z += d.spin.z * dt;
      d.spin.multiplyScalar(Math.exp(-dt * 1.5));
      if (d.life < 0.4) d.obj.scale.copy(d.baseScale).multiplyScalar(Math.max(0.001, d.life / 0.4));
      if (d.life <= 0) { this.game.scene.remove(d.obj); this.pieces.splice(i, 1); }
    }
  }
}
