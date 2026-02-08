// Kakaku latest price API helper (for static sites)
// - fetch with localStorage cache (TTL 6 hours)
// - merge into watches_ui.json objects by ref_id

(function () {
  // API URL 설정
  // 1) (권장) index.html/detail.html에서 window.KAKAKU_LATEST_PRICES_URL 값을 지정
  // 2) 또는 아래 DEFAULT_KAKAKU_LATEST_PRICES_URL 상수를 직접 수정
  const DEFAULT_KAKAKU_LATEST_PRICES_URL =
    "https://YOUR_API_DOMAIN/api/kakaku/latest-prices/";
  const KAKAKU_LATEST_PRICES_URL =
    window.KAKAKU_LATEST_PRICES_URL || DEFAULT_KAKAKU_LATEST_PRICES_URL;

  // 캐시 키 버전을 올려서( v3 ) 이전 캐시가 남아 있어도 자동 갱신되게 함
  // (예: 예전엔 count=1만 캐시되어 Explorer가 JSON 가격으로 보이는 문제를 방지)
  const CACHE_KEY = "kakaku_latest_prices_cache_v3";
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

  /**
   * loadLatestPrices()
   * - 캐시가 유효하면 캐시 반환
   * - 아니면 API 호출 후 캐시 저장
   * - 실패 시 null 반환
   */
  async function loadLatestPrices() {
    if (
      !KAKAKU_LATEST_PRICES_URL ||
      String(KAKAKU_LATEST_PRICES_URL).includes("YOUR_API_DOMAIN")
    ) {
      console.warn(
        "[KakakuAPI] API URL이 설정되지 않았습니다. " +
          "window.KAKAKU_LATEST_PRICES_URL 또는 DEFAULT_KAKAKU_LATEST_PRICES_URL을 설정하세요."
      );
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

  /**
   * buildPriceMap(results)
   * - API 응답의 results 배열을 ref_id -> { price, recorded_at } 형태로 변환
   */
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

  /**
   * applyPricesToWatches(watches, priceMap)
   * - watches_ui.json의 watch.ref == priceMap[ref].ref_id 인 경우에만 동적 필드를 추가
   * - 기존 watch.prices(정적 가격)는 절대 수정하지 않음
   */
  function applyPricesToWatches(watches, priceMap) {
    if (!Array.isArray(watches) || !priceMap) return watches;

    let appliedCount = 0;
    for (const w of watches) {
      if (!w || !w.ref) continue;
      const hit = priceMap[w.ref];
      if (!hit || !hit.price) continue;

      const p = hit.price;

      // 원문 문자열 (API가 문자열로 내려줌)
      w.kakaku_jpy = p.jpy ?? null;
      w.kakaku_krw_domestic_raw = p.krw_domestic ?? null;
      w.kakaku_krw_asia_raw = p.krw_asia ?? null;
      w.kakaku_yen_rate = p.yen_rate ?? null;
      w.kakaku_recorded_at = hit.recorded_at ?? null;

      // 숫자/표시용 (UI에서 사용)
      const domesticNum = parseKrwToNumber(p.krw_domestic);
      const asiaNum = parseKrwToNumber(p.krw_asia);

      w.kakaku_krw_domestic = domesticNum;
      w.kakaku_krw_asia = asiaNum;
      w.kakaku_krw_domestic_display = formatKrwDisplay(domesticNum);
      w.kakaku_krw_asia_display = formatKrwDisplay(asiaNum);

      appliedCount += 1;
    }

    console.log(`[KakakuAPI] applied prices: ${appliedCount}/${watches.length}`);
    return watches;
  }

  // expose
  window.KakakuAPI = {
    KAKAKU_LATEST_PRICES_URL,
    loadLatestPrices,
    buildPriceMap,
    applyPricesToWatches,
    clearCache,
  };
})();

