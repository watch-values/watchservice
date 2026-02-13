"""
범용 이미지 전처리 파이프라인
input/ 폴더 내의 브랜드별 폴더를 자동으로 탐색하여 STEP 1 ~ STEP 3을 순서대로 실행합니다.
"""

from PIL import Image, ImageFilter
from rembg import remove
import os
import glob
import json

# ============================================================
# 브랜드별 황금 비율 설정
# ============================================================
BRAND_RATIOS = {
    'rolex': 1.0,
    'omega': 0.65,
    'tudor': 0.67,
    'iwc': 0.67,
    'default': 0.67
}

# ============================================================
# 공통 함수
# ============================================================

def get_non_transparent_bbox(image):
    """이미지에서 투명하지 않은 영역의 bounding box를 찾습니다."""
    if image.mode != 'RGBA':
        width, height = image.size
        return (0, 0, width, height)
    
    pixels = image.load()
    width, height = image.size
    
    min_x, min_y = width, height
    max_x, max_y = 0, 0
    found_pixel = False
    
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a > 0:
                found_pixel = True
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    
    if not found_pixel:
        return None
    
    return (min_x, min_y, max_x + 1, max_y + 1)

def cleanup_alpha_edges(image):
    """알파 가장자리를 클린업하여 halo 효과를 방지합니다."""
    alpha = image.split()[3]
    alpha_blurred = alpha.filter(ImageFilter.GaussianBlur(radius=0.5))
    
    pixels = image.load()
    alpha_pixels = alpha_blurred.load()
    width, height = image.size
    
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            blurred_alpha = alpha_pixels[x, y]
            if a < 255:
                new_alpha = min(255, blurred_alpha)
                pixels[x, y] = (r, g, b, int(new_alpha))
    
    return image

def cleanup_transparent_pixels(image):
    """완전 투명한 픽셀의 RGB 값을 제거합니다."""
    pixels = image.load()
    width, height = image.size
    
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                pixels[x, y] = (0, 0, 0, 0)
    
    return image

# ============================================================
# STEP 1: 크기 정규화
# ============================================================

def normalize_step1(input_path, output_path, max_ratio):
    """이미지를 배경 제거 및 정규화하여 저장합니다."""
    try:
        img = Image.open(input_path)
        
        # [추가] 배경 제거 수행 (rembg)
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        img = remove(img)
        
        bbox = get_non_transparent_bbox(img)
        if bbox is None:
            return
        
        left, top, right, bottom = bbox
        bbox_width = right - left
        bbox_height = bottom - top
        
        cropped_img = img.crop((left, top, right, bottom))
        
        canvas_size = 1200
        current_ratio = bbox_height / canvas_size
        
        if current_ratio > max_ratio:
            scale_ratio = max_ratio / current_ratio
        else:
            scale_ratio = 1.0
        
        if scale_ratio < 1.0:
            new_width = int(bbox_width * scale_ratio)
            new_height = int(bbox_height * scale_ratio)
            resized_img = cropped_img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        else:
            resized_img = cropped_img
        
        final_width, final_height = resized_img.size
        canvas = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
        
        x_offset = (canvas_size - final_width) // 2
        y_offset = (canvas_size - final_height) // 2
        
        canvas.paste(resized_img, (x_offset, y_offset), resized_img)
        canvas = cleanup_alpha_edges(canvas)
        canvas.save(output_path, 'PNG')
        
    except Exception as e:
        print(f"오류 (STEP1) {os.path.basename(input_path)}: {e}")

# ============================================================
# STEP 2: 다이얼 중심 정렬
# ============================================================

def normalize_step2(input_path, output_path):
    """다이얼 중심을 캔버스 중앙에 정렬합니다."""
    try:
        img = Image.open(input_path)
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        bbox = get_non_transparent_bbox(img)
        if bbox is None:
            return
        
        left, top, right, bottom = bbox
        bbox_height = bottom - top
        bbox_center_y_in_image = top + (bbox_height / 2)
        
        canvas_size = 1200
        canvas_center_y = canvas_size / 2
        img_width, img_height = img.size
        
        y_offset = int(canvas_center_y - bbox_center_y_in_image)
        
        canvas = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
        x_offset = (canvas_size - img_width) // 2
        
        canvas.paste(img, (x_offset, y_offset), img)
        canvas = cleanup_transparent_pixels(canvas)
        canvas.save(output_path, 'PNG')
        
    except Exception as e:
        print(f"오류 (STEP2) {os.path.basename(input_path)}: {e}")

# ============================================================
# STEP 3: Safe Area 메타데이터 생성
# ============================================================

