// Dynamic price API helper (for static sites)
// - fetch with localStorage cache (TTL 6 hours)
// - merge into watches_ui.json objects by ref_id

(function () {
  // API URL 설정
  const DEFAULT_DYNAMIC_PRICE_URL =
    "https://limdoohwan.pythonanywhere.com/api/v1/latest-prices/";
  const DYNAMIC_PRICE_URL =
    window.DYNAMIC_PRICE_URL || DEFAULT_DYNAMIC_PRICE_URL;

  // 캐시 키 버전 관리
  const CACHE_KEY = "dynamic_prices_cache_v1";
  const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

  function nowMs() {
    return Date.now();
  }

  function safeJsonParse(text) {
    try {
      return JSON.parse(text);
    } catch (_) {
      return null;
    }
  }

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = safeJsonParse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      if (!parsed.fetchedAt || !parsed.data) return null;
      const age = nowMs() - parsed.fetchedAt;
      if (age > CACHE_TTL_MS) return null;
      return parsed.data;
    } catch (_) {
      return null;
    }
  }

  function writeCache(data) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ fetchedAt: nowMs(), data })
      );
    } catch (_) {
      // ignore
    }
  }

  function clearCache() {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch (_) {
      // ignore
    }
  }

  function parsePriceToNumber(value) {
    if (!value) return null;
    const n = parseInt(String(value).replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  }

  function formatPriceDisplay(num) {
    if (num === null || num === undefined) return null;
    const s = String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `₩${s}`;
  }

  async function fetchJsonWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) return null;
      return await res.json();
    } catch (_) {
      return null;
    } finally {
      clearTimeout(id);
    }
  }

  async function loadLatestPrices() {
    if (!DYNAMIC_PRICE_URL) return null;

    const cached = readCache();
    if (cached) return cached;

    const data = await fetchJsonWithTimeout(DYNAMIC_PRICE_URL, 8000);
    if (!data) {
      console.warn("[PriceAPI] API call failed");
      return null;
    }

    writeCache(data);
    return data;
  }

  function buildPriceMap(apiResponse) {
    const results = apiResponse && Array.isArray(apiResponse.results)
      ? apiResponse.results
      : [];

    const map = Object.create(null);
    for (const row of results) {
      if (!row || !row.ref_id) continue;
      map[row.ref_id] = {
        price: row.price || null,
        recorded_at: row.recorded_at || null,
      };
    }
    return map;
  }

  function applyPricesToWatches(watches, priceMap) {
    if (!Array.isArray(watches) || !priceMap) return watches;

    let appliedCount = 0;
    for (const w of watches) {
      if (!w || !w.ref) continue;
      const hit = priceMap[w.ref];
      if (!hit || !hit.price) continue;

      const p = hit.price;

      // 원문 데이터 (API 응답 기반)
      w.ext_jpy = p.jpy ?? null;
      w.ext_krw_domestic_raw = p.krw_domestic ?? null;
      w.ext_krw_asia_raw = p.krw_asia ?? null;
      w.ext_yen_rate = p.yen_rate ?? null;
      w.ext_recorded_at = hit.recorded_at ?? null;

      // 표시용 데이터
      const domesticNum = parsePriceToNumber(p.krw_domestic);
      const asiaNum = parsePriceToNumber(p.krw_asia);

      w.ext_krw_domestic = domesticNum;
      w.ext_krw_asia = asiaNum;
      w.ext_krw_domestic_display = formatPriceDisplay(domesticNum);
      w.ext_krw_asia_display = formatPriceDisplay(asiaNum);

      appliedCount += 1;
    }

    console.log(`[PriceAPI] updated prices: ${appliedCount}/${watches.length}`);
    return watches;
  }

  // expose
  window.PriceAPI = {
    loadLatestPrices,
    buildPriceMap,
    applyPricesToWatches,
    clearCache,
  };
})();
