import { WEAPONS, BUFFS, CTA_URL, type BuffId, type WeaponId } from './config';
import { audio } from './audio';
import type { Game } from './game';

const $ = (html: string) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild as HTMLElement; };

export interface HintOpts { time?: number; warn?: boolean; stop?: boolean; second?: string; low?: boolean }

/** A see-through hole in the spotlight overlay, in screen pixels. */
export interface SpotHole { x: number; y: number; r: number }

export class UI {
  icons: Record<string, string>;
  heroIcon: string;
  G!: Game; // set by bind(); the player is created (and may call updateWeapons) a moment before that
  hud: HTMLElement;
  overlay: HTMLElement;
  hpFill: HTMLElement; hpText: HTMLElement;
  coinText: HTMLElement; buffBox: HTMLElement;
  roomsEl: HTMLElement;
  bossEl: HTMLElement; bossFill: HTMLElement; bossLag: HTMLElement;
  hintEl: HTMLElement; toastEl: HTMLElement;
  wcardEl: HTMLElement;
  wbtn: HTMLButtonElement;
  vig: HTMLElement; fadeEl: HTMLElement;
  spotEl: HTMLElement;
  hintT?: ReturnType<typeof setTimeout>;
  lagT?: ReturnType<typeof setTimeout>;
  tipT?: ReturnType<typeof setTimeout>;
  toastUntil = 0; // while a toast is on screen

  constructor(icons: Record<string, string>, heroIcon: string) {
    this.icons = icons; this.heroIcon = heroIcon;
    this.hud = document.getElementById('hud')!;
    this.overlay = document.getElementById('overlay')!;
    this.hud.innerHTML = `
      <div class="spot"></div>
      <div class="top-left">
        <div class="portrait" style="background-image:url(${heroIcon})"></div>
        <div class="bars">
          <div class="hpbar"><i></i><span></span></div>
          <div class="stat-row">
            <div class="coins"><b class="coin-ico"></b><span>0</span></div>
            <div class="buffs"></div>
          </div>
        </div>
      </div>
      <div class="rooms"></div>
      <div class="boss"><div class="bname"></div><div class="bbar"><i></i><em></em></div></div>
      <div class="hint"><span></span><em></em></div>
      <div class="hand-tut"><div class="ht-base"></div><div class="ht-move"><div class="ht-knob"></div><div class="ht-hand"></div></div></div>
      <div class="toast"><b></b><small></small></div>
      <div class="wcard"></div>
      <button class="weapon-btn" aria-label="Swap weapon">
        <div class="w-main"><img alt=""></div>
        <div class="w-alt"><img alt=""></div>
        <div class="w-name"></div>
        <div class="w-swap">⇄</div>
        <div class="w-tip"></div>
      </button>
      <div class="vignette"></div>
      <div class="fade"></div>
    `;
    const q = <T extends HTMLElement = HTMLElement>(s: string) => this.hud.querySelector<T>(s)!;
    this.hpFill = q('.hpbar i'); this.hpText = q('.hpbar span');
    this.coinText = q('.coins span'); this.buffBox = q('.buffs');
    this.roomsEl = q('.rooms');
    this.bossEl = q('.boss'); this.bossFill = q('.bbar i'); this.bossLag = q('.bbar em');
    this.hintEl = q('.hint'); this.toastEl = q('.toast');
    this.wcardEl = q('.wcard');
    this.wbtn = q<HTMLButtonElement>('.weapon-btn');
    this.vig = q('.vignette'); this.fadeEl = q('.fade');
    this.spotEl = q('.spot');
    let rh = '';
    for (let i = 1; i <= 6; i++) rh += `<div class="rdot ${i === 6 ? 'skull' : ''}" data-i="${i}">${i === 6 ? '☠' : ''}</div>${i < 6 ? '<div class="rline"></div>' : ''}`;
    this.roomsEl.innerHTML = rh;
    const stop = (e: Event) => e.stopPropagation();
    this.wbtn.addEventListener('pointerdown', (e) => { stop(e); this.G?.player.swap(); this.hideWeaponTip(); this.wbtn.classList.add('press'); setTimeout(() => this.wbtn.classList.remove('press'), 120); });
  }

