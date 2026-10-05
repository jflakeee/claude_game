# 재설계·행동 프레임 운영 배포

- 소스 게시: `f860110`
- 게임 Pages 게시: `12d7251`
- 운영 도메인 Pages 게시: `062bcfe`
- 새 번들: `index-Dy2G0TBs.js`, `index-DBq_H0BP.css`
- 기존 해시 자산은 유지했다. 운영 저장소 변경 범위는 `claude_game/`의 index와 새 자산이다.

로컬 단위 테스트 121개, 빌드, 대표 구간 시각 검증은 통과했다. 배포 브랜치 push는 두 곳 모두 성공했다.

현재 공개 반영은 대기 중이다. GitHub Actions의 build job이 실행기를 기다리는 `queued` 상태이고 steps는 비어 있다. 공개 URL 최초 검증에서는 이전 번들 `index-wX80CaSN.js`가 제공되어 새 버전 검증을 통과하지 못했다. 따라서 현재 기록은 운영 배포 완료 판정이 아니다.

- [운영 도메인 배포 작업](https://github.com/jflakeee/hexa_merge_base/actions/runs/37373197368)
- [게임 배포 작업](https://github.com/jflakeee/claude_game/actions/runs/37373169826)
- 운영 검증 스크립트: `node tests/visual-redesign-production.cjs`
- [게임](https://www.fungood.co.kr/claude_game/)
- [포털](https://www.fungood.co.kr/game_portal/#/play/claude-game)

작업 완료 후 검증 스크립트로 새 번들, 데스크톱 준비/전투 폭, 모바일 전투·복귀, 모션 설정 저장, 포털 iframe, 페이지 오류를 확인하고 결과를 갱신해야 한다.
