# MVP Integration Fixes — Implementation Plan (Tasks 15-21)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the integration gaps found by the final whole-branch review of `docs/superpowers/plans/2026-10-02-idle-vampire-hybrid-game.md` (Tasks 1-14, all individually spec/quality-approved but not wired together end-to-end). Specifically: wire up leveling/skill points, make equipment/stats affect gameplay, add touch input to combat, stop losing replaced equipment, make combat actually fullscreen with persisted idle progress, harden persistence against storage failures, and give the settings tab one real control.

**Architecture:** Same pure-logic/Phaser-glue separation as the base plan. New pure modules get Vitest unit tests; Phaser scene edits are verified via build + existing test suite (no new scene-level tests, consistent with Tasks 10/12).

**Tech Stack:** Same as base plan (Vite, Phaser 3, Vitest).

Base plan: `docs/superpowers/plans/2026-10-02-idle-vampire-hybrid-game.md`
Base spec: `docs/superpowers/specs/2026-10-02-idle-vampire-hybrid-game-design.md`

**Scope decision (resolves spec ambiguity flagged in final review):** the spec's UI-layout section describes a "상점/거래" tab alongside its narrower "MVP 시스템 범위" section, which never lists shop/trading as one of the three built systems. We keep the shop tab as **display-only** for this MVP (already built in Task 13) and move actual buy/sell functionality to the "추후 확장 로드맵" section of the base spec. Task 21 below adds a real control to the **settings** tab instead (auto-equip grade cycling), which was unambiguously in scope and trivial to wire.

---

### Task 15: 레벨업 시스템 (경험치 → 레벨 → 스킬 포인트)

**Files:**
- Create: `src/systems/leveling.js`
- Test: `tests/systems/leveling.test.js`
- Modify: `src/scenes/IdleScene.js` (call `applyLevelUps` after each idle kill tick)
- Modify: `src/scenes/CombatScene.js` (call `applyLevelUps` after `settleCombat`)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/systems/leveling.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { expThreshold, applyLevelUps } from '../../src/systems/leveling.js';

describe('expThreshold', () => {
  it('레벨 * 50 을 반환한다', () => {
    expect(expThreshold(1)).toBe(50);
    expect(expThreshold(3)).toBe(150);
  });
});

