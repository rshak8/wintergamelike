// Интерфейс поверх игры (HTML): здоровье, монеты, шкала пути, полоса босса, подсказки,
// всплывающие надписи, кнопка смены оружия, выбор благословения и финальный экран.
import { WEAPONS, BUFFS, CTA_URL, type BuffId, type WeaponId } from '../config';
import { audio } from '../audio/audio';
import type { Game } from '../game/game';

/** HTML-строка → элемент. */
const html = (s: string) => { const d = document.createElement('div'); d.innerHTML = s.trim(); return d.firstChild as HTMLElement; };

/** Перезапустить CSS-анимацию класса cls на элементе. */
function replay(el: HTMLElement, cls: string) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

export interface HintOpts {
  time?: number;     // через сколько секунд скрыть (0 — не скрывать)
  warn?: boolean;    // красный текст
  stop?: boolean;
  second?: string;   // вторая строка (крупнее, красная)
  low?: boolean;     // ниже героя, а не над ним
}

/** Прозрачное окно в затемнении (в пикселях экрана). */
export interface SpotHole { x: number; y: number; r: number }

const TOAST_SECONDS = 1.9; // как у анимации .toast.show в style.css

export class UI {
  private icons: Record<string, string>;
  private heroIcon: string;
  /** Задаётся в bind(). Герой создаётся (и может вызвать updateWeapons) чуть раньше. */
  private game!: Game;
  private hud: HTMLElement;
  private overlay: HTMLElement;
  // элементы HUD
  private hpFill: HTMLElement; private hpText: HTMLElement;
  private coinText: HTMLElement; private buffBox: HTMLElement;
  private roomsEl: HTMLElement;
  private bossEl: HTMLElement; private bossFill: HTMLElement; private bossLag: HTMLElement;
  readonly hintEl: HTMLElement; readonly toastEl: HTMLElement; readonly weaponCardEl: HTMLElement;
  private weaponBtn: HTMLButtonElement;
  private vignette: HTMLElement; private fadeEl: HTMLElement;
  private spotEl: HTMLElement;
  // таймеры
  private hintTimer?: ReturnType<typeof setTimeout>;
  private bossLagTimer?: ReturnType<typeof setTimeout>;
  private tipTimer?: ReturnType<typeof setTimeout>;
  private toastUntil = 0; // до какого момента на экране всплывающая надпись

