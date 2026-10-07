// Level-editor side panel: level settings, the player's parts bin (inventory), and goals.
// Every change goes through Session.editLevel so it is undoable and autosaved.

import type { AppContext } from '../app/context';
import { CONNECTION_TOOLS } from '../components';
import { getComponent, paletteComponents } from '../components/registry';
import { ENVIRONMENT_IDS } from '../core/level';
import type { GoalDef, LevelDef, Selector } from '../core/types';
import type { PlayController } from '../game/PlayController';
import { ENVIRONMENTS } from '../render/art/environment';
import { paintIcon } from '../render/art/parts';
import { goalLabel } from '../sim/goals';
import { clear, h, icon, iconBtn } from './dom';

type Tab = 'level' | 'parts' | 'goals';

/** Parts a containerCount goal can count in: things with an inside (bucket) or a tally (hoop swishes). */
const isContainer = (type: string) => !!(getComponent(type)?.interior || getComponent(type)?.tally);

const GOAL_KINDS: { kind: GoalDef['kind']; label: string }[] = [
  { kind: 'enterRegion', label: 'Reach a zone' },
  { kind: 'contact', label: 'Two things touch' },
  { kind: 'activate', label: 'Switch something on' },
  { kind: 'containerCount', label: 'Fill a container' },
  { kind: 'height', label: 'Lift something high' },
  { kind: 'destroyed', label: 'Get rid of something' },
];

export class EditorPanel {
  private app: AppContext;
  private ctl: PlayController;
  private el: HTMLDivElement;
  private body: HTMLDivElement;
  private tabsEl: HTMLDivElement;
  private tab: Tab = 'level';
  private lastKey = '';

  constructor(app: AppContext, ctl: PlayController, parent: HTMLElement) {
    this.app = app;
    this.ctl = ctl;
    this.tabsEl = h('div', { class: 'tabs', role: 'tablist' });
    this.body = h('div', { class: 'side-body scroll' });
    this.el = h('div', { class: 'panel side' }, this.tabsEl, this.body);
    parent.append(this.el);
    this.render();
  }

  destroy() {
    this.el.remove();
  }

  private get level(): LevelDef {
    return this.ctl.session.level;
  }

  private edit(reason: string, fn: (l: LevelDef) => void) {
    this.ctl.session.editLevel(reason, fn);
  }

  render() {
    this.el.style.display = this.ctl.mode === 'run' ? 'none' : 'flex';
    const key = `${this.tab}|${this.ctl.session.version}|${this.ctl.editor.selectedGoal}`;
    if (key === this.lastKey) return;
    // don't rebuild while the user is typing in a field of this panel
    if (this.el.contains(document.activeElement) && (document.activeElement as HTMLElement).tagName !== 'BUTTON' && this.lastKey.split('|')[0] === this.tab) {
      this.lastKey = key;
      return;
    }
    this.lastKey = key;
    clear(this.tabsEl);
    for (const [id, label] of [
      ['level', 'Level'],
      ['parts', 'Parts bin'],
      ['goals', 'Goals'],
    ] as [Tab, string][]) {
      this.tabsEl.append(
        h(
          'button',
          {
            class: this.tab === id ? 'on' : '',
            role: 'tab',
            onClick: () => {
              this.tab = id;
              this.lastKey = '';
              this.render();
            },
          },
          label,
        ),
      );
    }
    clear(this.body);
    if (this.tab === 'level') this.renderLevel();
    else if (this.tab === 'parts') this.renderParts();
    else this.renderGoals();
  }

  // ------------------------------------------------------------------ level