describe('applyLevelUps', () => {
  it('경험치가 기준치 미만이면 레벨업하지 않는다', () => {
    const character = { level: 1, exp: 10, skillPoints: 0 };
    const leveledUp = applyLevelUps(character);
    expect(leveledUp).toBe(false);
    expect(character.level).toBe(1);
    expect(character.exp).toBe(10);
    expect(character.skillPoints).toBe(0);
  });

  it('경험치가 기준치 이상이면 레벨업하고 스킬 포인트를 1 지급한다', () => {
    const character = { level: 1, exp: 50, skillPoints: 0 };
    const leveledUp = applyLevelUps(character);
    expect(leveledUp).toBe(true);
    expect(character.level).toBe(2);
    expect(character.exp).toBe(0);
    expect(character.skillPoints).toBe(1);
  });

  it('한 번에 여러 레벨업이 가능하면 반복해서 처리한다', () => {
    const character = { level: 1, exp: 50 + 100 + 5, skillPoints: 0 };
    const leveledUp = applyLevelUps(character);
    expect(leveledUp).toBe(true);
    expect(character.level).toBe(3);
    expect(character.exp).toBe(5);
    expect(character.skillPoints).toBe(2);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/systems/leveling.test.js`
Expected: FAIL — `Cannot find module '../../src/systems/leveling.js'`

- [ ] **Step 3: 최소 구현 작성**

`src/systems/leveling.js`:
```js
export function expThreshold(level) {
  return level * 50;
}

export function applyLevelUps(character) {
  let leveledUp = false;
  while (character.exp >= expThreshold(character.level)) {
    character.exp -= expThreshold(character.level);
    character.level += 1;
    character.skillPoints += 1;
    leveledUp = true;
  }
  return leveledUp;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/systems/leveling.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: IdleScene에 연결**

`src/scenes/IdleScene.js`의 `import` 블록에 추가:
```js
import { applyLevelUps } from '../systems/leveling.js';
```

`update()`의 tick 블록 안, `resolveIdleKill(...)` 호출 직후에 추가:
```js
      resolveIdleKill({
        character: state.character,
        currency: state.currency,
        inventory: state.inventory,
        autoEquipMinGrade: state.settings.autoEquipMinGrade,
      });
      applyLevelUps(state.character);
      store.notify();
```

- [ ] **Step 6: CombatScene에 연결**

`src/scenes/CombatScene.js`의 `import` 블록에 추가:
```js
import { applyLevelUps } from '../systems/leveling.js';
```

`endCombat()`에서 `settleCombat(...)` 호출 직후에 추가:
```js
  endCombat() {
    if (this.enemyHitTimer) this.enemyHitTimer.remove();
    const state = store.getState();
    settleCombat(this.session, state.currency, state.character);
    applyLevelUps(state.character);
    store.notify();
    this.scene.start('IdleScene');
  }
```

- [ ] **Step 7: 빌드/테스트 검증**

Run: `npm run build` → 성공해야 함
Run: `npm test` → 기존 50개 + 신규 4개 = 54개 전부 PASS

- [ ] **Step 8: 커밋**

```bash
git add src/systems/leveling.js tests/systems/leveling.test.js src/scenes/IdleScene.js src/scenes/CombatScene.js
git commit -m "feat: add leveling system and wire skill-point grants into both combat modes"
```

---

### Task 16: 장비/스킬 스탯이 실제 게임플레이에 반영되도록 연결

**Files:**
- Create: `src/systems/effectiveStats.js`
- Test: `tests/systems/effectiveStats.test.js`
- Modify: `src/scenes/IdleScene.js` (effectiveStats.atk가 높을수록 킬 틱 간격이 짧아짐)
- Modify: `src/scenes/CombatScene.js` (effectiveStats.def가 높을수록 피격 데미지 감소)

**Depends on:** Task 7 (skills — `applySkillEffects`), Task 6 (autoEquip — `character.equippedItems` shape)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/systems/effectiveStats.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { computeEffectiveStats } from '../../src/systems/effectiveStats.js';

function baseCharacter() {
  return {
    stats: { atk: 100, def: 50 },
    equippedItems: [],
    skills: {},
  };
}

describe('computeEffectiveStats', () => {
  it('장비도 스킬도 없으면 기본 스탯을 그대로 반환한다', () => {
    expect(computeEffectiveStats(baseCharacter())).toEqual({ atk: 100, def: 50 });
  });

  it('장비의 statBonus를 기본 스탯에 더한다', () => {
    const character = baseCharacter();
    character.equippedItems = [
      { statBonus: { atk: 10 } },
      { statBonus: { atk: 5, def: 3 } },
    ];
    expect(computeEffectiveStats(character)).toEqual({ atk: 115, def: 53 });
  });

  it('장비 보너스를 더한 뒤 스킬 배율을 곱한다', () => {
    const character = baseCharacter();
    character.equippedItems = [{ statBonus: { atk: 10 } }];
    character.skills = { power_strike: 1 };
    // (100 + 10) * 1.1 = 121
    expect(computeEffectiveStats(character)).toEqual({ atk: 121, def: 50 });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/systems/effectiveStats.test.js`
Expected: FAIL — `Cannot find module '../../src/systems/effectiveStats.js'`

- [ ] **Step 3: 최소 구현 작성**

`src/systems/effectiveStats.js`:
```js
import { applySkillEffects } from '../data/skills.js';

export function computeEffectiveStats(character) {
  const gearBonus = character.equippedItems.reduce((acc, item) => {
    for (const [stat, value] of Object.entries(item.statBonus)) {
      acc[stat] = (acc[stat] || 0) + value;
    }
    return acc;
  }, {});

  const baseWithGear = {
    atk: character.stats.atk + (gearBonus.atk || 0),
    def: character.stats.def + (gearBonus.def || 0),
  };

  return applySkillEffects({ stats: baseWithGear, skills: character.skills });
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/systems/effectiveStats.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: IdleScene에 연결 — atk가 높을수록 킬 틱이 빨라짐**

`src/scenes/IdleScene.js`의 `import` 블록에 추가:
```js
import { computeEffectiveStats } from '../systems/effectiveStats.js';
```

`update(time, delta)` 내부, 기존:
```js
    if (this.tickAccumulator >= IDLE_COMBAT_TICK_MS) {
      this.tickAccumulator -= IDLE_COMBAT_TICK_MS;
```
를 다음으로 교체:
```js
    const state = store.getState();
    const effectiveStats = computeEffectiveStats(state.character);
    const killIntervalMs = Math.max(300, IDLE_COMBAT_TICK_MS - effectiveStats.atk * 5);

    if (this.tickAccumulator >= killIntervalMs) {
      this.tickAccumulator -= killIntervalMs;
```

(이 블록 안쪽에서 기존에 `const state = store.getState();`를 다시 선언하던 줄은 중복이므로 제거하고, 위에서 미리 구한 `state`를 그대로 사용합니다.)

- [ ] **Step 6: CombatScene에 연결 — def가 높을수록 피격 데미지 감소**

`src/scenes/CombatScene.js`의 `import` 블록에 추가:
```js
import { computeEffectiveStats } from '../systems/effectiveStats.js';
```

`create()`에서 `this.playerHp = 100;` 다음 줄에 추가:
```js
    const state = store.getState();
    this.effectiveStats = computeEffectiveStats(state.character);
```

`create()`의 `enemyHitTimer` 콜백:
```js
      callback: () => {
        this.playerHp = Math.max(0, this.playerHp - ENEMY_HIT_DAMAGE);
      },
```
을 다음으로 교체:
```js
      callback: () => {
        const mitigatedDamage = Math.max(1, ENEMY_HIT_DAMAGE - Math.floor(this.effectiveStats.def / 10));
        this.playerHp = Math.max(0, this.playerHp - mitigatedDamage);
      },
```

- [ ] **Step 7: 빌드/테스트 검증**

Run: `npm run build` → 성공해야 함
Run: `npm test` → 기존 54개 + 신규 3개 = 57개 전부 PASS

- [ ] **Step 8: 커밋**

```bash
git add src/systems/effectiveStats.js tests/systems/effectiveStats.test.js src/scenes/IdleScene.js src/scenes/CombatScene.js
git commit -m "feat: make equipment and skill stats affect idle kill speed and combat damage"
```

---

### Task 17: CombatScene 터치/드래그 이동 입력 추가

**Files:**
- Modify: `src/scenes/CombatScene.js`

- [ ] **Step 1: 포인터 드래그 이동 핸들러 추가**

`src/scenes/CombatScene.js`의 `create()`에서, 기존 `this.cursors = this.input.keyboard ? ... : null;` 줄 다음에 추가:
```js
    this.input.on('pointermove', (pointer) => {
      if (!pointer.isDown) return;
      this.player.x = Phaser.Math.Clamp(pointer.x, 10, this.scale.width - 10);
      this.player.y = Phaser.Math.Clamp(pointer.y, 10, this.scale.height - 10);
    });
```

키보드 커서 입력(`this.cursors`)은 그대로 유지합니다 — 데스크톱 테스트용으로 남겨두고, 터치 드래그가 모바일의 기본 조작이 됩니다. 단, "← 나가기" 버튼 영역 위에서 드래그가 시작되면 버튼 클릭과 충돌하지 않도록, 나가기 버튼의 `pointerdown` 핸들러는 기존 그대로 두면 됩니다(버튼 자체의 `pointerdown`이 버블링되어도 `pointermove`의 `pointer.isDown` 체크는 버튼 클릭 자체를 막지 않음 — Phaser는 인터랙티브 오브젝트의 클릭과 씬 전역 포인터 이벤트를 독립적으로 처리합니다).

- [ ] **Step 2: 빌드 검증 (수동, 브라우저 없는 환경 대응)**

Run: `npm run build` → 성공해야 함 (import 경로 문제 없음을 확인)
Run: `npm test` → 기존 테스트 전부 PASS (이 변경은 Phaser 입력 로직이라 신규 유닛 테스트 없음, Task 10/12와 동일한 정책)
Dev 서버 스모크 체크: 백그라운드로 `npm run dev` 기동 후 curl로 200 확인, 콘솔 에러 없는지 확인 후 프로세스 종료

- [ ] **Step 3: 커밋**

```bash
git add src/scenes/CombatScene.js
git commit -m "feat: add touch/drag movement input to CombatScene"
```

---

### Task 18: 자동 장착으로 교체된 기존 장비를 인벤토리로 회수

**Files:**
- Modify: `src/systems/idleCombat.js`
- Modify: `tests/systems/idleCombat.test.js` (새 테스트 추가)

- [ ] **Step 1: 실패하는 테스트 추가**

`tests/systems/idleCombat.test.js`의 `resolveIdleKill` describe 블록 안에 테스트 추가:
```js
  it('자동 장착으로 기존 장비가 교체되면 인벤토리로 회수된다', () => {
    const existing = { id: 'old', name: '기존 장비', grade: 'normal', statBonus: { atk: 1 }, slot: 'weapon' };
    const character = { equippedItems: [existing], exp: 0 };
    const currency = { gold: 0 };
    const inventory = [];

    resolveIdleKill({
      character,
      currency,
      inventory,
      autoEquipMinGrade: 'normal',
      randomFn: () => 0,
    });

    expect(character.equippedItems).toHaveLength(1);
    expect(character.equippedItems[0]).not.toBe(existing);
    expect(inventory).toContainEqual(existing);
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/systems/idleCombat.test.js`
Expected: FAIL — 새 테스트에서 `inventory`가 비어있어 `toContainEqual(existing)` 실패

- [ ] **Step 3: 구현 수정**

`src/systems/idleCombat.js`의 `resolveIdleKill` 마지막 부분:
```js
  const autoEquipResult = autoEquip(item, character, autoEquipMinGrade);
  if (!autoEquipResult.equipped) {
    addItemToInventory(inventory, item, currency, false);
  }
  return { goldDrop, expDrop, item, autoEquipResult };
```
를 다음으로 교체:
```js
  const autoEquipResult = autoEquip(item, character, autoEquipMinGrade);
  if (!autoEquipResult.equipped) {
    addItemToInventory(inventory, item, currency, false);
  } else if (autoEquipResult.replaced) {
    addItemToInventory(inventory, autoEquipResult.replaced, currency, false);
  }
  return { goldDrop, expDrop, item, autoEquipResult };
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/systems/idleCombat.test.js`
Expected: PASS (기존 4개 + 신규 1개 = 5개)

- [ ] **Step 5: 커밋**

```bash
git add src/systems/idleCombat.js tests/systems/idleCombat.test.js
git commit -m "fix: recover replaced equipment into inventory instead of discarding it"
```

---

### Task 19: 전투 진입 시 실제 풀스크린 전환 + 방치 진행도 영속화

**Files:**
- Modify: `src/state/models.js` (`createRunState`에 `distancePx` 필드 추가)
- Modify: `tests/state/models.test.js` (기대값 업데이트)
- Modify: `src/scenes/IdleScene.js` (로컬 progress 대신 `store`의 `runState`를 직접 사용)
- Modify: `src/scenes/CombatScene.js` (진입/종료 시 `#bottom-panel` 표시 토글)

- [ ] **Step 1: models.js 테스트 업데이트**

`tests/state/models.test.js`의 `createRunState` 테스트:
```js
describe('createRunState', () => {
  it('기본값 idle 모드, stageIndex 0, distancePx 0을 가진다', () => {
    expect(createRunState()).toEqual({ mode: 'idle', stageIndex: 0, combatTimer: 0, distancePx: 0 });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/state/models.test.js`
Expected: FAIL — 실제 반환값에 `distancePx`가 없음

- [ ] **Step 3: models.js 수정**

`src/state/models.js`의 `createRunState`:
```js
export function createRunState() {
  return { mode: 'idle', stageIndex: 0, combatTimer: 0, distancePx: 0 };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/state/models.test.js`
Expected: PASS

- [ ] **Step 5: IdleScene이 로컬 progress 대신 store.runState를 사용하도록 수정**

`src/scenes/IdleScene.js`의 `create()`에서 기존:
```js
    this.progress = createIdleProgress();
```
를 다음으로 교체:
```js
    this.progress = store.getState().runState;
```

`import` 블록에서 더 이상 쓰지 않는 `createIdleProgress`는 import 목록에서 제거합니다(사용하지 않는 import는 남기지 않음). `advanceIdleProgress`, `resolveIdleKill`, `STAGE_LENGTH_PX`, `IDLE_COMBAT_TICK_MS`는 그대로 유지합니다.

이렇게 하면 `this.progress`가 `store`의 `runState` 객체를 직접 참조하므로, `advanceIdleProgress(this.progress, delta)` 호출이 store 상태를 그대로 변경하고, 이는 Task 4의 autosave/beforeunload에 의해 자동으로 영속화됩니다. 전투 모드로 갔다가 돌아와도 `IdleScene.create()`가 다시 호출될 때 동일한 `store.getState().runState` 객체를 다시 집어오므로 진행도가 리셋되지 않습니다.

- [ ] **Step 6: CombatScene이 진입/종료 시 하단 패널을 숨기고 복원하도록 수정**

`src/scenes/CombatScene.js`의 `create()` 맨 앞에 추가:
```js
  create() {
    const bottomPanel = document.getElementById('bottom-panel');
    if (bottomPanel) bottomPanel.style.display = 'none';

    this.session = createCombatSession();
    this.playerHp = 100;
    // ... (이하 기존 코드 그대로)
```

`endCombat()`에서 `this.scene.start('IdleScene');` 바로 앞에 추가:
```js
  endCombat() {
    if (this.enemyHitTimer) this.enemyHitTimer.remove();
    const bottomPanel = document.getElementById('bottom-panel');
    if (bottomPanel) bottomPanel.style.display = '';
    const state = store.getState();
    settleCombat(this.session, state.currency, state.character);
    applyLevelUps(state.character);
    store.notify();
    this.scene.start('IdleScene');
  }
```

(Task 15에서 이미 `applyLevelUps` 호출을 추가했다면 그 줄은 유지하고, 패널 복원 코드만 그 사이에 끼워 넣습니다.)

- [ ] **Step 7: 빌드/테스트 검증**

Run: `npm run build` → 성공해야 함
Run: `npm test` → 전체 PASS (models.test.js 기대값 변경 반영된 상태로)
Dev 서버 스모크 체크: 백그라운드 기동 → curl 200 확인 → 종료

- [ ] **Step 8: 커밋**

```bash
git add src/state/models.js tests/state/models.test.js src/scenes/IdleScene.js src/scenes/CombatScene.js
git commit -m "fix: persist idle stage progress via store and make combat a real fullscreen takeover"
```

---

### Task 20: localStorage 접근 실패에도 부팅이 죽지 않도록 방어

**Files:**
- Modify: `src/state/persistence.js`
- Modify: `tests/state/persistence.test.js` (새 테스트 추가)

- [ ] **Step 1: 실패하는 테스트 추가**

`tests/state/persistence.test.js`에 추가:
```js
function createThrowingStorage() {
  return {
    getItem: () => { throw new Error('storage unavailable'); },
    setItem: () => { throw new Error('storage unavailable'); },
    removeItem: () => { throw new Error('storage unavailable'); },
  };
}

describe('persistence — storage 자체가 실패하는 경우', () => {
  it('loadState는 storage.getItem이 throw해도 null을 반환한다', () => {
    expect(loadState(createThrowingStorage())).toBeNull();
  });

  it('saveState는 storage.setItem이 throw해도 예외를 던지지 않는다', () => {
    expect(() => saveState({ currency: { gold: 1 } }, createThrowingStorage())).not.toThrow();
  });

  it('clearState는 storage.removeItem이 throw해도 예외를 던지지 않는다', () => {
    expect(() => clearState(createThrowingStorage())).not.toThrow();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/state/persistence.test.js`
Expected: FAIL — 현재 구현은 `getItem`/`setItem`/`removeItem` 호출을 try/catch로 감싸지 않아 예외가 그대로 전파됨

- [ ] **Step 3: 구현 수정**

`src/state/persistence.js` 전체를 다음으로 교체:
```js
const STORAGE_KEY = 'claude_game_save_v1';

function resolveStorage(storage) {
  return storage || globalThis.localStorage;
}

export function saveState(state, storage) {
  try {
    resolveStorage(storage).setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // storage unavailable or quota exceeded — continue without persisting this save
  }
}

export function loadState(storage) {
  let raw;
  try {
    raw = resolveStorage(storage).getItem(STORAGE_KEY);
  } catch (e) {
    return null;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function clearState(storage) {
  try {
    resolveStorage(storage).removeItem(STORAGE_KEY);
  } catch (e) {
    // storage unavailable — nothing to clear
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/state/persistence.test.js`
Expected: PASS (기존 4개 + 신규 3개 = 7개)

- [ ] **Step 5: 커밋**

```bash
git add src/state/persistence.js tests/state/persistence.test.js
git commit -m "fix: guard persistence against localStorage access throwing (private mode, sandboxed webviews)"
```

---

### Task 21: 설정 탭에 실제 조작 가능한 컨트롤 추가 (자동 장착 등급 순환)

**Files:**
- Modify: `src/ui/BottomPanel.js`
- Modify: `tests/ui/BottomPanel.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/ui/BottomPanel.test.js`의 settings 탭 테스트를 다음으로 교체:
```js
  it('settings 탭: 자동 장착 최소 등급과 변경 버튼을 보여준다', () => {
    const html = renderTab('settings', baseState());
    expect(html).toContain('normal');
    expect(html).toContain('data-action="cycle-auto-equip-grade"');
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/ui/BottomPanel.test.js`
Expected: FAIL — 현재 settings 탭 HTML에 `data-action="cycle-auto-equip-grade"`가 없음

- [ ] **Step 3: 구현 수정**

`src/ui/BottomPanel.js` 상단에 등급 목록 import 추가:
```js
import { store } from '../state/globalStore.js';
import { GRADE_ORDER } from '../data/dropTable.js';
```

`renderTab`의 `settings` 분기를 다음으로 교체:
```js
  if (tab === 'settings') {
    return `
      <label>자동 장착 최소 등급: ${state.settings.autoEquipMinGrade}</label>
      <button data-action="cycle-auto-equip-grade" class="mock-button">등급 변경</button>
    `;
  }
```

`mountBottomPanel`에서 `render()` 함수 정의 다음, `container.querySelectorAll('.tab-button')...` 블록 다음에 클릭 위임 리스너를 추가:
```js
  content.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="cycle-auto-equip-grade"]');
    if (!button) return;
    const current = store.getState().settings.autoEquipMinGrade;
    const currentIndex = GRADE_ORDER.indexOf(current);
    const nextGrade = GRADE_ORDER[(currentIndex + 1) % GRADE_ORDER.length];
    store.setState({ settings: { ...store.getState().settings, autoEquipMinGrade: nextGrade } });
  });
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/ui/BottomPanel.test.js`
Expected: PASS (6개 전부, settings 테스트가 새 어서션으로 교체된 상태로)

- [ ] **Step 5: 빌드 검증**

Run: `npm run build` → 성공해야 함
Run: `npm test` → 전체 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/ui/BottomPanel.js tests/ui/BottomPanel.test.js
git commit -m "feat: add working auto-equip grade cycle control to settings tab"
```

---

## Self-Review 요약

- **최종 리뷰 Critical 3건 커버:** 레벨업/스킬포인트 지급(Task 15), 장비/스킬 스탯의 게임플레이 반영(Task 16), 터치/드래그 입력(Task 17) — 모두 대응 Task 존재.
- **Important 4건 중 3건 커버:** 교체 장비 유실(Task 18), 풀스크린 미적용 + 진행도 리셋(Task 19), localStorage 크래시 위험(Task 20) — 모두 대응 Task 존재. 나머지 1건(상점/설정 탭 장식용 문제)은 범위 결정으로 해소: 상점은 로드맵으로 명시 이연, 설정 탭은 Task 21로 실제 컨트롤 추가.
- **플레이스홀더 없음:** 모든 Step에 실행 가능한 코드/명령이 명시되어 있다.
- **파일 간 일관성:** Task 15/16/19가 모두 `IdleScene.js`/`CombatScene.js`를 수정하므로 구현 순서(15 → 16 → 19 → 17)를 지켜 각 Task가 이전 Task의 최신 파일 상태 위에서 작업하도록 한다.
