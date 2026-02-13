import os
import shutil
import glob
from PIL import Image

def sync_to_final(processed_root, original_png_dir, normalized_webp_dir, quality=80):
    """
    Syncs processed images from work folder to final web asset folders.
    Searches for PNGs in any 'step2_aligned' subfolders.
    """
    # Create directories if they don't exist
    for d in [original_png_dir, normalized_webp_dir]:
        if not os.path.exists(d):
            os.makedirs(d)
    
    # [수정] 모든 하위 폴더에서 step2_aligned 폴더 내의 PNG 파일을 찾습니다.
    search_pattern = os.path.join(processed_root, "**", "step2_aligned", "*.png")
    png_paths = glob.glob(search_pattern, recursive=True)
    
    if not png_paths:
        print(f"No PNG files found in {processed_root}/**/step2_aligned/")
        print("Please run 01_process_images.py first.")
        return

    print(f"Found {len(png_paths)} processed files to sync...")

    applied_count = 0
    for src_path in png_paths:
        filename = os.path.basename(src_path)
        basename = os.path.splitext(filename)[0]
        
        # 1. Copy to original_png (Backup)
        backup_path = os.path.join(original_png_dir, filename)
        shutil.copy2(src_path, backup_path)
        
        # 2. Convert to WebP (Optimized)
        dest_path = os.path.join(normalized_webp_dir, f"{basename}.webp")
        try:
            with Image.open(src_path) as img:
                # Convert RGBA to RGB with white background
                if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                    background = Image.new("RGB", img.size, (255, 255, 255))
                    if img.mode == "P":
                        img = img.convert("RGBA")
                    background.paste(img, mask=img.split()[3])
                    img = background
                else:
                    img = img.convert("RGB")
                
                img.save(dest_path, "WEBP", quality=quality)
                print(f"  [Success] {filename} -> WebP & Backup done.")
                applied_count += 1
        except Exception as e:
            print(f"  [Error] Failed to convert {filename}: {e}")

    print(f"\nSync complete. {applied_count} assets are ready for the web.")

if __name__ == "__main__":
    # Path configuration
    # This script is in work/04_image/scripts/
    CURRENT_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
    BASE_DIR = os.path.dirname(CURRENT_SCRIPT_DIR) # work/04_image
    PROCESSED_ROOT = os.path.join(BASE_DIR, "processed")
    
    ROOT_DIR = os.path.dirname(os.path.dirname(BASE_DIR)) # Project Root
    FINAL_ORIGINAL = os.path.join(ROOT_DIR, "final", "image", "original_png")
    FINAL_NORMALIZED = os.path.join(ROOT_DIR, "final", "image", "normalized")

    sync_to_final(PROCESSED_ROOT, FINAL_ORIGINAL, FINAL_NORMALIZED)
