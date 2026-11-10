# ulsan-cce — 울산창의융합교육센터 업무 앱 모음

센터에서 쓰는 업무 앱을 한 저장소에 모아 관리합니다. 앱마다 폴더가 따로 있습니다.

| 앱 | 웹 화면 | 코드·안내서 |
|---|---|---|
| 물품·시설 관리 | `docs/inventory/` | [`apps/inventory/`](apps/inventory/) — 설치·운영 안내서는 `apps/inventory/guide/` |

- `docs/` — GitHub Pages가 보여 주는 화면 (`docs/index.html`이 포털 첫 화면)
- `apps/<앱이름>/` — 서버 코드(`gas/`), 옮기기 도구(`tools/`), 테스트(`test/`), 안내서(`guide/`)

새 앱을 더할 때는 `docs/<앱이름>/` 과 `apps/<앱이름>/` 을 만들고 `docs/index.html`에 링크를 한 줄 추가합니다.
