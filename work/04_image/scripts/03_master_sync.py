import os
import json
import requests
import shutil
from PIL import Image

# ==========================================
# 1. 설정 (Configuration)
# ==========================================
MARKET_API_URL = "https://limdoohwan.pythonanywhere.com/api/market/latest-prices/"
RETAIL_API_URL = "https://limdoohwan.pythonanywhere.com/api/retail/latest-prices/"
SOURCE_IMAGE_DIR = "/Users/doolim/Desktop/watchservice/03_image/processed/01_rolex/step1_normalized"

# Spec Source (AHA!)
SPEC_SOURCES = [
    "/Users/doolim/Desktop/watchservice/02_data/03_Combined_json/01_Rolex/combined.json",
    "/Users/doolim/Desktop/watchservice/02_data/03_Combined_json/02_Tudor/combined.json",
    "/Users/doolim/Desktop/watchservice/02_data/03_Combined_json/03_Omega/combined.json",
    "/Users/doolim/Desktop/watchservice/02_data/03_Combined_json/04_IWC/combined.json"
]

# 결과물이 저장될 위치
OUTPUT_JSON_PATH = "final/data/watches_ui.json"
FINAL_IMAGE_DIR = "final/image/normalized"
BACKUP_IMAGE_DIR = "final/image/original_png"

def fetch_api_data(url):
    try:
        print(f"📡 API 호출 중: {url}")
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        results = data.get('results', [])
        return {str(item['ref_id']).strip().lower(): item for item in results if 'ref_id' in item}
    except Exception as e:
        print(f"❌ API 호출 실패 ({url}): {e}")
        return {}

def load_specs():
    specs = {}
    for path in SPEC_SOURCES:
        if os.path.exists(path):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for item in data:
                        ref = str(item.get('Ref') or item.get('ref', '')).strip().lower()
                        if ref:
                            specs[ref] = item
            except Exception as e:
                print(f"❌ 스펙 로드 실패 ({path}): {e}")
    return specs

