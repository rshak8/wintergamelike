// Добыча на полу: монеты (притягиваются к герою) и оружие (подбирается, если подойти).
import * as THREE from 'three';
import { clone } from '../assets';
import { audio } from '../audio/audio';
import { TEX } from '../fx/textures';
import { WEAPONS, type WeaponId } from '../config';
import { rand, type XZ } from '../utils';
import type { Game } from './game';

interface Coin { obj: THREE.Object3D; pos: THREE.Vector3; vel: THREE.Vector3; age: number }
interface WeaponOnFloor {
  id: WeaponId;
  obj: THREE.Object3D;     // модель + свечение, парят над полом
  ring: THREE.Mesh;        // кольцо на полу
  pos: THREE.Vector3;      // где лежит (куда идти)
  from: THREE.Vector3;     // откуда вылетело (из сундука)
  age: number;
  cardShown: boolean;
}

/** На каком расстоянии показывать карточку оружия. */
const CARD_DISTANCE = 5.5;
const MAGNET_DISTANCE = 3.2;

const _v = new THREE.Vector3();

export class Loot {
  private coins: Coin[] = [];
  private weapons: WeaponOnFloor[] = [];

  constructor(private game: Game) {}

  dropCoins(pos: XZ, n: number) {
    const { scene, shared } = this.game;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(shared.coinGeo, shared.coinMat);
      m.position.set(pos.x, 0.5, pos.z);
      scene.add(m);
      this.coins.push({ obj: m, pos: m.position, vel: new THREE.Vector3(rand(-3, 3), rand(4, 7), rand(-3, 3)), age: 0 });
    }
  }

  /** Оружие вылетает из pos и ложится чуть дальше от камеры. */
  dropWeapon(pos: XZ, id: WeaponId) {
    const { scene } = this.game;
    const w = WEAPONS[id];
    const holder = new THREE.Group();
    const model = clone(w.model);
    model.position.y = -0.3;
    holder.add(model);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: w.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(1.8); holder.add(glow);
    holder.position.set(pos.x, 0.8, pos.z);
    scene.add(holder);
    const ringMat = new THREE.MeshBasicMaterial({ map: TEX.ring, color: w.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2), ringMat);
    ring.position.set(pos.x, 0.04, pos.z - 0.9);
    scene.add(ring);
    this.weapons.push({ id, obj: holder, ring, pos: new THREE.Vector3(pos.x, 0, pos.z - 0.9), from: new THREE.Vector3(pos.x, 0.8, pos.z), age: 0, cardShown: false });
  }

  update(dt: number) {
    this.updateCoins(dt);
    this.updateWeapons(dt);
  }

  private updateCoins(dt: number) {
    const { scene, ui, fx, world } = this.game, hero = this.game.player;
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.age += dt;
      const d = c.pos.distanceTo(hero.pos);
      if (c.age > 0.5 && d < MAGNET_DISTANCE) {
        // магнит: летит к герою всё быстрее
        _v.subVectors(hero.pos, c.pos).setY(0.4 - c.pos.y).normalize().multiplyScalar(14 + c.age * 8);
        c.vel.lerp(_v, Math.min(1, dt * 8));
      } else {
        c.vel.y -= 22 * dt;
        c.vel.x *= Math.exp(-dt * 2); c.vel.z *= Math.exp(-dt * 2);
      }
      c.pos.addScaledVector(c.vel, dt);
      if (c.pos.y < 0.12) { c.pos.y = 0.12; c.vel.y = Math.abs(c.vel.y) * 0.45; } // подпрыгивает
      world.collide(c.pos, 0.1);
      c.obj.rotation.y += dt * 8;
      if (d < 0.5 && c.age > 0.5) {
        scene.remove(c.obj); this.coins.splice(i, 1);
        hero.coins++; audio.play('coin'); ui.updateCoins();
        fx.burst({ x: hero.pos.x, y: 0.6, z: hero.pos.z }, { count: 3, color: 0xffd040, speed: 1.5, life: 0.3, size: 0.15, gravity: 0, up: 1 });
      }
    }
  }

  private updateWeapons(dt: number) {
    const { scene, ui, fx } = this.game, hero = this.game.player;
    for (let i = this.weapons.length - 1; i >= 0; i--) {
      const p = this.weapons[i];
      p.age += dt;
      // вылет из сундука по дуге, потом парит и вращается
      const k = Math.min(1, p.age / 0.6);
      p.obj.position.lerpVectors(p.from, _v.set(p.pos.x, 0.9, p.pos.z), 1 - Math.pow(1 - k, 3));
      p.obj.position.y = 0.9 + Math.sin(k * Math.PI) * 1.2 + Math.sin(this.game.time * 3) * 0.1;
      p.obj.rotation.y += dt * 2.5;
      p.ring.rotation.y -= dt;
      // карточка оружия видна, только пока герой рядом
      const dist = hero.pos.distanceTo(p.pos);
      const near = p.age > 0.6 && dist < CARD_DISTANCE;
      if (near !== p.cardShown) { p.cardShown = near; if (near) ui.weaponCard(p.id); else ui.hideWeaponCard(); }
      if (p.age > 0.7 && dist < 1.0) {
        scene.remove(p.obj); scene.remove(p.ring); this.weapons.splice(i, 1);
        hero.addWeapon(p.id);
        audio.play('pickup');
        const w = WEAPONS[p.id];
        fx.flash({ x: hero.pos.x, y: 0.8, z: hero.pos.z }, { color: w.color, size: 3, life: 0.3 });
        fx.burst({ x: hero.pos.x, y: 0.5, z: hero.pos.z }, { count: 30, color: w.color, speed: 3, life: 0.7, size: 0.22, gravity: -2, up: 2 });
        fx.ring(hero.pos, { radius: 1.8, color: w.color, life: 0.4 });
        ui.hideWeaponCard();
        if (hero.weapons.length === 2) this.game.tutorial.onSecondWeapon();
      }
    }
  }
}
