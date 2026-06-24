document.querySelectorAll(".game-card.locked").forEach((card) => {
  card.addEventListener("click", () => {
    card.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-5px)" },
        { transform: "translateX(5px)" },
        { transform: "translateX(0)" }
      ],
      { duration: 260, easing: "ease-out" }
    );
  });
});

document.querySelectorAll(".game-card.playable").forEach((card) => {
  card.addEventListener("click", () => {
    if (typeof gtag === "function") {
      const title = card.querySelector("h2");
      gtag("event", "game_card_click", {
        game_name: title ? title.textContent.trim() : "unknown"
      });
    }
  });
});