  bind(G: Game) { this.G = G; this.updateHp(); this.updateWeapons(); this.setRoom(1); this.updateCoins(); }

  updateHp() {
    const P = this.G.player;
    this.hpFill.style.width = (P.hp / P.maxHp * 100) + '%';
    this.hpText.textContent = `${Math.ceil(P.hp)} / ${P.maxHp}`;
    this.hpFill.parentElement!.classList.toggle('low', P.hp / P.maxHp < 0.35);
  }

  updateCoins() {
    this.coinText.textContent = String(this.G.player.coins);
    const box = this.coinText.parentElement!;
    box.classList.remove('bump'); void this.coinText.offsetWidth; box.classList.add('bump');
  }

  addBuff(k: BuffId) {
    const b = BUFFS[k];
    const el = $(`<div class="buff-ico" style="--c:${b.color}">${b.icon}</div>`);
    this.buffBox.appendChild(el);
  }

  updateWeapons() {
    const P = this.G?.player; if (!P) return;
    const cur = WEAPONS[P.wid];
    this.wbtn.querySelector<HTMLImageElement>('.w-main img')!.src = this.icons[cur.model];
    this.wbtn.querySelector('.w-name')!.textContent = cur.name;
    this.wbtn.style.setProperty('--wc', cur.color);
    const has2 = P.weapons.length > 1;
    this.wbtn.classList.toggle('two', has2);
    if (has2) {
      const alt = WEAPONS[P.weapons[1 - P.cur]];
      this.wbtn.querySelector<HTMLImageElement>('.w-alt img')!.src = this.icons[alt.model];
    }
    this.wbtn.classList.remove('flash'); void this.wbtn.offsetWidth; this.wbtn.classList.add('flash');
  }

  setRoom(i: number) {
    this.roomsEl.querySelectorAll<HTMLElement>('.rdot').forEach((d) => {
      const n = Number(d.dataset.i);
      d.classList.toggle('done', n < i); d.classList.toggle('cur', n === i);
    });
  }

  /** The room progress bar is hidden while a fight is on. */
  showRooms(on: boolean) { this.roomsEl.classList.toggle('hidden', !on); }

  /**
   * Wordless "how to move" tutorial: a hand pushing a ghost joystick around.
   * While it shows, the room bar and the weapon button stay hidden.
   */
  handTutorial(on: boolean) {
    this.hud.querySelector('.hand-tut')!.classList.toggle('show', on);
    this.hud.classList.toggle('tut', on);
  }

  /** Center-screen hint; `second` is an optional emphasized second line. */
  hint(text: string, { time = 0, warn = false, stop = false, second = '', low = false }: HintOpts = {}) {
    // never stack a hint on top of a room title: fade the title out first
    if (performance.now() < this.toastUntil) { this.toastEl.classList.add('out'); this.toastUntil = 0; }
    this.hintEl.querySelector('span')!.textContent = text;
    this.hintEl.querySelector('em')!.textContent = second;
    this.hintEl.className = 'hint show' + (warn ? ' warn' : '') + (stop ? ' stop' : '') + (low ? ' low' : '');
    clearTimeout(this.hintT);
    if (time) this.hintT = setTimeout(() => this.hintEl.classList.remove('show'), time * 1000);
  }

  /** Darken the whole screen except two round windows (the hero and one enemy). */
  spotlight(on: boolean) { this.spotEl.classList.toggle('on', on); }
  setSpot(hero: SpotHole, enemy: SpotHole) {
    const s = this.spotEl.style;
    s.setProperty('--hx', hero.x + 'px'); s.setProperty('--hy', hero.y + 'px'); s.setProperty('--hr', hero.r + 'px');
    s.setProperty('--ex', enemy.x + 'px'); s.setProperty('--ey', enemy.y + 'px'); s.setProperty('--er', enemy.r + 'px');
  }

  /** Small label right above the weapon button; fades out by itself (or when the button is tapped). */
  weaponTip(text: string, time = 3) {
    this.wbtn.querySelector('.w-tip')!.textContent = text;
    this.wbtn.classList.add('tip', 'pulse');
    clearTimeout(this.tipT);
    this.tipT = setTimeout(() => this.hideWeaponTip(), time * 1000);
  }
  hideWeaponTip() { clearTimeout(this.tipT); this.wbtn.classList.remove('tip', 'pulse'); }
  hideHint() { this.hintEl.classList.remove('show'); }

