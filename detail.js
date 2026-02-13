const detailEl = document.getElementById("detail");
const params = new URLSearchParams(location.search);
const ref = params.get("ref");

// 스펙 행 생성 함수 (값이 있을 때만 렌더링)
function createSpecRow(label, value) {
  if (!value) return "";
  return `
    <div class="spec-row">
      <span class="spec-label">${label}</span>
      <span class="spec-value">${value}</span>
    </div>
  `;
}

// 외부 설명 파일 가져오기 함수
async function fetchDescription(ref) {
  try {
    const response = await fetch(`final/data/descriptions/${ref}.md`);
    if (response.ok) {
      const text = await response.text();
      // marked 라이브러리를 사용하여 마크다운을 HTML로 변환
      return marked.parse(text);
    }
  } catch (error) {
    console.log("External description not found or failed to load:", error);
  }
  return null;
}

function formatRecordedAt(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

// 초기 데이터 로드 (JSON 캐시 버스팅 적용)
fetch(`final/data/watches_ui.json?v=${new Date().getTime()}`)
  .then(r => r.json())
  .then(async list => {
    // 1. 먼저 정적 데이터로 렌더링 (글로벌 가격은 로딩 중 표시)
    renderInitial(list);

    // 2. 최신 API 가격 로드 (비동기)
    try {
      // 마켓 시세와 리테일가 병렬 로드
      const [marketData, retailData] = await Promise.all([
        window.PriceAPI?.loadLatestPrices?.() ?? Promise.resolve(null),
        window.PriceAPI?.loadRetailPrices?.() ?? Promise.resolve(null)
      ]);

      if (marketData) {
        const marketMap = window.PriceAPI.buildPriceMap(marketData);
        window.PriceAPI.applyPricesToWatches(list, marketMap);
      }

      if (retailData) {
        const retailMap = window.PriceAPI.buildPriceMap(retailData);
        window.PriceAPI.applyPricesToWatches(list, retailMap);
      }
      
      // 3. API 데이터 반영하여 다시 렌더링
      renderInitial(list);
    } catch (err) {
      console.error("Dynamic price load failed:", err);
    }
  })
  .catch(err => {
    console.error("Data load failed:", err);
    detailEl.innerHTML = `<p style="text-align:center; padding: 50px;">데이터를 불러오는 중 오류가 발생했습니다.</p>`;
  });

async function renderInitial(list) {
  const watch = list.find(w => w.ref === ref);

  if (!watch) {
    detailEl.innerHTML = `
      <div class="detail-container" style="justify-content: center; padding: 100px 0;">
        <p style="color: #888;">해당 상품을 찾을 수 없습니다. (Ref: ${ref ?? "N/A"})</p>
      </div>
    `;
    return;
  }

  // 외부 설명 파일이 있는지 확인하고 가져옴
  const externalDesc = await fetchDescription(watch.ref);

  // 기본 이미지 처리
  const imageUrl = watch.image || "final/image/no-image.webp";

  detailEl.innerHTML = `
    <div class="detail-container">
      <div class="detail-visual">
        <img src="${imageUrl}" alt="${watch.brand} ${watch.name}" onerror="this.src='https://via.placeholder.com/600x600?text=No+Image'">
      </div>
      
      <div class="detail-info">
        <header class="detail-header">
          <div class="brand">${watch.brand}</div>
          <h2 class="name">${watch.name}</h2>
        </header>

        <div class="spec-table">
          ${createSpecRow("Reference", watch.ref)}
          ${createSpecRow("Size", watch.size)}
          ${createSpecRow("Material", watch.material)}
          ${createSpecRow("Dial Color", watch.dial_color)}
          ${createSpecRow("Thickness", watch.thickness)}
          ${createSpecRow("Water Resistance", watch.water_resistance)}
          ${createSpecRow("Movement", watch.movement)}
          ${createSpecRow("Power Reserve", watch.power_reserve)}
        </div>

        <div class="price-section">
          <div class="price-item">
            <span class="spec-label">Retail Price</span>
            <span class="spec-value">${watch.prices?.retail?.display || '<span class="loading-shimmer">₩00,000,000</span>'}</span>
          </div>
          <div class="price-item">
            <span class="spec-label">Global Market</span>
            <span class="spec-value">${watch.ext_krw_asia_display || (watch.prices?.global_market?.display ? `<span class="loading-shimmer">${watch.prices.global_market.display}</span>` : '<span class="loading-shimmer">₩00,000,000</span>')}</span>
          </div>
          <div class="price-item">
            <span class="spec-label" style="font-style: normal; font-weight: bold; color: #222;">Korea Market</span>
            <span class="spec-value" style="font-weight: bold; color: #e44d26;">${watch.ext_krw_domestic_display || (watch.prices?.korea_market?.display ? `<span class="loading-shimmer">${watch.prices.korea_market.display}</span>` : '<span class="loading-shimmer">₩00,000,000</span>')}</span>
          </div>
          ${
            watch.ext_recorded_at
              ? `<div style="margin-top: 8px; font-size: 12px; color: #777;">
                   업데이트: ${formatRecordedAt(watch.ext_recorded_at) || watch.ext_recorded_at}
                 </div>`
              : ""
          }
        </div>
      </div>

      <div class="detail-description">
        <h3>Description</h3>
        <div class="description-content">
          ${externalDesc || watch.description || `
            <p>
              이 모델은 ${watch.brand}의 장인 정신과 혁신적인 기술력이 집약된 타임피스입니다. 
              ${watch.size || ""}의 ${watch.material || ""} 케이스와 정교하게 마감된 ${watch.dial_color || ""} 다이얼은 
              시간이 흘러도 변치 않는 클래식한 아름다움을 선사합니다. 
              전문가들의 엄격한 검수를 거친 정밀한 무브먼트는 최상의 성능을 보장하며, 
              수집가들 사이에서 높은 가치를 인정받는 모델입니다.
            </p>
          `}
        </div>
      </div>
    </div>
  `;
}
