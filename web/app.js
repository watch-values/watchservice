const grid = document.getElementById("grid");
const brandFilter = document.getElementById("brandFilter");

let allWatches = [];

function render(list) {
  grid.innerHTML = list.map(watch => `
    <a href="./detail.html?ref=${encodeURIComponent(watch.ref)}" style="text-decoration:none; color:inherit;">
      <article class="card">
        <div class="thumb">
          <img src="${watch.image}" alt="${watch.brand} ${watch.name}">
        </div>
        <div class="meta">
          <div class="brand">${watch.brand}</div>
          <div class="name">${watch.name}</div>
          <div class="price">${watch.price}</div>
        </div>
      </article>
    </a>
  `).join("");
}

function applyFilter() {
  const v = brandFilter.value;
  const filtered = (v === "ALL") ? allWatches : allWatches.filter(w => w.brand === v);
  render(filtered);
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

    brandFilter.addEventListener("change", applyFilter);

    // 최초 렌더
    applyFilter();
  });
