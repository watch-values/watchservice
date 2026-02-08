// Kakaku latest price API helper (for static sites)
// - fetch with localStorage cache (TTL 6 hours)
// - merge into watches_ui.json objects by ref_id

(function () {
  // API URL 설정
  const DEFAULT_KAKAKU_LATEST_PRICES_URL =
    "https://YOUR_API_DOMAIN/api/kakaku/latest-prices/";
  const KAKAKU_LATEST_PRICES_URL =
    window.KAKAKU_LATEST_PRICES_URL || DEFAULT_KAKAKU_LATEST_PRICES_URL;

  // 캐시 키 버전을 올려서( v6 ) 이전 캐시가 남아 있어도 자동 갱신되게 함
  const CACHE_KEY = "kakaku_latest_prices_cache_v6";
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

  function parseKrwToNumber(value) {
    if (!value) return null;
    const n = parseInt(String(value).replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  }

  function formatKrwDisplay(num) {
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
    if (
      !KAKAKU_LATEST_PRICES_URL ||
      String(KAKAKU_LATEST_PRICES_URL).includes("YOUR_API_DOMAIN")
    ) {
      return null;
    }

    const cached = readCache();
    if (cached) return cached;

    const data = await fetchJsonWithTimeout(KAKAKU_LATEST_PRICES_URL, 8000);
    if (!data) {
      console.warn("[KakakuAPI] API 호출 실패:", KAKAKU_LATEST_PRICES_URL);
      return null;
    }

    writeCache(data);
    return data;
  }

  function buildPriceMap(apiResponse) {
    const results = apiResponse?.results || (Array.isArray(apiResponse) ? apiResponse : []);
    const map = Object.create(null);
    for (const row of results) {
      if (!row || !row.ref_id) continue;
      const cleanId = String(row.ref_id).trim().toLowerCase();
      map[cleanId] = {
        price: row.price || null,
        recorded_at: row.recorded_at || null,
      };
    }
    return map;
  }

  function applyPricesToWatches(watches, priceMap) {
    if (!Array.isArray(watches) || !priceMap) return watches;

    let appliedCount = 0;
    const mapKeys = Object.keys(priceMap);

    // 진단용 로그: 데이터 구조 출력
    if (watches.length > 0) {
      console.log("[KakakuAPI] 시계 데이터 샘플 구조:", Object.keys(watches[0]));
    }

    for (const w of watches) {
      const currentRef = w.ref || w.ref_id || w.id;
      if (!currentRef) {
        console.warn("[KakakuAPI] 시계 데이터에 매칭할 ID가 없음:", w);
        continue;
      }

      const cleanRef = String(currentRef).trim().toLowerCase();
      const hit = priceMap[cleanRef];

      if (hit && hit.price) {
        const p = hit.price;
        w.kakaku_jpy = p.jpy ?? null;
        w.kakaku_krw_domestic_raw = p.krw_domestic ?? null;
        w.kakaku_krw_asia_raw = p.krw_asia ?? null;
        w.kakaku_yen_rate = p.yen_rate ?? null;
        w.kakaku_recorded_at = hit.recorded_at ?? null;

        const domesticNum = parseKrwToNumber(p.krw_domestic);
        const asiaNum = parseKrwToNumber(p.krw_asia);

        w.kakaku_krw_domestic = domesticNum;
        w.kakaku_krw_asia = asiaNum;
        w.kakaku_krw_domestic_display = formatKrwDisplay(domesticNum);
        w.kakaku_krw_asia_display = formatKrwDisplay(asiaNum);

        appliedCount += 1;
      } else {
        console.warn(`[KakakuAPI] No API match for ref: "${cleanRef}". Available API keys:`, mapKeys);
      }
    }

    console.log(`[KakakuAPI] applied prices: ${appliedCount}/${watches.length}`);
    return watches;
  }

  window.KakakuAPI = {
    KAKAKU_LATEST_PRICES_URL,
    loadLatestPrices,
    buildPriceMap,
    applyPricesToWatches,
    clearCache: () => localStorage.removeItem(CACHE_KEY),
  };
})();