def main():
    # 0. 기존 데이터 로드 (Last Known Value 유지를 위해)
    existing_data = {}
    if os.path.exists(OUTPUT_JSON_PATH):
        try:
            with open(OUTPUT_JSON_PATH, 'r', encoding='utf-8') as f:
                raw_data = json.load(f)
                existing_data = {str(item['ref']).strip().lower(): item for item in raw_data if 'ref' in item}
            print(f"📦 기존 데이터 {len(existing_data)}개 로드 완료")
        except Exception as e:
            print(f"⚠️ 기존 데이터 로드 실패: {e}")

    # 1. 데이터 수집
    market_data = fetch_api_data(MARKET_API_URL)
    retail_data = fetch_api_data(RETAIL_API_URL)
    all_specs = load_specs()
    
    # 이미지 파일 수집 (외부 소스 + 내부 백업 폴더 통합)
    image_refs = {}
    if os.path.exists(SOURCE_IMAGE_DIR):
        for f in os.listdir(SOURCE_IMAGE_DIR):
            if f.lower().endswith(".png"):
                ref_name = os.path.splitext(f)[0].strip().lower()
                image_refs[ref_name] = os.path.join(SOURCE_IMAGE_DIR, f)
    
    if os.path.exists(BACKUP_IMAGE_DIR):
        for f in os.listdir(BACKUP_IMAGE_DIR):
            if f.lower().endswith(".png"):
                ref_name = os.path.splitext(f)[0].strip().lower()
                if ref_name not in image_refs:
                    image_refs[ref_name] = os.path.join(BACKUP_IMAGE_DIR, f)
                    print(f"ℹ️ 내부 폴더에서 이미지 발견: {f}")

    print(f"\n--- 데이터 수집 결과 ---")
    print(f"- 마켓 시세 API: {len(market_data)}개")
    print(f"- 리테일가 API: {len(retail_data)}개")
    print(f"- 스펙 데이터: {len(all_specs)}개")
    print(f"- 통합 이미지 파일: {len(image_refs)}개")

    # 2. Matching (이미지 파일이 있는 모델만 대상으로 함)
    all_refs = sorted(list(image_refs.keys()))
    
    final_watches = []
    
    # 서버 데이터 중 이미지가 없는 모델 파악을 위한 집합
    api_refs = set(market_data.keys()) | set(retail_data.keys())
    
    print(f"\n--- 통합 및 변환 시작 ---")
    
    # 서버에는 있지만 이미지가 없는 모델 메시지 출력
    for api_ref in sorted(list(api_refs)):
        if api_ref not in image_refs:
            print(f"⚠️ {api_ref}: 이미지가 없어서 등록을 할 수 없습니다.")

    # 폴더 생성
    for d in [FINAL_IMAGE_DIR, BACKUP_IMAGE_DIR, os.path.dirname(OUTPUT_JSON_PATH)]:
        if d and not os.path.exists(d):
            os.makedirs(d)

    for ref in all_refs:
        spec = all_specs.get(ref, {})
        m_item = market_data.get(ref, {})
        img_name = image_refs[ref]
        
        # 기존 데이터 (Last Known Value)
        old_item = existing_data.get(ref, {})
        
        # 기본 정보 구성
        brand = spec.get('brand') or old_item.get('brand') or 'Rolex'
        name = spec.get('line', '') or spec.get('model', '') or old_item.get('name') or "Watch"
        
        # 스펙 필드 업데이트 (새 데이터가 없으면 기존 데이터 유지)
        def get_field(field_name, new_val, default='N/A'):
            if new_val and new_val != 'N/A':
                return new_val
            return old_item.get(field_name) or default

        watch_obj = {
            "ref": ref,
            "brand": brand,
            "name": name,
            "material": get_field('material', spec.get('material'), 'steel'),
            "dial_color": get_field('dial_color', spec.get('dial_color')),
            "size": get_field('size', spec.get('size')),
            "thickness": get_field('thickness', spec.get('thickness')),
            "water_resistance": get_field('water_resistance', spec.get('water proof')),
            "movement": get_field('movement', spec.get('movement')),
            "power_reserve": get_field('power_reserve', spec.get('power_reserve')),
            "description": old_item.get('description') or f"<p>{brand} {name} {ref} 모델입니다.</p>",
            "prices": {
                "retail": {
                    "display": "N/A",
                    "value": None
                }
            },
            "image": f"final/image/normalized/{ref}.webp",
            "ext_krw_domestic_display": "N/A",
            "ext_krw_domestic": None,
            "ext_krw_asia_display": "N/A",
            "ext_krw_asia": None,
            "ext_local_market_display": "N/A",
            "ext_local_market": None,
            "ext_recorded_at": None
        }

        # [필터링 로직 엄격 적용]
        # 서버 마켓 시세 API에 실제 데이터가 있는 모델만 등록합니다.
        # (로컬 JSON에서는 가격을 비우더라도, 등록 대상 선정은 서버 데이터를 기준으로 함)
        has_server_market_info = m_item.get("price", {}).get("krw_domestic") or m_item.get("price", {}).get("krw_asia") or m_item.get("price", {}).get("local_market")
        
        if has_server_market_info:
            final_watches.append(watch_obj)
        else:
            # 서버에 시세 정보가 없는 모델은 등록하지 않습니다.
            continue

        # 이미지 처리 (PNG -> WebP)
        dest_path = os.path.join(FINAL_IMAGE_DIR, f"{ref}.webp")
        if not os.path.exists(dest_path):
            if os.path.abspath(os.path.dirname(image_refs[ref])) != os.path.abspath(BACKUP_IMAGE_DIR):
                shutil.copy2(image_refs[ref], os.path.join(BACKUP_IMAGE_DIR, os.path.basename(image_refs[ref])))
            
            try:
                with Image.open(image_refs[ref]) as img:
                    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                        bg = Image.new("RGB", img.size, (255, 255, 255))
                        if img.mode == "P": img = img.convert("RGBA")
                        bg.paste(img, mask=img.split()[3])
                        img = bg
                    else:
                        img = img.convert("RGB")
                    img.save(dest_path, "WEBP", quality=80)
            except Exception as e:
                print(f"❌ 이미지 변환 실패 ({ref}): {e}")

    # 4. JSON 저장
    with open(OUTPUT_JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(final_watches, f, indent=2, ensure_ascii=False)

    print(f"\n🚀 모든 작업이 완료되었습니다!")
    print(f"- 최종 생성된 모델 수: {len(final_watches)}개")
    print(f"- JSON 위치: {OUTPUT_JSON_PATH}")
    print(f"- 가격 정보는 모두 비워졌으며, 실시간 API를 통해서만 로드됩니다.")

if __name__ == "__main__":
    main()
