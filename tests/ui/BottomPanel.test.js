import { describe, it, expect } from 'vitest';
import { renderTab } from '../../src/ui/BottomPanel.js';

function baseState() {
  return {
    character: { level: 3, skillPoints: 2, equippedItems: [] },
    currency: { gold: 120 },
    scrapbook: [],
    settings: { autoEquipMinGrade: 'normal' },
  };
}

describe('renderTab', () => {
  it('equipment 탭: 장착 아이템이 없으면 안내 문구를 보여준다', () => {
    expect(renderTab('equipment', baseState())).toContain('장착한 장비 없음');
  });

  it('equipment 탭: 장착 아이템 이름과 등급을 나열한다', () => {
    const state = baseState();
    state.character.equippedItems = [{ name: '녹슨 검', grade: 'normal' }];
    expect(renderTab('equipment', state)).toContain('녹슨 검 (normal)');
  });

  it('equipment 탭: 스크랩북에 아이템이 있으면 복원 버튼과 함께 보여준다', () => {
    const state = baseState();
    state.scrapbook = [{ id: 'x1', name: '교체된 검', grade: 'rare', statBonus: {}, slot: 'weapon' }];
    const html = renderTab('equipment', state);
    expect(html).toContain('교체된 검 (rare)');
    expect(html).toContain('data-action="restore-scrapbook-item"');
    expect(html).toContain('data-item-id="x1"');
  });

  it('skills 탭: 레벨과 스킬 포인트를 보여준다', () => {
    expect(renderTab('skills', baseState())).toContain('레벨 3');
    expect(renderTab('skills', baseState())).toContain('스킬 포인트 2');
  });

  it('settings 탭: 자동 장착 최소 등급과 변경 버튼을 보여준다', () => {
    const html = renderTab('settings', baseState());
    expect(html).toContain('normal');
    expect(html).toContain('data-action="cycle-auto-equip-grade"');
  });

  it('shop 탭: 보유 골드와 뽑기 버튼을 보여준다', () => {
    const html = renderTab('shop', baseState());
    expect(html).toContain('120');
    expect(html).toContain('data-action="pull-gacha"');
  });

  it('알 수 없는 탭은 빈 문자열을 반환한다', () => {
    expect(renderTab('unknown', baseState())).toBe('');
  });
});
