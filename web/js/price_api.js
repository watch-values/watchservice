// Dynamic price API helper (for static sites)
// - fetch with localStorage cache (TTL 6 hours)
// - merge into watches_ui.json objects by ref_id

(function () {
  // API URL 설정
  // 로컬 테스트 시에는 http://127.0.0.1:8889 (Django 로컬 서버) 사용
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const API_BASE = isLocal ? "http://127.0.0.1:8889" : "https://limdoohwan.pythonanywhere.com";

  // 주의: market API 주소는 'kakaku'가 맞습니다.
  const DEFAULT_DYNAMIC_PRICE_URL = `${API_BASE}/api/market/latest-prices/`;
  const DEFAULT_RETAIL_PRICE_URL = `${API_BASE}/api/retail/latest-prices/`;

  const DYNAMIC_PRICE_URL =
    window.DYNAMIC_PRICE_URL || DEFAULT_DYNAMIC_PRICE_URL;
  const RETAIL_PRICE_URL =
    window.RETAIL_PRICE_URL || DEFAULT_RETAIL_PRICE_URL;

  // 캐시 키 버전 관리
  const CACHE_KEY = "dynamic_prices_cache_v2";
  const RETAIL_CACHE_KEY = "retail_prices_cache_v1";
  const PERSISTENT_CACHE_KEY = "persistent_last_known_prices_v1";
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

  function readPersistentCache() {
    try {
      const raw = localStorage.getItem(PERSISTENT_CACHE_KEY);
      return raw ? safeJsonParse(raw) || {} : {};
    } catch (_) {
      return {};
    }
  }

  function writePersistentCache(data) {
    try {
      localStorage.setItem(PERSISTENT_CACHE_KEY, JSON.stringify(data));
    } catch (_) {
      // ignore
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

    const persistentCache = readPersistentCache();
    let appliedCount = 0;

    for (const w of watches) {
      if (!w || !w.ref) continue;
      const cleanRef = String(w.ref).trim().toLowerCase();
      const hit = priceMap[cleanRef];
      const saved = persistentCache[cleanRef] || {};

      if (!persistentCache[cleanRef]) persistentCache[cleanRef] = {};

      if (hit && hit.price) {
        const p = hit.price;

        if (hit.isRetail) {
          const retailNum = parsePriceToNumber(p.krw);
          if (retailNum) {
            const display = formatPriceDisplay(retailNum);
            if (!w.prices) w.prices = {};
            w.prices.retail = { display, value: retailNum };
            persistentCache[cleanRef].retail = { display, value: retailNum, recorded_at: hit.recorded_at };
          }
        } else {
          const domesticNum = parsePriceToNumber(p.krw_domestic);
          const asiaNum = parsePriceToNumber(p.krw_asia);
          const localMarketNum = parsePriceToNumber(p.local_market);

          if (domesticNum) {
            w.ext_krw_domestic = domesticNum;
            const domesticDisplay = formatPriceDisplay(domesticNum);
            w.ext_krw_domestic_display = domesticDisplay;
            persistentCache[cleanRef].domestic = { display: domesticDisplay, value: domesticNum, recorded_at: hit.recorded_at };
          }
          if (asiaNum) {
            w.ext_krw_asia = asiaNum;
            const asiaDisplay = formatPriceDisplay(asiaNum);
            w.ext_krw_asia_display = asiaDisplay;
            persistentCache[cleanRef].asia = { display: asiaDisplay, value: asiaNum, recorded_at: hit.recorded_at };
          }
          if (localMarketNum) {
            w.ext_local_market = localMarketNum;
            const localMarketDisplay = formatPriceDisplay(localMarketNum);
            w.ext_local_market_display = localMarketDisplay;
            persistentCache[cleanRef].local_market = { display: localMarketDisplay, value: localMarketNum, recorded_at: hit.recorded_at };
          }
          if (domesticNum || asiaNum || localMarketNum) {
            w.ext_recorded_at = hit.recorded_at ?? null;
          }
        }
        appliedCount += 1;
      }

      // Final Fallback Pass for this watch (handles both 'no hit' and 'null price in hit')
      const s = persistentCache[cleanRef] || {};

      // 1. Domestic Market
      if (w.ext_krw_domestic_display === undefined || w.ext_krw_domestic_display === "N/A") {
        if (s.domestic) {
          w.ext_krw_domestic = s.domestic.value;
          w.ext_krw_domestic_display = s.domestic.display;
          if (!w.ext_recorded_at) w.ext_recorded_at = s.domestic.recorded_at;
        } else if (w.ext_krw_domestic_display === undefined) {
          // JSON 자체에 이미 값이 있다면 유지, 없으면 N/A
          w.ext_krw_domestic_display = w.ext_krw_domestic_display || "N/A";
        }
      }

      // 2. Asia Market
      if (w.ext_krw_asia_display === undefined || w.ext_krw_asia_display === "N/A") {
        if (s.asia) {
          w.ext_krw_asia = s.asia.value;
          w.ext_krw_asia_display = s.asia.display;
          if (!w.ext_recorded_at) w.ext_recorded_at = s.asia.recorded_at;
        } else if (w.ext_krw_asia_display === undefined) {
          // JSON 자체에 이미 값이 있다면 유지, 없으면 N/A
          w.ext_krw_asia_display = w.ext_krw_asia_display || "N/A";
        }
      }

      // 2-1. Local Market
      if (w.ext_local_market_display === undefined || w.ext_local_market_display === "N/A") {
        if (s.local_market) {
          w.ext_local_market = s.local_market.value;
          w.ext_local_market_display = s.local_market.display;
          if (!w.ext_recorded_at) w.ext_recorded_at = s.local_market.recorded_at;
        } else if (w.ext_local_market_display === undefined) {
          w.ext_local_market_display = w.ext_local_market_display || "N/A";
        }
      }

      // 3. Retail
      if (!w.prices) w.prices = {};
      if (!w.prices.retail || w.prices.retail.display === "N/A" || w.prices.retail.display === undefined) {
        if (s.retail) {
          w.prices.retail = { display: s.retail.display, value: s.retail.value };
          if (!w.ext_recorded_at) w.ext_recorded_at = s.retail.recorded_at;
        } else {
          if (!w.prices.retail) w.prices.retail = { display: "N/A" };
          else if (w.prices.retail.display === undefined) w.prices.retail.display = "N/A";
        }
      }
    }

    writePersistentCache(persistentCache);
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
