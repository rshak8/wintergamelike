// All tunable numbers live here.
export const CTA_URL = 'https://example.com/store'; // TODO: replace with store link

export const CHAR_SCALE = 0.9;

export const PLAYER = {
  hp: 10,
  speed: 5.2,
  accel: 40,
  radius: 0.3,
  invuln: 0.7,       // seconds of i-frames after a hit
  stopDelay: 0.06,   // how long the stick must be released before auto-attack kicks in
};

// Weapon definitions. kind: melee | bow | staff
export const WEAPONS = {
  sword: {
    name: 'Knight Sword', rarity: 'Common', color: '#cfd3dd', model: 'W_Sword', kind: 'melee', anim: 'stab',
    dmg: 4, cd: 0.42, range: 1.75, arc: 0.5, lunge: 0.55, knock: 3.5, desc: 'Fast piercing thrust',
  },
  fire: {
    name: 'Fire Sword', rarity: 'Legendary', color: '#ff6a2a', model: 'W_FireSword', kind: 'melee', anim: 'slash',
    dmg: 4.5, cd: 0.5, range: 2.0, arc: 2.2, lunge: 0.35, knock: 4, burn: { time: 3, dps: 2.2 }, desc: 'Wide slash · sets enemies on fire',
  },
  ice: {
    name: 'Ice Bow', rarity: 'Epic', color: '#6fd4ff', model: 'W_IceBow', kind: 'bow', anim: 'shoot',
    dmg: 5, cd: 0.72, range: 11, speed: 20, knock: 2, slow: { time: 2.5, mult: 0.45 }, desc: 'Instant shot · slows enemies',
  },
  lightning: {
    name: 'Lightning Staff', rarity: 'Epic', color: '#a57bff', model: 'W_LightningStaff', kind: 'staff', anim: 'cast',
    dmg: 4, cd: 0.48, range: 10, speed: 13, knock: 1.5, chain: { count: 2, radius: 4.2, dmg: 3 }, desc: 'Bolt chains to 2 more enemies',
  },
  poison: {
    name: 'Poison Dagger', rarity: 'Rare', color: '#5cff46', model: 'W_PoisonDagger', kind: 'melee', anim: 'jab',
    dmg: 1.8, cd: 0.16, range: 1.45, arc: 0.7, lunge: 0.25, knock: 1.2, poison: { time: 4, dps: 1.4 }, desc: 'Rapid stabs · poison blocks healing',
  },
  hammer: {
    name: 'Holy Hammer', rarity: 'Epic', color: '#ffd24a', model: 'W_HolyHammer', kind: 'melee', anim: 'slam',
    dmg: 9, cd: 0.95, range: 2.3, aoe: 2.2, lunge: 0.2, knock: 6, stun: 0.9, desc: 'Huge area slam · stuns',
  },
};
export const CHEST_WEAPONS = ['fire', 'ice', 'lightning', 'poison', 'hammer'];

export const BUFFS = {
  hp: { name: 'Vitality', desc: '+4 Max HP', icon: '❤', color: '#ff4a5a' },
  atkspd: { name: 'Fury', desc: '+30% Attack Speed', icon: '⚡', color: '#ffd24a' },
  dmg: { name: 'Might', desc: '+35% Damage', icon: '⚔', color: '#ff7a2a' },
  speed: { name: 'Swiftness', desc: '+18% Move Speed', icon: '➶', color: '#5ad0ff' },
};

export const ENEMIES = {
  warrior: { model: 'SkelWarrior', weapon: 'W_EnemySword', hp: 13, speed: 2.7, radius: 0.36, dmg: 2, scale: 1.15, coins: 3 },
  archer: { model: 'SkelArcher', weapon: 'W_ArcherBow', hp: 9, speed: 2.4, radius: 0.34, dmg: 2, scale: 1.15, coins: 3 },
  necro: { model: 'Necro', weapon: 'W_NecroOrb', hp: 11, speed: 1.8, radius: 0.36, dmg: 3, scale: 1.15, coins: 4 },
  healer: { model: 'Healer', weapon: 'W_Scepter', hp: 9, speed: 3.3, radius: 0.34, dmg: 0, scale: 1.15, coins: 4, heal: 4, healEvery: 3.6 },
  king: { model: 'SkelKing', weapon: 'W_BossSword', hp: 230, speed: 2.3, radius: 0.75, dmg: 2, scale: 2.05, coins: 30 },
  mimic: { model: 'T_Mimic', weapon: null, hp: 32, speed: 3.6, radius: 0.55, dmg: 2, scale: 1.15, coins: 10 },
};