  private renderLevel() {
    const l = this.level;
    const text = (label: string, value: string, apply: (v: string) => void, area = false) => {
      const inp = (area ? h('textarea', { rows: 3 }) : h('input', { type: 'text' })) as HTMLInputElement;
      inp.value = value;
      inp.addEventListener('change', () => apply(inp.value));
      return h('label', { class: 'field' }, h('span', { class: 'label' }, label), inp);
    };
    const num = (label: string, value: number, min: number, max: number, step: number, apply: (v: number) => void) => {
      const inp = h('input', { type: 'number', min: String(min), max: String(max), step: String(step), value: String(value) }) as HTMLInputElement;
      inp.addEventListener('change', () => {
        const v = Math.max(min, Math.min(max, Number(inp.value) || min));
        inp.value = String(v);
        apply(v);
      });
      return h('label', { class: 'field' }, h('span', { class: 'label' }, label), inp);
    };
    const env = h('select', null, ENVIRONMENT_IDS.map((id) => h('option', { value: id, selected: l.environment === id }, ENVIRONMENTS.find((e) => e.id === id)?.name ?? id))) as HTMLSelectElement;
    env.addEventListener('change', () => this.edit('env', (lv) => (lv.environment = env.value)));
    this.body.append(
      text('Name', l.name, (v) => this.edit('name', (lv) => (lv.name = v.trim() || 'Untitled'))),
      text('Briefing', l.description, (v) => this.edit('desc', (lv) => (lv.description = v)), true),
      h('label', { class: 'field' }, h('span', { class: 'label' }, 'Workshop'), env),
      h(
        'div',
        { class: 'field-row' },
        num('Width', l.world.width, 800, 3200, 100, (v) => this.edit('world', (lv) => (lv.world.width = v))),
        num('Height', l.world.height, 500, 1800, 100, (v) => this.edit('world', (lv) => (lv.world.height = v))),
      ),
      h(
        'div',
        { class: 'field-row' },
        num('Gravity ×', l.world.gravity ?? 1, 0.2, 2, 0.1, (v) => this.edit('gravity', (lv) => (lv.world.gravity = v))),
        num('Time limit (s)', l.restrictions?.timeLimit ?? 30, 5, 300, 5, (v) => this.edit('limit', (lv) => (lv.restrictions = { ...(lv.restrictions ?? {}), timeLimit: v }))),
      ),
      h(
        'div',
        { class: 'field-row' },
        num('Max parts (0 = any)', l.restrictions?.maxParts ?? 0, 0, 99, 1, (v) =>
          this.edit('maxparts', (lv) => {
            lv.restrictions = { ...(lv.restrictions ?? {}) };
            if (v > 0) lv.restrictions.maxParts = v;
            else delete lv.restrictions.maxParts;
          }),
        ),
        num('ELEGANT ≤ parts', l.bonus?.elegantParts ?? 0, 0, 99, 1, (v) =>
          this.edit('bonus', (lv) => {
            lv.bonus = { ...(lv.bonus ?? {}) };
            if (v > 0) lv.bonus.elegantParts = v;
            else delete lv.bonus.elegantParts;
          }),
        ),
      ),
      num('ABSURD chain stages (0 = none)', l.bonus?.absurdStages ?? 7, 0, 40, 1, (v) => this.edit('bonus', (lv) => (lv.bonus = { ...(lv.bonus ?? {}), absurdStages: v }))),
      text('Hints (one per line)', (l.hints ?? []).join('\n'), (v) => this.edit('hints', (lv) => (lv.hints = v.split('\n').map((s) => s.trim()).filter(Boolean))), true),
      h(
        'p',
        { class: 'muted', style: { fontSize: '12.5px', lineHeight: '1.45', margin: '4px 0 0' } },
        'Everything you place here belongs to the level. Tick “Room scenery” on a part to bolt it into the room; otherwise it is a starting part the player sees but cannot move. Give the player parts in the Parts bin tab and say what counts as success in Goals.',
      ),
      h(
        'button',
        {
          class: 'btn small',
          onClick: () => {
            if (confirm('Remove every object from this level?')) this.ctl.session.clearBuild();
          },
        },
        icon('trash'),
        'Clear all objects',
      ),
    );
  }

  // ------------------------------------------------------------------ inventory

