const grid = document.getElementById("grid");

// JSON 파일을 읽어서 카드 만들기
fetch("../final/data/watches_ui.json")
  .then(response => response.json())
  .then(watches => {
    grid.innerHTML = watches.map(watch => `
      <article class="card">
        <div class="thumb">IMAGE</div>
        <div class="meta">
          <div class="brand">${watch.brand}</div>
          <div class="name">${watch.name}</div>
          <div class="price">${watch.price}</div>
        </div>
      </article>
    `).join("");
  });
