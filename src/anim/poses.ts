// Позы атак и действий. Каждая поза — функция от t (0..1, прогресс действия),
// которая говорит, куда повернуть руки, корпус, голову и оружие. Rig накладывает это поверх бега.

const ease = {
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  in: (t: number) => t * t * t,
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Прогресс внутри отрезка [a, b] шкалы t: 0 до a, 1 после b. */
const phase = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));

/** Поворот руки: x — вперёд/назад (отрицательный — вперёд и вверх), z — в сторону. */
export interface ArmPose { x: number; z: number }

/** Частичная поза: всё, что не задано, остаётся как при беге/стойке. */
export interface Pose {
  armR?: ArmPose; armL?: ArmPose;
  bodyPitch?: number;   // наклон корпуса вперёд
  bodyYaw?: number;     // поворот корпуса
  bodyLift?: number;    // подъём/присед корпуса
  headPitch?: number;
  weaponPitch?: number; // 0 = клинок вдоль руки (вниз), -PI/2 = вперёд, -PI = вверх
  squash?: number;      // сплющивание всего персонажа
  lean?: number;        // смещение вперёд (применяет сам персонаж)
}

/** dur > 5 означает удерживаемую позу: держится, пока не вызовут stop() или другое действие. */
export interface Action {
  dur: number;
  pose(t: number, alt: boolean, time: number): Pose;
}

