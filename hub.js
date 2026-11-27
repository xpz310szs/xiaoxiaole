(() => {
  const hub = document.getElementById("hub");
  const player = document.getElementById("player");
  const frame = document.getElementById("frame");

  function openGame(src) {
    if (!src) return;
    frame.src = src;
    hub.classList.add("hidden");
    player.classList.remove("hidden");
    document.body.classList.add("playing");
    history.pushState({ game: src }, "", `#${src.replace(/\.html$/, "")}`);
  }

  function closeGame() {
    frame.src = "about:blank";
    player.classList.add("hidden");
    hub.classList.remove("hidden");
    document.body.classList.remove("playing");
    history.pushState({}, "", location.pathname);
  }

  document.querySelectorAll(".game-card[data-src]").forEach((card) => {
    card.addEventListener("click", () => openGame(card.dataset.src));
  });

  window.addEventListener("message", (e) => {
    if (e.data && e.data.type === "hub-back") closeGame();
  });

  window.addEventListener("popstate", () => {
    if (location.hash && location.hash.length > 1) {
      openGame(location.hash.slice(1) + ".html");
    } else {
      closeGame();
    }
  });

  // deep link: #cook / #maze etc.
  if (location.hash && location.hash.length > 1) {
    const raw = location.hash.slice(1).replace(/^\//, "");
    openGame(raw.endsWith(".html") ? raw : `${raw}.html`);
  }
})();
