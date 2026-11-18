import type { Game } from '../game/engine/Game'

export class Editor {
  constructor(private panel: HTMLDivElement, private game: Game) {}

  render() {
    const { mods } = this.game
    this.panel.innerHTML = `
      <h2 style="color:#f90;margin-bottom:12px;font-size:15px">⚙ Game Editor</h2>

      <section>
        <h3 style="color:#aaf;font-size:12px;margin-bottom:8px;text-transform:uppercase">Gameplay Mods</h3>

        <label style="display:block;margin-bottom:10px">
          <span style="color:#ccc">Enemy Multiplier (grinding)</span><br>
          <input type="range" min="1" max="5" value="${mods.enemyMultiplier}" id="ed-enemy-mult" style="width:100%">
          <span id="ed-enemy-mult-val" style="color:#ff9">${mods.enemyMultiplier}x enemies per stage</span>
        </label>

        <label style="display:block;margin-bottom:10px">
          <span style="color:#ccc">Max Party Size</span><br>
          <input type="range" min="1" max="12" value="${mods.maxPartySize}" id="ed-party-size" style="width:100%">
          <span id="ed-party-size-val" style="color:#ff9">${mods.maxPartySize} units</span>
        </label>

        <label style="display:block;margin-bottom:10px">
          <span style="color:#ccc">EXP Multiplier</span><br>
          <input type="range" min="1" max="10" value="${mods.expMultiplier}" id="ed-exp-mult" style="width:100%">
          <span id="ed-exp-mult-val" style="color:#ff9">${mods.expMultiplier}x EXP</span>
        </label>

        <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer">
          <input type="checkbox" id="ed-no-mp" ${mods.noMpCost ? 'checked' : ''}>
          <span style="color:#ccc">Infinite MP (no MP cost)</span>
        </label>

        <label style="display:flex;align-items:center;gap:8px;margin-bottom:16px;cursor:pointer">
          <input type="checkbox" id="ed-invincible" ${mods.invincible ? 'checked' : ''}>
          <span style="color:#ccc">Invincible (player units)</span>
        </label>
      </section>

      <section>
        <h3 style="color:#aaf;font-size:12px;margin-bottom:8px;text-transform:uppercase">Game Data Reference</h3>

        <details style="margin-bottom:8px">
          <summary style="cursor:pointer;color:#88ccff">Characters (${this.game.data.characters.length})</summary>
          <div style="max-height:160px;overflow-y:auto;margin-top:6px">
            ${this.game.data.characters.map(c => `
              <div style="border-bottom:1px solid #333;padding:3px 0;font-size:11px">
                <b style="color:#fff">${c.name}</b>
                <span style="color:#888"> HP+${c.hp_min}~${c.hp_max} AP+${c.ap_min}~${c.ap_max}
                MP+${c.mp_min}~${c.mp_max}</span>
              </div>`).join('')}
          </div>
        </details>

        <details style="margin-bottom:8px">
          <summary style="cursor:pointer;color:#88ccff">Enemies (${this.game.data.enemies.length})</summary>
          <div style="max-height:160px;overflow-y:auto;margin-top:6px">
            ${this.game.data.enemies.map(e => `
              <div style="border-bottom:1px solid #333;padding:3px 0;font-size:11px">
                <b style="color:${e.friendly ? '#88ff88' : '#ff8888'}">${e.name}</b>
                <span style="color:#888"> HP:${e.hp} AP:${e.ap} DP:${e.dp} MV:${e.mv}</span>
              </div>`).join('')}
          </div>
        </details>

        <details style="margin-bottom:8px">
          <summary style="cursor:pointer;color:#88ccff">Spells (${this.game.data.spells.length})</summary>
          <div style="max-height:160px;overflow-y:auto;margin-top:6px">
            ${this.game.data.spells.map(s => `
              <div style="border-bottom:1px solid #333;padding:3px 0;font-size:11px">
                <b style="color:#ffaaff">${s.name}</b>
                <span style="color:#888"> Pwr:${s.power} Acc:${s.accuracy}% MP:${s.mp_cost} Rng:${s.range}</span>
              </div>`).join('')}
          </div>
        </details>

        <details>
          <summary style="cursor:pointer;color:#88ccff">Items & Weapons (${this.game.data.items.length})</summary>
          <div style="max-height:160px;overflow-y:auto;margin-top:6px">
            ${this.game.data.items.map(i => `
              <div style="border-bottom:1px solid #333;padding:3px 0;font-size:11px">
                <b style="color:#ffdd88">${i.name}</b>
                <span style="color:#888"> ${i.subcategory} AP:${i.ap} DP:${i.dp} 💰${i.price_buy}</span>
              </div>`).join('')}
          </div>
        </details>
      </section>
    `
    this.bindEvents()
  }

  private bindEvents() {
    const bind = (id: string, valId: string, key: keyof typeof this.game.mods, fmt: (v: number) => string) => {
      const el = document.getElementById(id) as HTMLInputElement
      const lbl = document.getElementById(valId)!
      el?.addEventListener('input', () => {
        const v = Number(el.value)
        ;(this.game.mods as Record<string, unknown>)[key] = v
        lbl.textContent = fmt(v)
      })
    }
    bind('ed-enemy-mult', 'ed-enemy-mult-val', 'enemyMultiplier', v => `${v}x enemies per stage`)
    bind('ed-party-size', 'ed-party-size-val', 'maxPartySize', v => `${v} units`)
    bind('ed-exp-mult', 'ed-exp-mult-val', 'expMultiplier', v => `${v}x EXP`)

    const noMp = document.getElementById('ed-no-mp') as HTMLInputElement
    noMp?.addEventListener('change', () => { this.game.mods.noMpCost = noMp.checked })

    const inv = document.getElementById('ed-invincible') as HTMLInputElement
    inv?.addEventListener('change', () => { this.game.mods.invincible = inv.checked })
  }
}