  private renderParts() {
    const l = this.level;
    this.body.append(h('p', { class: 'muted', style: { fontSize: '12.5px', margin: '0' } }, 'What the player gets to build with. 0 = not offered, ∞ = unlimited. Wires are always free when a level has powered parts.'));
    const types = [...paletteComponents().filter((d) => !d.sceneryOnly).map((d) => ({ type: d.type, name: d.name })), ...(['rope', 'belt'] as const).map((t) => ({ type: t, name: CONNECTION_TOOLS[t].name }))];
    for (const t of types) {
      const item = l.inventory.find((i) => i.type === t.type);
      const count = item ? item.count : 0;
      const set = (n: number) =>
        this.edit('inventory', (lv) => {
          const i = lv.inventory.findIndex((q) => q.type === t.type);
          if (n === 0) {
            if (i >= 0) lv.inventory.splice(i, 1);
          } else if (i >= 0) lv.inventory[i].count = n;
          else lv.inventory.push({ type: t.type, count: n });
        });
      const ic = document.createElement('canvas');
      ic.width = ic.height = 64;
      try {
        ic.getContext('2d')!.drawImage(paintIcon(t.type, {}, 64), 0, 0);
      } catch {
        /* no art */
      }
      this.body.append(
        h(
          'div',
          { class: 'inv-row' },
          ic,
          h('span', { class: 'nm' }, t.name),
          h(
            'span',
            { class: 'stepper' },
            h('button', { 'aria-label': `Fewer ${t.name}`, onClick: () => set(count < 0 ? 9 : Math.max(0, count - 1)) }, '−'),
            h('span', null, count < 0 ? '∞' : String(count)),
            h('button', { 'aria-label': `More ${t.name}`, onClick: () => set(count < 0 ? -1 : count >= 20 ? -1 : count + 1) }, '+'),
          ),
        ),
      );
    }
  }

  // ------------------------------------------------------------------ goals

  private objectOptions(selected: string | undefined, filter?: (type: string) => boolean) {
    const objs = [...this.level.fixedObjects, ...this.level.startingObjects].filter((o) => !filter || filter(o.type));
    return objs.map((o) => h('option', { value: o.id, selected: o.id === selected }, `${getComponent(o.type)?.name ?? o.type} · ${o.id}`));
  }

  private selectorPicker(label: string, sel: Selector | undefined, apply: (s: Selector) => void) {
    const cur = sel && 'id' in sel ? `id:${sel.id}` : sel && 'type' in sel ? `type:${sel.type}` : '';
    const s = h(
      'select',
      null,
      h('option', { value: '', selected: !cur }, '— choose —'),
      h(
        'optgroup',
        { label: 'This exact object' },
        [...this.level.fixedObjects, ...this.level.startingObjects].map((o) => h('option', { value: `id:${o.id}`, selected: cur === `id:${o.id}` }, `${getComponent(o.type)?.name ?? o.type} · ${o.id}`)),
      ),
      h(
        'optgroup',
        { label: 'Any object of type' },
        paletteComponents().map((d) => h('option', { value: `type:${d.type}`, selected: cur === `type:${d.type}` }, `any ${d.name}`)),
      ),
    ) as HTMLSelectElement;
    s.addEventListener('change', () => {
      const [k, v] = s.value.split(/:(.*)/);
      if (!v) return;
      apply(k === 'id' ? { id: v } : { type: v });
    });
    return h('label', { class: 'field' }, h('span', { class: 'label' }, label), s);
  }

