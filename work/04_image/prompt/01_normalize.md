# Prompt: Image Normalize Step1

## 목적
시계 이미지를 카드 UI에 맞게 정규화한다.

## 대상
- input: raw_images/
- output: normalized/step1/

## 요구사항
- 배경색 통일
- 시계 본체 훼손 금지
- ref 기준 파일명 유지
- 정사각 비율

## Cursor에게 전달할 프롬프트
---
너는 Python 이미지 처리 전문가다.
다음 조건을 만족하는 스크립트를 작성하라.

1. input 폴더의 모든 jpg/png 파일을 순회
2. 시계 본체를 감싸는 bounding box 추정
3. 중앙 정렬
4. 정사각 캔버스 생성
5. output/step1 폴더에 저장
---
