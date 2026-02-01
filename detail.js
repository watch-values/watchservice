const detailEl = document.getElementById("detail");
const params = new URLSearchParams(location.search);
const ref = params.get("ref");

fetch("final/data/watches_ui.json")
  .then(r => r.json())
  .then(list => {
    const watch = list.find(w => w.ref === ref);

    if (!watch) {
      detailEl.innerHTML = `<p>해당 상품을 찾을 수 없어요. (ref: ${ref ?? "없음"})</p>`;
      return;
    }

    detailEl.innerHTML = `
      <article class="card" style="max-width:520px;">
        <div class="thumb">
          <img src="${watch.image}" alt="${watch.brand} ${watch.name}">
        </div>
        <div class="meta">
          <div class="brand">${watch.brand}</div>
          <div class="name">${watch.name}</div>
          <div class="price-list" style="margin-top:12px; font-size:13px; line-height:1.6;">
            <div><span style="color:#888;">공식판매가:</span> ${watch.prices.retail.display}</div>
            <div style="font-weight:bold; color:#e44d26;"><span style="color:#888; font-weight:normal;">국내시세:</span> ${watch.prices.korea_market.display}</div>
            <div><span style="color:#888;">해외시세:</span> ${watch.prices.global_market.display}</div>
          </div>
          <div style="margin-top:12px; font-size:12px; color:#777;">ref: ${watch.ref}</div>
        </div>
      </article>
    `;
  });