export const ACTIONS = {
  // ---------- атаки героя ----------
  /** Меч: замах назад и прямой выпад. */
  stab: {
    dur: 0.3, pose(t) {
      const wind = phase(t, 0, 0.3), hit = phase(t, 0.3, 0.45), back = phase(t, 0.55, 1);
      const ax = lerp(lerp(-0.4, 0.5, ease.out(wind)), -1.62, ease.out(hit));
      return {
        armR: { x: lerp(ax, -0.5, ease.inOut(back)), z: 0.15 }, armL: { x: lerp(0.3, 0.6, hit) * (1 - back), z: -0.2 },
        bodyPitch: lerp(lerp(-0.08, 0.32, hit), 0.05, back), bodyYaw: lerp(lerp(0.25, -0.3, hit), 0, back),
        weaponPitch: lerp(lerp(-1.7, -0.1, ease.out(wind + hit)), -1.7, back), lean: hit * (1 - back),
      };
    },
  },
  /** Кинжал: быстрые уколы, alt чередует руку. */
  jab: {
    dur: 0.16, pose(t, alt) {
      const hit = phase(t, 0, 0.35), back = phase(t, 0.45, 1);
      const arm = { x: lerp(lerp(-0.2, -1.65, ease.out(hit)), -0.5, back), z: 0.1 };
      const rest = { x: -0.3, z: -0.1 };
      const common = { bodyPitch: 0.2 * (1 - back), weaponPitch: lerp(-0.2, -1.6, back), lean: hit * (1 - back) };
      return alt ? { armL: arm, armR: rest, bodyYaw: lerp(-0.35, 0, back), ...common }
        : { armR: arm, armL: rest, bodyYaw: lerp(0.35, 0, back), ...common };
    },
  },
  /** Огненный меч: широкий горизонтальный взмах с разворотом корпуса. */
  slash: {
    dur: 0.36, pose(t) {
      const wind = phase(t, 0, 0.28), hit = phase(t, 0.28, 0.5), back = phase(t, 0.6, 1);
      const twist = lerp(lerp(0, 1.15, ease.out(wind)), -1.2, ease.out(hit));
      return {
        armR: { x: lerp(-1.3, -0.5, back), z: lerp(lerp(0.2, 1.0, wind), 0.2, hit) }, armL: { x: 0.3, z: -0.3 },
        bodyYaw: lerp(twist, 0, ease.inOut(back)), bodyPitch: 0.2 * hit * (1 - back),
        weaponPitch: lerp(-0.25, -1.7, back), lean: hit * (1 - back) * 0.8, bodyLift: -0.04 * hit * (1 - back),
      };
    },
  },
  /** Молот: подъём двумя руками над головой и удар об пол. */
  slam: {
    dur: 0.62, pose(t) {
      const wind = phase(t, 0, 0.42), hit = phase(t, 0.42, 0.55), back = phase(t, 0.7, 1);
      const ax = lerp(lerp(-0.4, -2.9, ease.out(wind)), -1.1, ease.in(hit));
      return {
        armR: { x: lerp(ax, -0.4, back), z: 0.05 }, armL: { x: lerp(ax, -0.3, back), z: -0.05 },
        bodyPitch: lerp(lerp(0, -0.35, wind), 0.45, hit) * (1 - back), bodyLift: lerp(lerp(0, 0.06, wind), -0.12, hit) * (1 - back),
        weaponPitch: lerp(-0.2, -1.8, back), squash: hit * (1 - back) * 0.18, lean: hit * (1 - back) * 0.6,
      };
    },
  },
  /** Лук: выстрел с небольшой отдачей. */
  shoot: {
    dur: 0.24, pose(t) {
      const back = phase(t, 0.25, 1);
      const recoil = Math.sin(phase(t, 0, 0.35) * Math.PI) * 0.25;
      return { armR: { x: -1.5 + recoil, z: 0.0 }, armL: { x: lerp(-1.45, -0.9, back), z: -0.35 }, bodyPitch: -0.08 * (1 - back), bodyYaw: 0.3, weaponPitch: 0 };
    },
  },
  /** Посох: взмах вверх и выброс вперёд. */
  cast: {
    dur: 0.3, pose(t) {
      const wind = phase(t, 0, 0.35), hit = phase(t, 0.35, 0.55), back = phase(t, 0.6, 1);
      return {
        armR: { x: lerp(lerp(-0.8, -2.3, ease.out(wind)), -1.45, ease.out(hit)) * (1 - back) + -0.7 * back, z: 0.1 }, armL: { x: lerp(-0.2, 0.4, hit), z: -0.2 },
        bodyPitch: lerp(-0.1, 0.25, hit) * (1 - back), weaponPitch: lerp(-0.4, 0, wind) * (1 - back) + -2.2 * back, lean: hit * (1 - back) * 0.3,
      };
    },
  },
  /** Получил удар: отшатнулся. */
  hit: {
    dur: 0.26, pose(t) {
      const k = Math.sin(phase(t, 0, 1) * Math.PI);
      return { bodyPitch: -0.35 * k, squash: -0.14 * k, armR: { x: 0.4 * k - 0.4, z: 0.4 * k }, armL: { x: 0.4 * k - 0.2, z: -0.4 * k } };
    },
  },

  // ---------- действия врагов ----------
  /** Замах перед ударом (держится, пока горит зона опасности). */
  windup: { dur: 9, pose() { return { armR: { x: 0.9, z: 0.5 }, bodyYaw: 0.6, bodyPitch: -0.15, weaponPitch: -1.2, bodyLift: -0.03 }; } },
  /** Скелет-воин: выпад. */
  thrustE: {
    dur: 0.35, pose(t) {
      const hit = phase(t, 0, 0.25), back = phase(t, 0.5, 1);
      return { armR: { x: lerp(lerp(0.9, -1.6, ease.out(hit)), -0.5, back), z: 0.1 }, bodyYaw: lerp(lerp(0.6, -0.2, hit), 0, back), bodyPitch: 0.3 * hit * (1 - back), weaponPitch: lerp(-0.1, -1.6, back), lean: hit * (1 - back) };
    },
  },
  /** Скелет-воин и король: взмах. */
  slashE: {
    dur: 0.4, pose(t) {
      const hit = phase(t, 0, 0.3), back = phase(t, 0.5, 1);
      return { armR: { x: lerp(-1.3, -0.5, back), z: lerp(1.1, 0.2, hit) }, bodyYaw: lerp(lerp(1.2, -1.3, ease.out(hit)), 0, back), bodyPitch: 0.15, weaponPitch: lerp(-0.2, -1.6, back), bodyLift: -0.04 * hit * (1 - back) };
    },
  },
  /** Лучник: прицеливание. */
  aim: { dur: 9, pose() { return { armR: { x: -1.5, z: 0 }, armL: { x: -1.2, z: -0.5 }, bodyYaw: 0.35, bodyPitch: -0.05, weaponPitch: 0 }; } },
  /** Лекарь: руки вверх, лечение. */
  channel: { dur: 9, pose(_t, _alt, time) { const b = Math.sin(time * 10) * 0.08; return { armR: { x: -2.6 + b, z: 0.3 }, armL: { x: -2.6 - b, z: -0.3 }, bodyPitch: -0.2, bodyLift: 0.04, weaponPitch: 0 }; } },
  /** Некромант: собирает шар. */
  castE: { dur: 9, pose(_t, _alt, time) { const b = Math.sin(time * 14) * 0.06; return { armR: { x: -1.9 + b, z: 0.2 }, armL: { x: -0.6, z: -0.5 }, bodyPitch: -0.15, weaponPitch: 0 }; } },
  /** Некромант: бросок шара. */
  throwE: {
    dur: 0.35, pose(t) { const hit = phase(t, 0, 0.3), back = phase(t, 0.4, 1); return { armR: { x: lerp(-2.4, -1.2, ease.out(hit)) * (1 - back) - 0.4 * back, z: 0.2 }, bodyPitch: 0.3 * hit * (1 - back), weaponPitch: 0, lean: 0.4 * hit * (1 - back) }; },
  },
  /** Король: руки вверх (перед ударом об пол / призывом). */
  raise: { dur: 9, pose(_t, _alt, time) { const b = Math.sin(time * 18) * 0.05; return { armR: { x: -2.9 + b, z: 0.1 }, armL: { x: -2.7 - b, z: -0.2 }, bodyPitch: -0.3, bodyLift: 0.06, weaponPitch: 0 }; } },
  /** Король: удар об пол. */
  stomp: {
    dur: 0.5, pose(t) {
      const hit = phase(t, 0, 0.25), back = phase(t, 0.4, 1);
      return {
        armR: { x: lerp(-2.9, -0.8, ease.in(hit)) * (1 - back) - 0.4 * back, z: 0.1 }, armL: { x: lerp(-2.7, -0.6, ease.in(hit)) * (1 - back), z: -0.2 },
        bodyPitch: lerp(-0.3, 0.5, hit) * (1 - back), bodyLift: -0.12 * hit * (1 - back), squash: 0.2 * hit * (1 - back), weaponPitch: lerp(0, -1.4, back),
      };
    },
  },
  /** Король: вращение во время рывка. */
  spin: { dur: 9, pose(_t, _alt, time) { return { armR: { x: -1.5, z: 1.3 }, armL: { x: -1.5, z: -1.3 }, bodyYaw: time * 22, weaponPitch: 0 }; } },
  /** Король: рёв (появление и ярость). */
  roar: { dur: 1.0, pose(t) { const k = Math.sin(phase(t, 0, 1) * Math.PI); return { armR: { x: -0.6 * k, z: 1.2 * k }, armL: { x: -0.6 * k, z: -1.2 * k }, bodyPitch: -0.4 * k, headPitch: -0.5 * k }; } },
} satisfies Record<string, Action>;

export type ActionName = keyof typeof ACTIONS;
