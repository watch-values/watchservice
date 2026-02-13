// Dynamic price API helper (for static sites)
// - fetch with localStorage cache (TTL 6 hours)
// - merge into watches_ui.json objects by ref_id

(function () {
  // API URL 설정
  const DEFAULT_DYNAMIC_PRICE_URL =
    "https://limdoohwan.pythonanywhere.com/api/kakaku/latest-prices/";
  const DEFAULT_RETAIL_PRICE_URL =
    "https://limdoohwan.pythonanywhere.com/api/retail/latest-prices/";

  const DYNAMIC_PRICE_URL =
    window.DYNAMIC_PRICE_URL || DEFAULT_DYNAMIC_PRICE_URL;
  const RETAIL_PRICE_URL =
    window.RETAIL_PRICE_URL || DEFAULT_RETAIL_PRICE_URL;

  // 캐시 키 버전 관리
  const CACHE_KEY = "dynamic_prices_cache_v2";
  const RETAIL_CACHE_KEY = "retail_prices_cache_v1";
  const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

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

  function readCache(key) {
    try {
      const raw = localStorage.getItem(key);
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

  function writeCache(key, data) {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ fetchedAt: nowMs(), data })
      );
    } catch (_) {
      // ignore
    }
  }

  function clearCache() {
    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(RETAIL_CACHE_KEY);
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

    const cached = readCache(CACHE_KEY);
    if (cached) return cached;

    const urlWithBust = new URL(DYNAMIC_PRICE_URL);
    urlWithBust.searchParams.set("_t", nowMs());

    const data = await fetchJsonWithTimeout(urlWithBust.toString(), 8000);
    if (!data) {
      console.warn("[PriceAPI] Market API call failed");
      return null;
    }

    writeCache(CACHE_KEY, data);
    return data;
  }

  async function loadRetailPrices() {
    if (!RETAIL_PRICE_URL) return null;

    const cached = readCache(RETAIL_CACHE_KEY);
    if (cached) return cached;

    const urlWithBust = new URL(RETAIL_PRICE_URL);
    urlWithBust.searchParams.set("_t", nowMs());

    const data = await fetchJsonWithTimeout(urlWithBust.toString(), 8000);
    if (!data) {
      console.warn("[PriceAPI] Retail API call failed");
      return null;
    }

    writeCache(RETAIL_CACHE_KEY, data);
    return data;
  }

  function buildPriceMap(apiResponse) {
    const results = apiResponse?.results || (Array.isArray(apiResponse) ? apiResponse : []);
    const map = Object.create(null);
    for (const row of results) {
      if (!row || !row.ref_id) continue;
      const cleanId = String(row.ref_id).trim().toLowerCase();
      
      // Determine if it's retail or market response based on structure
      const isRetail = row.category === "retail_price";
      
      map[cleanId] = {
        price: row.price || null,
        recorded_at: row.recorded_at || null,
        isRetail: isRetail
      };
    }
    return map;
  }

  function applyPricesToWatches(watches, priceMap) {
    if (!Array.isArray(watches) || !priceMap) return watches;

    let appliedCount = 0;
    for (const w of watches) {
      if (!w || !w.ref) continue;
      const cleanRef = String(w.ref).trim().toLowerCase();
      const hit = priceMap[cleanRef];
      if (!hit || !hit.price) continue;

      const p = hit.price;

      if (hit.isRetail) {
        // Apply to retail field
        const retailNum = parsePriceToNumber(p.krw);
        if (retailNum) {
          if (!w.prices) w.prices = {};
          w.prices.retail = {
            display: formatPriceDisplay(retailNum),
            value: retailNum
          };
        }
      } else {
        // Apply to market fields (existing logic)
        w.ext_jpy = p.jpy ?? null;
        w.ext_krw_domestic_raw = p.krw_domestic ?? null;
        w.ext_krw_asia_raw = p.krw_asia ?? null;
        w.ext_yen_rate = p.yen_rate ?? null;
        w.ext_recorded_at = hit.recorded_at ?? null;

        const domesticNum = parsePriceToNumber(p.krw_domestic);
        const asiaNum = parsePriceToNumber(p.krw_asia);

        w.ext_krw_domestic = domesticNum;
        w.ext_krw_asia = asiaNum;
        w.ext_krw_domestic_display = formatPriceDisplay(domesticNum);
        w.ext_krw_asia_display = formatPriceDisplay(asiaNum);
      }

      appliedCount += 1;
    }

    console.log(`[PriceAPI] updated prices: ${appliedCount}/${watches.length}`);
    return watches;
  }

  // expose
  window.PriceAPI = {
    loadLatestPrices,
    loadRetailPrices,
    buildPriceMap,
    applyPricesToWatches,
    clearCache,
  };
})();
