import { WEAPONS, BUFFS, CTA_URL } from './config.js';
import { audio } from './audio.js';

const $ = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; };

export class UI {
  constructor(icons, heroIcon) {
    this.icons = icons; this.heroIcon = heroIcon;
    this.hud = document.getElementById('hud');
    this.overlay = document.getElementById('overlay');
    this.hud.innerHTML = `
      <div class="top-left">
        <div class="portrait" style="background-image:url(${heroIcon})"></div>
        <div class="bars">
          <div class="hpbar"><i></i><span></span></div>
          <div class="coins"><b class="coin-ico"></b><span>0</span></div>
          <div class="buffs"></div>
        </div>
      </div>
      <div class="rooms"></div>
      <button class="mute" aria-label="Mute">🔊</button>
      <div class="boss"><div class="bname"></div><div class="bbar"><i></i><em></em></div></div>
      <div class="hint"><span></span><div class="hand"></div></div>
      <div class="toast"><b></b><small></small></div>
      <div class="wcard"></div>
      <button class="weapon-btn" aria-label="Swap weapon">
        <div class="w-main"><img alt=""></div>
        <div class="w-alt"><img alt=""></div>
        <div class="w-name"></div>
        <div class="w-swap">⇄</div>
      </button>
      <div class="vignette"></div>
      <div class="fade"></div>
    `;
    const q = (s) => this.hud.querySelector(s);
    this.hpFill = q('.hpbar i'); this.hpText = q('.hpbar span');
    this.coinText = q('.coins span'); this.buffBox = q('.buffs');
    this.roomsEl = q('.rooms');
    this.bossEl = q('.boss'); this.bossFill = q('.bbar i'); this.bossLag = q('.bbar em');
    this.hintEl = q('.hint'); this.toastEl = q('.toast');
    this.wcardEl = q('.wcard');
    this.wbtn = q('.weapon-btn');
    this.vig = q('.vignette'); this.fadeEl = q('.fade');
    let rh = '';
    for (let i = 1; i <= 6; i++) rh += `<div class="rdot ${i === 6 ? 'skull' : ''}" data-i="${i}">${i === 6 ? '☠' : ''}</div>${i < 6 ? '<div class="rline"></div>' : ''}`;
    this.roomsEl.innerHTML = rh;
    const stop = (e) => e.stopPropagation();
    this.wbtn.addEventListener('pointerdown', (e) => { stop(e); audio.unlock(); this.G?.player.swap(); this.wbtn.classList.remove('pulse'); this.wbtn.classList.add('press'); setTimeout(() => this.wbtn.classList.remove('press'), 120); });
    const mute = q('.mute');
    mute.addEventListener('pointerdown', (e) => { stop(e); audio.setMuted(!audio.muted); mute.textContent = audio.muted ? '🔇' : '🔊'; });
  }

  bind(G) { this.G = G; this.updateHp(); this.updateWeapons(); this.setRoom(1); this.updateCoins(); }

  updateHp() {
    const P = this.G.player;
    this.hpFill.style.width = (P.hp / P.maxHp * 100) + '%';
    this.hpText.textContent = `${Math.ceil(P.hp)} / ${P.maxHp}`;
    this.hpFill.parentElement.classList.toggle('low', P.hp / P.maxHp < 0.35);
  }

  updateCoins() {
    this.coinText.textContent = this.G.player.coins;
    this.coinText.parentElement.classList.remove('bump'); void this.coinText.offsetWidth; this.coinText.parentElement.classList.add('bump');
  }

  addBuff(k) {
    const b = BUFFS[k];
    const el = $(`<div class="buff-ico" style="--c:${b.color}">${b.icon}</div>`);
    this.buffBox.appendChild(el);
  }

  updateWeapons() {
    const P = this.G?.player; if (!P) return;
    const cur = WEAPONS[P.wid];
    this.wbtn.querySelector('.w-main img').src = this.icons[cur.model];
    this.wbtn.querySelector('.w-name').textContent = cur.name;
    this.wbtn.style.setProperty('--wc', cur.color);
    const has2 = P.weapons.length > 1;
    this.wbtn.classList.toggle('two', has2);
    if (has2) {
      const alt = WEAPONS[P.weapons[1 - P.cur]];
      this.wbtn.querySelector('.w-alt img').src = this.icons[alt.model];
    }
    this.wbtn.classList.remove('flash'); void this.wbtn.offsetWidth; this.wbtn.classList.add('flash');
  }

  setRoom(i) {
    this.roomsEl.querySelectorAll('.rdot').forEach((d) => {
      const n = +d.dataset.i;
      d.classList.toggle('done', n < i); d.classList.toggle('cur', n === i);
    });
  }

  hint(text, { hand = false, time = 0, warn = false, stop = false, swap = false } = {}) {
    this.hintEl.querySelector('span').textContent = text;
    this.hintEl.className = 'hint show' + (hand ? ' with-hand' : '') + (warn ? ' warn' : '') + (stop ? ' stop' : '');
    clearTimeout(this.hintT);
    if (time) this.hintT = setTimeout(() => this.hintEl.classList.remove('show'), time * 1000);
    if (swap) this.wbtn.classList.add('pulse');
  }
  hideHint() { this.hintEl.classList.remove('show'); }

  toast(title, sub = '') {
    this.toastEl.querySelector('b').textContent = title;
    this.toastEl.querySelector('small').textContent = sub;
    this.toastEl.classList.remove('show'); void this.toastEl.offsetWidth; this.toastEl.classList.add('show');
  }

  weaponCard(id) {
    const w = WEAPONS[id];
    this.wcardEl.innerHTML = `<img src="${this.icons[w.model]}"><div><b style="color:${w.color}">${w.name}</b><em class="r-${w.rarity}">${w.rarity}</em><small>${w.desc}</small><i>Walk over to equip</i></div>`;
    this.wcardEl.classList.add('show');
  }
  hideWeaponCard() { this.wcardEl.classList.remove('show'); }

  showBoss(name) {
    this.bossEl.querySelector('.bname').textContent = name;
    this.bossEl.classList.add('show');
    this.updateBoss(1);
  }
  updateBoss(k) {
    this.bossFill.style.width = Math.max(0, k * 100) + '%';
    clearTimeout(this.lagT);
    this.lagT = setTimeout(() => { this.bossLag.style.width = Math.max(0, k * 100) + '%'; }, 250);
  }
  hideBoss() { this.bossEl.classList.remove('show'); }

  hurt() {
    this.vig.classList.remove('hit'); void this.vig.offsetWidth; this.vig.classList.add('hit');
  }

  buffChoice(keys, cb) {
    audio.play('chestOpen');
    const el = $(`<div class="modal buffs-modal"><h2>CHOOSE A BLESSING</h2><div class="cards"></div></div>`);
    const cards = el.querySelector('.cards');
    keys.forEach((k, i) => {
      const b = BUFFS[k];
      const c = $(`<button class="card" style="--c:${b.color};--d:${i * 0.08}s"><div class="ico">${b.icon}</div><b>${b.name}</b><small>${b.desc}</small></button>`);
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

  fadeOut(cb) {
    this.fadeEl.classList.add('on');
    setTimeout(cb, 700);
  }

  packshot(win) {
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
    const cta = el.querySelector('.cta');
    const go = (e) => { e.stopPropagation(); audio.play('ui'); openStore(); };
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
