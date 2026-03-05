# 📔 Django 이미지 서버(Media) 연동 트러블슈팅 가이드

본 문서는 Django 기반의 시계 이미지 관리 시스템을 운영하며 발생할 수 있는 주요 문제와 해결 방법을 정리한 가이드입니다.

---

## 1. 문제 상황: "이미지가 GitHub 주소로만 나옴"
서버에 이미지를 올렸음에도 웹사이트에서 여전히 GitHub 주소의 이미지를 불러오거나, API 결과에서 `image_url`이 비어있는 현상.

### ✅ 해결 단계 1: 서버 DB와 이미지 파일 연결
이미지 파일이 서버 폴더에 물리적으로 존재하는 것과, Django 데이터베이스(DB)가 그 파일을 인지하는 것은 별개입니다.
*   **원인**: DB의 `image` 필드가 비어있음.
*   **해결**: 서버 터미널에서 **이미지 매칭 스크립트**를 실행하여 파일과 DB를 연결합니다.
    ```bash
    # PythonAnywhere 터미널에서 실행
    source venv/bin/activate
    python upload_images_to_media.py "/home/limdoohwan/django_app/media/watches"
    ```

### ✅ 해결 단계 2: DB 구조 업데이트 (Migration)
스크립트 실행 시 `'Watch' object has no attribute 'image'` 에러가 난다면 DB에 이미지 칸 자체가 없는 것입니다.
*   **원인**: `models.py` 수정 후 마이그레이션이 서버에 반영되지 않음.
*   **해결**: 로컬의 `migrations` 폴더를 서버로 복사한 뒤 아래 명령어를 실행합니다.
    ```bash
    python manage.py migrate
    ```

---

## 2. 문제 상황: "Something went wrong (서버 다운)"
`settings.py` 수정 후 PythonAnywhere 웹사이트 접속 시 에러 페이지가 뜨는 현상.

### ✅ 해결 단계: 필수 라이브러리 Import 확인
*   **원인**: `os.path.join` 함수를 사용하면서 파일 상단에 `import os` 선언을 누락한 경우.
*   **에러 로그**: `NameError: name 'os' is not defined` 문구 확인.
*   **해결**: `settings.py` 맨 윗부분에 아래 코드를 반드시 추가합니다.
    ```python
    import os
    from pathlib import Path
    ```

---

## 3. 문제 상황: "이미지 주소에 /media/ 가 빠짐"
API 결과에 주소는 나오지만 `https://도메인/watches/m123.webp` 처럼 중간 경로가 빠져 이미지가 깨지는 경우.

### ✅ 해결 단계: MEDIA_URL 설정 확인
*   **원인**: `MEDIA_URL` 설정이 `/`로 되어 있거나 누락됨.
*   **해결**: `settings.py` 하단에 경로 설정을 정확히 수정합니다.
    ```python
    MEDIA_URL = '/media/'
    MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
    ```

---

## 4. 문제 상황: "API 결과에 이미지 주소 도메인이 빠짐"
API가 `/media/watches/...` 처럼 상대 경로만 보내주어 외부 사이트에서 이미지를 불러오지 못하는 경우.

### ✅ 해결 단계: views.py 직렬화 로직 수정
*   **해결**: `views.py`의 데이터를 JSON으로 변환하는 부분에서 도메인을 강제로 결합합니다.
    ```python
    if w.image:
        image_url = "https://limdoohwan.pythonanywhere.com" + w.image.url
    ```

---

## 💡 최종 점검 리스트 (필수!)
모든 수정 사항을 적용한 후에는 반드시 다음 **두 가지**를 수행해야 실제 웹사이트에 반영됩니다.

1.  **PythonAnywhere Web 탭**: 초록색 **[Reload]** 버튼 클릭 (서버 코드 반영)
2.  **브라우저(크롬 등)**: **강력 새로고침** (`Cmd + Shift + R` 또는 `Ctrl + F5`) (프론트엔드 캐시 삭제)
