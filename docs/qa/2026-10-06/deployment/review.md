# 재설계 빌드 운영 배포 및 시각 검증

2026-10-06 최신 구현 `c094234` 배포 완료.

- 게임 Pages: `acdd48d`
- `fungood.co.kr` 도메인 Pages: `925c98b`
- 공개 번들: `/claude_game/assets/index-CidQAHNm.js`
- 게임: https://www.fungood.co.kr/claude_game/
- 포털: https://www.fungood.co.kr/game_portal/#/play/claude-game

Chromium에서 공개 사이트와 포털 iframe을 직접 열어 확인했다. 데스크톱 준비 화면(1180px), 보스 전투(520px)와 복귀, 모바일 생존 전투(390px), 화면 움직임 설정 저장/복원, 공개 빌드의 개발 훅 제거, 포털 내 게임 로딩/조작이 통과했다. 수집한 페이지 오류는 0건이었다.

실제 iOS 또는 저사양 Android 기기의 프레임/메모리 측정은 이 브라우저 에뮬레이션 결과에 포함되지 않는다.

[기계 검증 결과](results.json) · [데스크톱](01-desktop.png) · [보스](02-boss.png) · [모바일](03-mobile.png) · [포털](04-portal.png)
