const grid = document.getElementById("grid");
const brandFilter = document.getElementById("brandFilter");
const searchInput = document.getElementById("searchInput");
const minPriceInput = document.getElementById("minPrice");
const maxPriceInput = document.getElementById("maxPrice");
const resetBtn = document.getElementById("resetFilter");
const resultCountEl = document.getElementById("resultCount");
const sortFilter = document.getElementById("sortFilter");
const priceBasisEl = document.getElementById("priceBasis");
const filterSummaryContainer = document.getElementById("filterSummaryContainer");
const filterSummaryText = document.getElementById("filterSummaryText");
const chipGroup = document.getElementById("chipGroup");

let allWatches = [];
let filteredWatches = [];
let currentPage = 1;
const pageSize = 24;

// 숫자 추출 (쉼표 제거 및 정수 변환)
function parsePrice(val) {
  if (!val) return null;
  const num = parseInt(val.toString().replace(/[^0-9]/g, ""), 10);
  return isNaN(num) ? null : num;
}

// 쉼표 추가 포맷팅
function formatNumber(num) {
  if (num === null || num === undefined) return "";
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function render(list) {
  filteredWatches = list;
  currentPage = 1;
  renderCurrentPage();
}

function renderCurrentPage() {
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = filteredWatches.slice(start, end);

  if (resultCountEl) {
    resultCountEl.textContent = `검색결과 총 ${filteredWatches.length}개 (페이지 ${currentPage})`;
  }
  
  grid.innerHTML = pageItems.map(watch => `
    <a href="./detail.html?ref=${encodeURIComponent(watch.ref)}" style="text-decoration:none; color:inherit;">
      <article class="card">
        <div class="thumb">
          <img src="${watch.image}" alt="${watch.brand} ${watch.name}" onerror="this.src='https://via.placeholder.com/220x220?text=No+Image'">
        </div>
        <div class="meta">
          <div class="brand">${watch.brand}</div>
          <div class="name">${watch.name} <span style="font-size: 11px; font-weight: normal; color: #888; margin-left: 4px;">(${watch.size}, ${watch.material})</span></div>
          <div class="price"><span style="display: inline-block; width: 48px; color: #888;">retail</span>${watch.prices?.retail?.display || 'N/A'}</div>
          <div class="price" style="margin-top: 2px;"><span style="display: inline-block; width: 48px; color: #888;">market</span>${watch.ext_local_market_display || 'N/A'}</div>
          <div class="price" style="margin-top: 2px;"><span style="display: inline-block; width: 48px; color: #888;">global</span>${watch.ext_krw_asia_display || 'N/A'}</div>
        </div>
      </article>
    </a>
  `).join("");

  updatePaginationUI();
  window.scrollTo(0, 0);
}

function updatePaginationUI() {
  const totalPages = Math.ceil(filteredWatches.length / pageSize);
  const prevBtn = document.getElementById("prevPage");
  const nextBtn = document.getElementById("nextPage");
  const pageInfo = document.getElementById("pageInfo");

  if (prevBtn && nextBtn && pageInfo) {
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages || totalPages === 0;
    pageInfo.textContent = totalPages === 0 ? "0 / 0" : `${currentPage} / ${totalPages}`;
  }
}

function getPriceValueByBasis(watch, basis) {
  if (!watch) return null;

  const retail = watch.prices?.retail?.value ?? null;
  const domestic = watch.ext_krw_domestic ?? null;
  const localMarket = watch.ext_local_market ?? null;
  const asia = watch.ext_krw_asia ?? null;

  switch (basis) {
    case "RETAIL":
      return retail;
    case "MARKET":
      return localMarket ?? domestic;
    case "GLOBAL":
      return asia;
    case "AUTO":
    default:
      return localMarket ?? domestic ?? asia ?? retail;
  }
}

function compareNullableNumbers(a, b, direction /* 'asc'|'desc' */) {
  const aNull = a === null || a === undefined || Number.isNaN(a);
  const bNull = b === null || b === undefined || Number.isNaN(b);
  if (aNull && bNull) return 0;
  if (aNull) return 1; // nulls last
  if (bNull) return -1;

  return direction === "asc" ? a - b : b - a;
}

function applyFilter() {
  const brandValue = brandFilter.value;
  const searchText = searchInput.value.toLowerCase().trim();
  const minPrice = parsePrice(minPriceInput.value);
  const maxPrice = parsePrice(maxPriceInput.value);
  const sortValue = sortFilter.value;
  const priceBasis = priceBasisEl ? priceBasisEl.value : "RETAIL";

  const filtered = allWatches.filter(watch => {
    // 1. 브랜드 필터
    const matchBrand = (brandValue === "ALL") || (watch.brand === brandValue);
    
    // 2. 검색어 필터 (브랜드명, 모델명, 레퍼런스 번호 포함)
    const searchTarget = `${watch.brand} ${watch.name} ${watch.ref}`.toLowerCase();
    const matchSearch = !searchText || searchTarget.includes(searchText);

    // 3. 서버 정보 필터 (글로벌 시세가 있는 모델만 출력)
    // ext_recorded_at이 있거나, 이미 ext_krw_domestic_display 또는 ext_krw_asia_display 값이 있는 경우 출력 대상
    const hasPriceInfo = (watch.ext_krw_domestic_display && watch.ext_krw_domestic_display !== "N/A") || 
                         (watch.ext_krw_asia_display && watch.ext_krw_asia_display !== "N/A") ||
                         !!watch.ext_recorded_at;

    // 4. 가격 필터 (선택한 기준)
    const price = getPriceValueByBasis(watch, priceBasis);
    
    let matchPrice = true;
    if (price !== null) {
      if (minPrice !== null && price < minPrice) matchPrice = false;
      if (maxPrice !== null && price > maxPrice) matchPrice = false;
    } else {
      // 가격 정보가 아예 없는 경우 필터 입력이 있으면 제외
      if (minPrice !== null || maxPrice !== null) matchPrice = false;
    }

    return matchBrand && matchSearch && hasPriceInfo && matchPrice;
  });

  // 3. 정렬 (공식판매가 기준)
  if (sortValue !== "NONE") {
    filtered.sort((a, b) => {
      const pA = getPriceValueByBasis(a, priceBasis);
      const pB = getPriceValueByBasis(b, priceBasis);
      return sortValue === "LOW_PRICE"
        ? compareNullableNumbers(pA, pB, "asc")
        : compareNullableNumbers(pA, pB, "desc");
    });
  }

  render(filtered);
  updateFilterSummaryAndChips();
}

function updateFilterSummaryAndChips() {
  const brandValue = brandFilter.value;
  const searchText = searchInput.value.trim();
  const minPriceRaw = minPriceInput.value;
  const maxPriceRaw = maxPriceInput.value;

  const summaryParts = [];
  const chips = [];

  if (searchText) {
    summaryParts.push(`검색어 "${searchText}"`);
    chips.push({ label: `검색어: ${searchText}`, type: 'search' });
  }

  if (brandValue !== "ALL") {
    summaryParts.push(`브랜드 ${brandValue}`);
    chips.push({ label: `브랜드: ${brandValue}`, type: 'brand' });
  }

  if (minPriceRaw && maxPriceRaw) {
    summaryParts.push(`가격 ₩${minPriceRaw} ~ ₩${maxPriceRaw}`);
  } else if (minPriceRaw) {
    summaryParts.push(`가격 ₩${minPriceRaw} 이상`);
  } else if (maxPriceRaw) {
    summaryParts.push(`가격 ₩${maxPriceRaw} 이하`);
  }

  if (minPriceRaw) {
    chips.push({ label: `최소가: ${minPriceRaw}`, type: 'min' });
  }

  if (maxPriceRaw) {
    chips.push({ label: `최대가: ${maxPriceRaw}`, type: 'max' });
  }

  if (chips.length > 0) {
    filterSummaryContainer.style.display = "block";
    filterSummaryText.textContent = `적용 중: ${summaryParts.join(" · ")}`;
    chipGroup.innerHTML = chips.map(chip => `
      <div class="chip">
        <span>${chip.label}</span>
        <span class="chip-remove" onclick="window.removeFilter('${chip.type}')">✕</span>
      </div>
    `).join("");
  } else {
    filterSummaryContainer.style.display = "none";
  }
}

// 필터 제거 기능을 window 객체에 할당하여 전역에서 접근 가능하게 함
window.removeFilter = function(type) {
  if (type === 'search') searchInput.value = "";
  if (type === 'brand') brandFilter.value = "ALL";
  if (type === 'min') minPriceInput.value = "";
  if (type === 'max') maxPriceInput.value = "";
  applyFilter();
};

// 입력 시 콤마 자동 처리
function handlePriceInput(e) {
  const rawValue = e.target.value.replace(/[^0-9]/g, "");
  const formattedValue = formatNumber(rawValue);
  e.target.value = formattedValue;
  applyFilter();
}

// 초기 데이터 로드 (JSON 캐시 버스팅 적용)
fetch(`final/data/watches_ui.json?v=${new Date().getTime()}`)
  .then(r => r.json())
  .then(async watches => {
    allWatches = watches;

    // 브랜드 목록 만들기
    const brands = Array.from(new Set(watches.map(w => w.brand))).sort();
    brands.forEach(b => {
      const opt = document.createElement("option");
      opt.value = b;
      opt.textContent = b;
      brandFilter.appendChild(opt);
    });

    // 이벤트 리스너
    brandFilter.addEventListener("change", applyFilter);
    searchInput.addEventListener("input", applyFilter);
    sortFilter.addEventListener("change", applyFilter);
    if (priceBasisEl) priceBasisEl.addEventListener("change", applyFilter);
    minPriceInput.addEventListener("input", handlePriceInput);
    maxPriceInput.addEventListener("input", handlePriceInput);
    
    resetBtn.addEventListener("click", () => {
      brandFilter.value = "ALL";
      searchInput.value = "";
      sortFilter.value = "NONE";
      if (priceBasisEl) priceBasisEl.value = "RETAIL";
      minPriceInput.value = "";
      maxPriceInput.value = "";
      applyFilter();
    });

    const prevBtn = document.getElementById("prevPage");
    const nextBtn = document.getElementById("nextPage");

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        if (currentPage > 1) {
          currentPage--;
          renderCurrentPage();
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        const totalPages = Math.ceil(filteredWatches.length / pageSize);
        if (currentPage < totalPages) {
          currentPage++;
          renderCurrentPage();
        }
      });
    }

    // 1. 먼저 정적 데이터로 렌더링 (글로벌 가격은 로딩 중 표시됨)
    applyFilter();

    // 2. 최신 API 가격 로드 (비동기)
    try {
      // 마켓 시세와 리테일가 병렬 로드
      const [marketData, retailData] = await Promise.all([
        window.PriceAPI?.loadLatestPrices?.() ?? Promise.resolve(null),
        window.PriceAPI?.loadRetailPrices?.() ?? Promise.resolve(null)
      ]);

      if (marketData) {
        const marketMap = window.PriceAPI.buildPriceMap(marketData);
        window.PriceAPI.applyPricesToWatches(allWatches, marketMap);
      }

      if (retailData) {
        const retailMap = window.PriceAPI.buildPriceMap(retailData);
        window.PriceAPI.applyPricesToWatches(allWatches, retailMap);
      }
      
      // 3. API 데이터 반영하여 다시 필터링 및 렌더링
      applyFilter();
    } catch (err) {
      console.error("Dynamic price load failed:", err);
    }
  });