  constructor(icons: Record<string, string>, heroIcon: string) {
    this.icons = icons; this.heroIcon = heroIcon;
    this.hud = document.getElementById('hud')!;
    this.overlay = document.getElementById('overlay')!;
    this.hud.innerHTML = `
      <div class="spot"></div>
      <div class="vignette"></div>
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
      <div class="fade"></div>
    `;
    const find = <T extends HTMLElement = HTMLElement>(s: string) => this.hud.querySelector<T>(s)!;
    this.hpFill = find('.hpbar i'); this.hpText = find('.hpbar span');
    this.coinText = find('.coins span'); this.buffBox = find('.buffs');
    this.roomsEl = find('.rooms');
    this.bossEl = find('.boss'); this.bossFill = find('.bbar i'); this.bossLag = find('.bbar em');
    this.hintEl = find('.hint'); this.toastEl = find('.toast');
    this.weaponCardEl = find('.wcard');
    this.weaponBtn = find<HTMLButtonElement>('.weapon-btn');
    this.vignette = find('.vignette'); this.fadeEl = find('.fade');
    this.spotEl = find('.spot');
    // шкала пути: 5 кружков комнат и череп босса
    // (︎ — показать ☠ как символ, а не цветной эмодзи, чтобы работал наш красный цвет)
    let dots = '';
    for (let i = 1; i <= 6; i++) dots += `<div class="rdot ${i === 6 ? 'skull' : ''}" data-i="${i}">${i === 6 ? '☠︎' : ''}</div>${i < 6 ? '<div class="rline"></div>' : ''}`;
    this.roomsEl.innerHTML = dots;
    this.weaponBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); // нажатие на кнопку не должно включать джойстик
      this.game?.player.swapWeapon();
      this.hideWeaponTip();
      this.weaponBtn.classList.add('press');
      setTimeout(() => this.weaponBtn.classList.remove('press'), 120);
    });
  }

  bind(game: Game) { this.game = game; this.updateHp(); this.updateWeapons(); this.setRoom(1); this.updateCoins(); }

  // ---------- верхняя панель ----------

  updateHp() {
    const hero = this.game.player;
    this.hpFill.style.width = (hero.hp / hero.maxHp * 100) + '%';
    this.hpText.textContent = `${Math.ceil(hero.hp)} / ${hero.maxHp}`;
    this.hpFill.parentElement!.classList.toggle('low', hero.hp / hero.maxHp < 0.35);
  }

  updateCoins() {
    this.coinText.textContent = String(this.game.player.coins);
    replay(this.coinText.parentElement!, 'bump');
  }

  addBuff(k: BuffId) {
    const b = BUFFS[k];
    this.buffBox.appendChild(html(`<div class="buff-ico" style="--c:${b.color}">${b.icon}</div>`));
  }

  /** Отметить на шкале пути текущую комнату и пройденные. */
  setRoom(i: number) {
    this.roomsEl.querySelectorAll<HTMLElement>('.rdot').forEach((d) => {
      const n = Number(d.dataset.i);
      d.classList.toggle('done', n < i); d.classList.toggle('cur', n === i);
    });
  }

  /** Шкала пути прячется на время боя. */
  showRooms(on: boolean) { this.roomsEl.classList.toggle('hidden', !on); }

  // ---------- кнопка оружия ----------

  updateWeapons() {
    const hero = this.game?.player; if (!hero) return;
    const cur = WEAPONS[hero.weaponId];
    this.weaponBtn.querySelector<HTMLImageElement>('.w-main img')!.src = this.icons[cur.model];
    this.weaponBtn.querySelector('.w-name')!.textContent = cur.name;
    this.weaponBtn.style.setProperty('--wc', cur.color);
    const hasTwo = hero.weapons.length > 1;
    this.weaponBtn.classList.toggle('two', hasTwo);
    if (hasTwo) {
      const alt = WEAPONS[hero.weapons[1 - hero.slot]];
      this.weaponBtn.querySelector<HTMLImageElement>('.w-alt img')!.src = this.icons[alt.model];
    }
    replay(this.weaponBtn, 'flash');
  }

  /** Маленькая подпись над кнопкой оружия; гаснет сама или при нажатии. */
  weaponTip(text: string, seconds = 3) {
    this.weaponBtn.querySelector('.w-tip')!.textContent = text;
    this.weaponBtn.classList.add('tip', 'pulse');
    clearTimeout(this.tipTimer);
    this.tipTimer = setTimeout(() => this.hideWeaponTip(), seconds * 1000);
  }
  hideWeaponTip() { clearTimeout(this.tipTimer); this.weaponBtn.classList.remove('tip', 'pulse'); }

  /** Карточка оружия на полу (название, редкость, описание). */
  weaponCard(id: WeaponId) {
    const w = WEAPONS[id];
    this.weaponCardEl.innerHTML = `<img src="${this.icons[w.model]}"><div><b style="color:${w.color}">${w.name}</b><em class="r-${w.rarity}">${w.rarity}</em><small>${w.desc}</small><i>Walk over to equip</i></div>`;
    this.weaponCardEl.classList.add('show');
  }
  hideWeaponCard() { this.weaponCardEl.classList.remove('show'); }

  // ---------- обучение и подсказки ----------

  /** Рука, которая водит стик джойстика. Пока она видна, шкала пути и кнопка оружия скрыты. */
  handTutorial(on: boolean) {
    this.hud.querySelector('.hand-tut')!.classList.toggle('show', on);
    this.hud.classList.toggle('tut', on);
  }

  hint(text: string, { time = 0, warn = false, stop = false, second = '', low = false }: HintOpts = {}) {
    // подсказка никогда не ложится поверх всплывающей надписи: та быстро гаснет
    if (performance.now() < this.toastUntil) { this.toastEl.classList.add('out'); this.toastUntil = 0; }
    this.hintEl.querySelector('span')!.textContent = text;
    this.hintEl.querySelector('em')!.textContent = second;
    this.hintEl.className = 'hint show' + (warn ? ' warn' : '') + (stop ? ' stop' : '') + (low ? ' low' : '');
    clearTimeout(this.hintTimer);
    if (time) this.hintTimer = setTimeout(() => this.hintEl.classList.remove('show'), time * 1000);
  }
  hideHint() { this.hintEl.classList.remove('show'); }

  /** Затемнить экран, оставив два светлых круга (герой и враг). */
  spotlight(on: boolean) { this.spotEl.classList.toggle('on', on); }
  setSpot(hero: SpotHole, enemy: SpotHole) {
    const s = this.spotEl.style;
    s.setProperty('--hx', hero.x + 'px'); s.setProperty('--hy', hero.y + 'px'); s.setProperty('--hr', hero.r + 'px');
    s.setProperty('--ex', enemy.x + 'px'); s.setProperty('--ey', enemy.y + 'px'); s.setProperty('--er', enemy.r + 'px');
  }

  /** Большая надпись по центру («ROOM 2», «ROOM CLEAR!»). */
  toast(title: string, sub = '', style: '' | 'white' = '') {
    this.toastEl.querySelector('b')!.textContent = title;
    this.toastEl.querySelector('small')!.textContent = sub;
    this.toastEl.classList.toggle('white', style === 'white');
    this.toastEl.classList.remove('out');
    replay(this.toastEl, 'show');
    this.toastUntil = performance.now() + TOAST_SECONDS * 1000;
  }

  // ---------- босс ----------

  showBoss(name: string) {
    this.bossEl.querySelector('.bname')!.textContent = name;
    this.bossEl.classList.add('show');
    this.updateBoss(1);
  }
  /** k — доля здоровья. Светлый «хвост» догоняет полосу с задержкой. */
  updateBoss(k: number) {
    this.bossFill.style.width = Math.max(0, k * 100) + '%';
    clearTimeout(this.bossLagTimer);
    this.bossLagTimer = setTimeout(() => { this.bossLag.style.width = Math.max(0, k * 100) + '%'; }, 250);
  }
  hideBoss() { this.bossEl.classList.remove('show'); }

  /** Красная виньетка при уроне. */
  hurt() { replay(this.vignette, 'hit'); }

  // ---------- окна ----------

  /** Выбор благословения из карточек; cb вызывается после анимации закрытия. */
  buffChoice(keys: BuffId[], cb: (k: BuffId) => void) {
    audio.play('chestOpen');
    const modal = html(`<div class="modal buffs-modal"><h2><span>CHOOSE A</span><em>BLESSING</em></h2><div class="cards"></div></div>`);
    const cards = modal.querySelector('.cards')!;
    keys.forEach((k, i) => {
      const b = BUFFS[k];
      const card = html(`<button class="card" style="--c:${b.color};--d:${i * 0.08}s"><div class="ico">${b.icon}</div><b>${b.name}</b></button>`);
      card.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        audio.play('ui');
        card.classList.add('picked');
        modal.classList.add('closing');
        setTimeout(() => { modal.remove(); cb(k); }, 380);
      }, { once: true });
      cards.appendChild(card);
    });
    this.overlay.appendChild(modal);
  }

  fadeOut(cb: () => void) {
    this.fadeEl.classList.add('on');
    setTimeout(cb, 700);
  }

  /** Финальный экран рекламы с кнопкой в стор. */
  packshot(win: boolean) {
    this.hideHint(); this.hideBoss(); this.hideWeaponCard();
    const hero = this.game.player;
    const el = html(`
      <div class="packshot ${win ? 'win' : 'lose'}">
        <div class="ps-rays"></div>
        <div class="ps-logo">DUNGEON<br><span>KNIGHT</span></div>
        <div class="ps-hero" style="background-image:url(${this.heroIcon})"></div>
        <div class="ps-title">${win ? 'DUNGEON CLEARED!' : 'YOU FELL...'}</div>
        <div class="ps-stats"><span><b class="coin-ico"></b>${hero.coins}</span><span>⚔ ${hero.weapons.map((w) => `<img src="${this.icons[WEAPONS[w].model]}">`).join('')}</span></div>
        <button class="cta">Continue?</button>
        <div class="ps-sub">${win ? 'Deeper floors await' : 'Your adventure is not over'}</div>
      </div>`);
    el.querySelector('.cta')!.addEventListener('pointerdown', (e) => { e.stopPropagation(); audio.play('ui'); openStore(); });
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.overlay.appendChild(el);
    this.fadeEl.classList.remove('on');
  }
}

/** Открыть стор: через SDK рекламной сети (MRAID и т. п.), если он есть, иначе обычной ссылкой. */
export function openStore() {
  try {
    if (window.mraid && window.mraid.open) { window.mraid.open(CTA_URL); return; }
    if (window.ExitApi && window.ExitApi.exit) { window.ExitApi.exit(); return; }
  } catch (e) { /* игнорируем */ }
  window.open(CTA_URL, '_blank', 'noopener'); // noopener: открытая страница не получит доступ к нашей
}
