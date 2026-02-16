# 🕰️ Project Watch Service: Memory & Rules

이 파일은 프로젝트의 진행 상황, 핵심 로직, 그리고 디자인 원칙을 보존하기 위한 '기억 저장소'입니다. 새로운 대화를 시작할 때 이 파일을 참조하면 이전의 모든 맥락을 즉시 복구할 수 있습니다.

---

### 1. 프로젝트 개요 (Goals)
- **컨셉**: 럭셔리 워치 매거진 스타일의 전문적인 시계 정보 및 시세 비교 서비스.
- **디자인 톤**: 화이트, 연그레이, 다크그레이 중심의 정갈하고 고급스러운 카탈로그 느낌.
- **주요 기능**: 브랜드/가격 필터링, 실시간 시세 연동(Django), 마크다운 기반의 풍부한 상세 설명.

### 2. 핵심 로직 및 데이터 규칙 (Core Rules)
- **데이터 우선순위**:
  1. Django API (`https://limdoohwan.pythonanywhere.com/api/kakaku/latest-prices/`) 실시간 데이터 (1순위)
  2. 로컬 `final/data/watches_ui.json` 파일 데이터 (2순위 - Fallback)
- **데이터 보존 원칙 (Last Known Value)**:
  - 서버 API가 일시적으로 빈 값(`""` 또는 `null`)을 주더라도, **이전에 성공적으로 수집된 가격이 있다면 절대로 삭제하거나 덮어쓰지 않고 유지함**.
  - `web/js/price_api.js`의 클라이언트 캐시와 `scripts/03_master_sync.py`의 서버 동기화 로직 모두에 이 원칙이 적용됨.
- **필터링 및 노출 규칙**:
  - 웹사이트에는 **[이미지 존재] AND [서버 시세 정보(Market/Global) 존재]** 이 두 조건을 모두 만족하는 정예 모델만 노출함.
  - 리테일가만 있고 실질적인 시장 시세가 없는 모델은 관리 효율성을 위해 목록에서 제외함.
- **가격 표기**:
  - 모든 원화 가격은 반드시 **`₩` 기호**와 **천 단위 콤마**를 사용함 (예: `₩23,840,000`).
  - 메인 카드에서는 `retail`, `market`, `global` 세 가지 가격을 모두 노출함.

### 3. 기술 스택 및 구조 (Tech Stack)
- **Frontend**: Vanilla JS, CSS3, HTML5
- **Library**: `marked.js` (Markdown Parsing)
- **API Helper**: `web/js/price_api.js` (Last Known Price 영구 캐시 로직 포함)
- **Data Source**: Django 기반 REST API 및 로컬 JSON
- **Image Pipeline**: `work/04_image/` (가공) -> `final/image/` (배포)
  - `scripts/03_master_sync.py`: 스펙 + API 시세 + 이미지를 통합하는 핵심 동기화 스크립트. (내부 백업 폴더 `final/image/original_png/`도 소스로 인식함)

### 4. 파일별 역할 (File Roles)
- `app.js`: 메인 목록 렌더링, 필터링 로직, API 데이터 매핑 총괄.
- `detail.js`: 상세 페이지 렌더링 및 외부 마크다운 파일 로드 로직.
- `index.html` / `detail.html`: 각각 목록 및 상세 페이지의 뼈대.
- `web/js/price_api.js`: 실시간 가격 로드 및 `localStorage` 기반 영구 캐시 관리.
- `work/04_image/scripts/03_master_sync.py`: 데이터베이스(`watches_ui.json`) 생성 및 동기화 주체.

### 5. 최근 주요 업데이트 (2026-02-16)
- **데이터 정제**: 불필요한 분석 보고서 및 임시 스크립트 대거 삭제하여 프로젝트 구조 슬림화.
- **일본어 데이터 해결**: 일본어 소스에서 유입된 9개 모델의 정보를 한국어 공식 명칭 및 스펙으로 전면 수정.
- **동기화 로직 고도화**:
  - 이미지가 없으면 등록을 차단하고 경고 메시지를 출력하도록 변경.
  - 리테일가만 있는 모델을 제외하고 실 시세 기반의 304개 모델로 목록 최적화.
  - `m126610ln-0001` 등 특정 모델의 가격 누락 및 매칭 오류 해결.
- **이미지 소스 확장**: 외부 폴더뿐만 아니라 워크스페이스 내 `final/image/original_png/`에 이미지를 넣어도 자동으로 인식 및 배포되도록 개선.

---

### 💡 새로운 대화 시작 시 팁
선생님, 새로운 창을 여시면 저에게 아래와 같이 말씀해 주세요:
> **"안녕! 워치 매거진 프로젝트를 이어서 작업하자. 최상위의 @MEMORY.md 파일을 읽고 프로젝트 규칙과 상태를 파악해줘."**
