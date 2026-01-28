const grid = document.getElementById("grid");
const brandFilter = document.getElementById("brandFilter");
const minPriceInput = document.getElementById("minPrice");
const maxPriceInput = document.getElementById("maxPrice");
const resetBtn = document.getElementById("resetFilter");
const resultCountEl = document.getElementById("resultCount");
const sortFilter = document.getElementById("sortFilter");
const filterSummaryContainer = document.getElementById("filterSummaryContainer");
const filterSummaryText = document.getElementById("filterSummaryText");
const chipGroup = document.getElementById("chipGroup");

let allWatches = [];

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
  if (resultCountEl) {
    resultCountEl.textContent = `검색결과 총 ${list.length}개`;
  }
  grid.innerHTML = list.map(watch => `
    <a href="./detail.html?ref=${encodeURIComponent(watch.ref)}" style="text-decoration:none; color:inherit;">
      <article class="card">
        <div class="thumb">
          <img src="${watch.image}" alt="${watch.brand} ${watch.name}">
        </div>
        <div class="meta">
          <div class="brand">${watch.brand}</div>
          <div class="name">${watch.name}</div>
          <div class="price">${watch.price_display ?? watch.price}</div>
        </div>
      </article>
    </a>
  `).join("");
}

function applyFilter() {
  const brandValue = brandFilter.value;
  const minPrice = parsePrice(minPriceInput.value);
  const maxPrice = parsePrice(maxPriceInput.value);
  const sortValue = sortFilter.value;

  const filtered = allWatches.filter(watch => {
    // 1. 브랜드 필터
    const matchBrand = (brandValue === "ALL") || (watch.brand === brandValue);
    
    // 2. 가격 필터 (price_value가 없으면 fallback 추출)
    const price = watch.price_value ?? parsePrice(watch.price_display ?? watch.price);
    
    let matchPrice = true;
    if (price !== null) {
      if (minPrice !== null && price < minPrice) matchPrice = false;
      if (maxPrice !== null && price > maxPrice) matchPrice = false;
    } else {
      // 가격 정보가 아예 없는 경우 필터 입력이 있으면 제외
      if (minPrice !== null || maxPrice !== null) matchPrice = false;
    }

    return matchBrand && matchPrice;
  });

  // 3. 정렬
  if (sortValue !== "NONE") {
    filtered.sort((a, b) => {
      const pA = a.price_value ?? parsePrice(a.price_display ?? a.price) ?? 0;
      const pB = b.price_value ?? parsePrice(b.price_display ?? b.price) ?? 0;
      return sortValue === "LOW_PRICE" ? pA - pB : pB - pA;
    });
  }

  render(filtered);
  updateFilterSummaryAndChips();
}

function updateFilterSummaryAndChips() {
  const brandValue = brandFilter.value;
  const minPriceRaw = minPriceInput.value;
  const maxPriceRaw = maxPriceInput.value;

  const summaryParts = [];
  const chips = [];

  if (brandValue !== "ALL") {
    summaryParts.push(`브랜드 ${brandValue}`);
    chips.push({ label: `브랜드: ${brandValue}`, type: 'brand' });
  }

  if (minPriceRaw && maxPriceRaw) {
    summaryParts.push(`가격 ${minPriceRaw} ~ ${maxPriceRaw}원`);
  } else if (minPriceRaw) {
    summaryParts.push(`가격 ${minPriceRaw}원 이상`);
  } else if (maxPriceRaw) {
    summaryParts.push(`가격 ${maxPriceRaw}원 이하`);
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

fetch("../final/data/watches_ui.json")
  .then(r => r.json())
  .then(watches => {
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
    sortFilter.addEventListener("change", applyFilter);
    minPriceInput.addEventListener("input", handlePriceInput);
    maxPriceInput.addEventListener("input", handlePriceInput);
    
    resetBtn.addEventListener("click", () => {
      brandFilter.value = "ALL";
      sortFilter.value = "NONE";
      minPriceInput.value = "";
      maxPriceInput.value = "";
      applyFilter();
    });

    // 최초 렌더
    applyFilter();
  });