def generate_safe_area(input_path, output_path):
    """Safe Area 메타데이터 JSON을 생성합니다."""
    try:
        img = Image.open(input_path)
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        filename = os.path.basename(input_path)
        ref = os.path.splitext(filename)[0]
        
        bbox = get_non_transparent_bbox(img)
        if bbox is None:
            return
        
        left, top, right, bottom = bbox
        bbox_x, bbox_y = left, top
        bbox_w, bbox_h = right - left, bottom - top
        
        canvas_size = 1200
        margin_x = bbox_w * 0.07
        margin_y = bbox_h * 0.12
        
        safe_x = max(0, bbox_x - margin_x)
        safe_y = max(0, bbox_y - margin_y)
        safe_end_x = min(canvas_size, bbox_x + bbox_w + margin_x)
        safe_end_y = min(canvas_size, bbox_y + bbox_h + margin_y)
        
        metadata = {
            "ref": ref,
            "canvas": [canvas_size, canvas_size],
            "bbox": [round(bbox_x), round(bbox_y), round(bbox_w), round(bbox_h)],
            "safe_area": [round(safe_x), round(safe_y), round(safe_end_x - safe_x), round(safe_end_y - safe_y)]
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        
    except Exception as e:
        print(f"오류 (STEP3) {os.path.basename(input_path)}: {e}")

# ============================================================
# 메인 함수
# ============================================================

def process_brand(brand_name):
    """특정 브랜드 폴더의 이미지를 처리합니다."""
    brand_lower = brand_name.lower()
    max_ratio = BRAND_RATIOS.get(brand_lower, BRAND_RATIOS['default'])
    
    input_dir = f"input/{brand_name}"
    output_base = f"processed/{brand_name}"
    step1_dir = f"{output_base}/step1_normalized"
    step2_dir = f"{output_base}/step2_aligned"
    metadata_dir = f"{output_base}/metadata"
    
    # 폴더 생성
    for d in [step1_dir, step2_dir, metadata_dir]:
        os.makedirs(d, exist_ok=True)
    
    # 이미지 파일 목록 (PNG, JPG, JPEG 지원)
    extensions = ['*.png', '*.PNG', '*.jpg', '*.JPG', '*.jpeg', '*.JPEG']
    image_files = []
    for ext in extensions:
        image_files.extend(glob.glob(os.path.join(input_dir, ext)))
    
    image_files = sorted(list(set(image_files)))
    
    if not image_files:
        print(f"[{brand_name.upper()}] 처리할 이미지가 없습니다.")
        return
    
    print(f"\n[{brand_name.upper()}] 처리 시작 (총 {len(image_files)}개, 비율: {max_ratio})")
    print("-" * 40)
    
    for i, path in enumerate(image_files):
        # 출력 파일명 생성 (무조건 .png로 저장)
        filename = os.path.basename(path)
        name_without_ext = os.path.splitext(filename)[0]
        output_filename = f"{name_without_ext}.png"
        
        # STEP 1
        s1_path = os.path.join(step1_dir, output_filename)
        normalize_step1(path, s1_path, max_ratio)
        
        # STEP 2
        s2_path = os.path.join(step2_dir, output_filename)
        normalize_step2(s1_path, s2_path)
        
        # STEP 3
        meta_path = os.path.join(metadata_dir, f"{name_without_ext}.json")
        generate_safe_area(s2_path, meta_path)
        
        if (i + 1) % 10 == 0 or (i + 1) == len(image_files):
            print(f"  > {i + 1}/{len(image_files)} 완료...")

def main():
    """input 폴더 내의 모든 브랜드 폴더를 탐색하여 처리합니다."""
    import sys
    
    # 명령행 인자가 있으면 해당 브랜드만 처리
    if len(sys.argv) > 1:
        target_brand = sys.argv[1]
        process_brand(target_brand)
        return

    input_base = "input"
    if not os.path.exists(input_base):
        print("input 폴더가 존재하지 않습니다.")
        return
    
    # input 폴더 내의 하위 디렉토리 목록 (브랜드별 폴더)
    brands = [d for d in os.listdir(input_base) if os.path.isdir(os.path.join(input_base, d))]
    
    if not brands:
        print("처리할 브랜드 폴더가 없습니다.")
        return
    
    print("=" * 60)
    print("전체 브랜드 이미지 전처리 파이프라인 가동")
    print("=" * 60)
    
    for brand in sorted(brands):
        process_brand(brand)
    
    print("\n" + "=" * 60)
    print("모든 브랜드 처리 완료! 결과는 'processed/' 폴더를 확인하세요.")
    print("=" * 60)

if __name__ == "__main__":
    main()