  private renderGoals() {
    const l = this.level;
    const ed = this.ctl.editor;
    this.body.append(h('p', { class: 'muted', style: { fontSize: '12.5px', margin: '0' } }, 'All goals must be met for the level to count as solved. Drag a zone’s edge on the stage to move it, or its corner to resize.'));
    l.goals.forEach((g, i) => {
      const on = ed.selectedGoal === i;
      const card = h('div', { class: `goal-card ${on ? 'on' : ''}`, onClick: () => ((ed.selectedGoal = i), (this.lastKey = ''), this.render()) });
      card.append(
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, h('b', { style: { flex: '1' } }, goalLabel(g, l)), iconBtn('trash', 'Remove goal', (e) => {
          e.stopPropagation();
          this.edit('goal-del', (lv) => lv.goals.splice(i, 1));
          ed.selectedGoal = null;
        })),
      );
      if (on) {
        const lab = h('input', { type: 'text', value: g.label ?? '', placeholder: goalLabel({ ...g, label: undefined } as GoalDef, l) }) as HTMLInputElement;
        lab.addEventListener('change', () => this.edit('goal', (lv) => (lv.goals[i].label = lab.value.trim() || undefined)));
        card.append(h('label', { class: 'field' }, h('span', { class: 'label' }, 'Text shown to the player'), lab));
        const upd = (fn: (g: any) => void) => this.edit('goal', (lv) => fn(lv.goals[i]));
        switch (g.kind) {
          case 'enterRegion':
            card.append(this.selectorPicker('What must get there', g.target, (s) => upd((q) => (q.target = s))));
            break;
          case 'contact':
            card.append(this.selectorPicker('This…', g.a, (s) => upd((q) => (q.a = s))), this.selectorPicker('…touches this', g.b, (s) => upd((q) => (q.b = s))));
            break;
          case 'activate': {
            card.append(this.selectorPicker('What must switch on', g.target, (s) => upd((q) => (q.target = s))));
            const d = h('input', { type: 'number', min: '0', max: '60', step: '0.5', value: String(g.duration ?? 0) }) as HTMLInputElement;
            d.addEventListener('change', () => upd((q) => (q.duration = Number(d.value) > 0 ? Number(d.value) : undefined)));
            card.append(h('label', { class: 'field' }, h('span', { class: 'label' }, 'For at least (seconds)'), d));
            // "knock down all 6 pins", "light all 3 candles": that many on at the same time
            const n = h('input', { type: 'number', min: '1', max: '30', step: '1', value: String(g.count ?? 1) }) as HTMLInputElement;
            n.addEventListener('change', () => upd((q) => (q.count = Math.round(Number(n.value)) > 1 ? Math.min(30, Math.round(Number(n.value))) : undefined)));
            card.append(h('label', { class: 'field' }, h('span', { class: 'label' }, 'How many at once'), n));
            break;
          }
          case 'containerCount': {
            const s = h('select', null, h('option', { value: '' }, '— choose a container —'), this.objectOptions(g.container, isContainer)) as HTMLSelectElement;
            s.addEventListener('change', () => upd((q) => (q.container = s.value)));
            const c = h('input', { type: 'number', min: '1', max: '30', value: String(g.count) }) as HTMLInputElement;
            c.addEventListener('change', () => upd((q) => (q.count = Math.max(1, Number(c.value) || 1))));
            card.append(h('label', { class: 'field' }, h('span', { class: 'label' }, 'Container'), s), h('label', { class: 'field' }, h('span', { class: 'label' }, 'How many'), c));
            break;
          }
          case 'height': {
            card.append(this.selectorPicker('What must rise', g.target, (s) => upd((q) => (q.target = s))));
            const y = h('input', { type: 'number', min: '0', max: String(l.world.height), step: '10', value: String(g.maxY) }) as HTMLInputElement;
            y.addEventListener('change', () => upd((q) => (q.maxY = Number(y.value))));
            card.append(h('label', { class: 'field' }, h('span', { class: 'label' }, 'Above this line (y)'), y));
            break;
          }
          case 'destroyed':
            card.append(this.selectorPicker('What must be destroyed', g.target, (s) => upd((q) => (q.target = s))));
            break;
        }
      }
      this.body.append(card);
    });
    const kind = h('select', null, GOAL_KINDS.map((k) => h('option', { value: k.kind }, k.label))) as HTMLSelectElement;
    this.body.append(
      h(
        'div',
        { class: 'field-row' },
        kind,
        h(
          'button',
          {
            class: 'btn small primary',
            style: { flex: 'none' },
            onClick: () => {
              const g = this.newGoal(kind.value as GoalDef['kind']);
              this.edit('goal-add', (lv) => lv.goals.push(g));
              ed.selectedGoal = this.level.goals.length - 1;
              this.lastKey = '';
              this.render();
            },
          },
          icon('plus'),
          'Add goal',
        ),
      ),
    );
  }

  private newGoal(kind: GoalDef['kind']): GoalDef {
    const l = this.level;
    const first = [...l.startingObjects].find((o) => getComponent(o.type)?.dynamic);
    const target: Selector = first ? { id: first.id } : { type: 'ball' };
    const W = l.world.width;
    const H = l.world.height;
    switch (kind) {
      case 'enterRegion':
        return { kind, target, region: { x: W - 260, y: H - 200, w: 200, h: 180 } };
      case 'contact':
        return { kind, a: target, b: { type: 'bucket' } };
      case 'activate':
        return { kind, target: { type: 'light_bulb' } };
      case 'containerCount': {
        const b = [...l.startingObjects, ...l.fixedObjects].find((o) => isContainer(o.type));
        return { kind, container: b?.id ?? '', count: 1 };
      }
      case 'height':
        return { kind, target, maxY: Math.round(H * 0.3) };
      case 'destroyed':
        return { kind, target: { type: 'balloon' } };
    }
  }
}
