const detailEl = document.getElementById("detail");
const params = new URLSearchParams(location.search);
const ref = params.get("ref");

fetch("../final/data/watches_ui.json")
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
          <div class="price">${watch.price_display ?? watch.price}</div>
          <div style="margin-top:8px; font-size:12px; color:#777;">ref: ${watch.ref}</div>
        </div>
      </article>
    `;
  });
