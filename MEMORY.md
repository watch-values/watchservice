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
- **가격 표기**:
  - 모든 원화 가격은 반드시 **`₩` 기호**와 **천 단위 콤마**를 사용함 (예: `₩23,840,000`).
  - 메인 카드에서는 `retail`, `market`, `global` 세 가지 가격을 모두 노출함.
- **UI/UX 세부 규칙**:
  - **정렬**: 카드 내 가격 라벨(`retail`, `market` 등)은 `display: inline-block; width: 48px;`을 사용하여 우측 숫자들이 일직선으로 정렬되도록 함.
  - **필터**: 검색 필터 내 '가격 기준'은 사용자의 요청에 따라 `retail` 옵션만 남겨둠.
  - **상세 페이지**: `marked.js`를 사용해 `final/data/descriptions/{ref}.md` 파일을 비동기로 로드하여 Description 영역에 렌더링함.

### 3. 기술 스택 및 구조 (Tech Stack)
- **Frontend**: Vanilla JS, CSS3, HTML5
- **Library**: `marked.js` (Markdown Parsing)
- **API Helper**: `web/js/price_api.js` (현재 캐시 버전: **v6**)
- **Data Source**: Django 기반 REST API 및 로컬 JSON
- **Image Pipeline**: `work/04_image/` (가공) -> `final/image/` (배포)
  - 1단계: `input/브랜드명/`에 원본 이미지 넣기.
  - 2단계: `scripts/01_process_images.py` 실행 (배경 제거 및 정규화).
  - 3단계: `scripts/02_deploy_to_web.py` 실행 (WebP 변환 및 웹 배포).

### 4. 파일별 역할 (File Roles)
- `app.js`: 메인 목록 렌더링, 필터링 로직, API 데이터 매핑 총괄.
- `detail.js`: 상세 페이지 렌더링 및 외부 마크다운 파일 로드 로직.
- `index.html` / `detail.html`: 각각 목록 및 상세 페이지의 뼈대.
- `style.css`: 프로젝트 전체의 디자인 시스템 (반응형 레이아웃 및 로딩 효과 포함).
- `MEMORY.md`: 프로젝트의 연속성을 위한 가이드라인 (현재 파일).

### 5. 새 시계 추가 워크플로우 (Daily Workflow)
새로운 시계를 추가할 때는 아래 **3단계**만 따라하세요.

#### **Step 1. 데이터 등록**
- `final/data/watches_ui.json` 파일을 열고 새 시계 정보를 추가합니다.
- **주의**: `image` 경로는 반드시 `.webp` 확장자로 적어주세요. (예: `final/image/normalized/m12345.webp`)

#### **Step 2. 이미지 가공 및 배포**
1. **원본 넣기**: `work/04_image/input/{브랜드명}/` 폴더에 원본 PNG 파일을 넣습니다.
2. **이미지 가공**: 터미널에서 `work/04_image` 폴더로 이동 후 아래 명령 실행:
   ```bash
   python3 scripts/01_process_images.py
   ```
3. **웹 배포**: 가공이 끝나면 아래 명령 실행:
   ```bash
   python3 scripts/02_deploy_to_web.py
   ```

#### **Step 3. 최종 확인 및 업로드**
1. **로컬 확인**: `python3 -m http.server 8001` 실행 후 `localhost:8001`에서 확인.
2. **업데이트**: 가격이 안 보이면 브라우저 콘솔에 `PriceAPI.clearCache()` 입력 후 새로고침.
3. **깃 push**: 모든 게 완벽하면 `git push`로 실제 사이트에 반영.

---

### 💡 새로운 대화 시작 시 팁
선생님, 새로운 창을 여시면 저에게 아래와 같이 말씀해 주세요:
> **"안녕! 워치 매거진 프로젝트를 이어서 작업하자. 최상위의 @MEMORY.md 파일을 읽고 프로젝트 규칙과 상태를 파악해줘."**