  toast(title: string, sub = '', style: '' | 'white' = '') {
    this.toastEl.querySelector('b')!.textContent = title;
    this.toastEl.querySelector('small')!.textContent = sub;
    this.toastEl.classList.toggle('white', style === 'white');
    this.toastEl.classList.remove('show', 'out'); void this.toastEl.offsetWidth; this.toastEl.classList.add('show');
    this.toastUntil = performance.now() + 1900; // matches the .toast.show animation
  }

  weaponCard(id: WeaponId) {
    const w = WEAPONS[id];
    this.wcardEl.innerHTML = `<img src="${this.icons[w.model]}"><div><b style="color:${w.color}">${w.name}</b><em class="r-${w.rarity}">${w.rarity}</em><small>${w.desc}</small><i>Walk over to equip</i></div>`;
    this.wcardEl.classList.add('show');
  }
  hideWeaponCard() { this.wcardEl.classList.remove('show'); }

  showBoss(name: string) {
    this.bossEl.querySelector('.bname')!.textContent = name;
    this.bossEl.classList.add('show');
    this.updateBoss(1);
  }
  updateBoss(k: number) {
    this.bossFill.style.width = Math.max(0, k * 100) + '%';
    clearTimeout(this.lagT);
    this.lagT = setTimeout(() => { this.bossLag.style.width = Math.max(0, k * 100) + '%'; }, 250);
  }
  hideBoss() { this.bossEl.classList.remove('show'); }

  hurt() {
    this.vig.classList.remove('hit'); void this.vig.offsetWidth; this.vig.classList.add('hit');
  }

  buffChoice(keys: BuffId[], cb: (k: BuffId) => void) {
    audio.play('chestOpen');
    const el = $(`<div class="modal buffs-modal"><h2><span>CHOOSE A</span><em>BLESSING</em></h2><div class="cards"></div></div>`);
    const cards = el.querySelector('.cards')!;
    keys.forEach((k, i) => {
      const b = BUFFS[k];
      const c = $(`<button class="card" style="--c:${b.color};--d:${i * 0.08}s"><div class="ico">${b.icon}</div><b>${b.name}</b></button>`);
      c.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        audio.play('ui');
        c.classList.add('picked');
        el.classList.add('closing');
        setTimeout(() => { el.remove(); cb(k); }, 380);
      }, { once: true });
      cards.appendChild(c);
    });
    this.overlay.appendChild(el);
  }

  fadeOut(cb: () => void) {
    this.fadeEl.classList.add('on');
    setTimeout(cb, 700);
  }

  packshot(win: boolean) {
    this.hideHint(); this.hideBoss(); this.hideWeaponCard();
    const P = this.G.player;
    const el = $(`
      <div class="packshot ${win ? 'win' : 'lose'}">
        <div class="ps-rays"></div>
        <div class="ps-logo">DUNGEON<br><span>KNIGHT</span></div>
        <div class="ps-hero" style="background-image:url(${this.heroIcon})"></div>
        <div class="ps-title">${win ? 'DUNGEON CLEARED!' : 'YOU FELL...'}</div>
        <div class="ps-stats"><span><b class="coin-ico"></b>${P.coins}</span><span>⚔ ${P.weapons.map((w) => `<img src="${this.icons[WEAPONS[w].model]}">`).join('')}</span></div>
        <button class="cta">Continue?</button>
        <div class="ps-sub">${win ? 'Deeper floors await' : 'Your adventure is not over'}</div>
      </div>`);
    const cta = el.querySelector('.cta')!;
    const go = (e: Event) => { e.stopPropagation(); audio.play('ui'); openStore(); };
    cta.addEventListener('pointerdown', go);
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.overlay.appendChild(el);
    this.fadeEl.classList.remove('on');
    if (window.mraid?.addEventListener) { /* MRAID ready */ }
  }
}

export function openStore() {
  try {
    if (window.mraid && window.mraid.open) { window.mraid.open(CTA_URL); return; }
    if (window.ExitApi && window.ExitApi.exit) { window.ExitApi.exit(); return; }
  } catch (e) { /* ignore */ }
  window.open(CTA_URL, '_blank');
}
