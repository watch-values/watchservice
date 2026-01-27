const grid = document.getElementById("grid");

fetch("../final/data/watches_ui.json")
  .then(response => response.json())
  .then(watches => {
    grid.innerHTML = watches.map(watch => `
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
    `).join("");
  });
