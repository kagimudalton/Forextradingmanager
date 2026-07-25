/* app.js — handles the login page only. */

/* Draws a lively, self-contained candlestick strip in the login hero.
   Pure SVG/JS — no external images, so nothing to worry about licensing-wise
   once this repo is public on GitHub Pages. */
function drawCandles() {
  const group = document.querySelector(".candles");
  if (!group) return;

  const ns = "http://www.w3.org/2000/svg";
  let price = 130;
  const count = 26;
  const width = 600 / count;

  for (let i = 0; i < count; i++) {
    const open = price;
    const change = (Math.random() - 0.48) * 26;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * 10;
    const low = Math.min(open, close) - Math.random() * 10;
    price = close;

    const up = close < open; // smaller y = higher price
    const color = up ? "var(--green)" : "var(--red)";
    const x = i * width + width * 0.25;
    const bodyW = width * 0.5;

    const wick = document.createElementNS(ns, "line");
    wick.setAttribute("x1", x + bodyW / 2);
    wick.setAttribute("x2", x + bodyW / 2);
    wick.setAttribute("y1", high);
    wick.setAttribute("y2", low);
    wick.setAttribute("stroke", color);
    wick.setAttribute("stroke-width", "1.5");
    wick.setAttribute("opacity", "0.85");
    group.appendChild(wick);

    const rect = document.createElementNS(ns, "rect");
    rect.setAttribute("x", x);
    rect.setAttribute("y", Math.min(open, close));
    rect.setAttribute("width", bodyW);
    rect.setAttribute("height", Math.max(Math.abs(close - open), 2));
    rect.setAttribute("fill", color);
    rect.setAttribute("rx", "1.5");
    rect.setAttribute("class", "candle-rect");
    rect.style.animationDelay = `${i * 0.04}s`;
    rect.style.transformOrigin = `${x}px ${Math.min(open, close)}px`;
    group.appendChild(rect);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  drawCandles();

  const form = document.getElementById("login-form");
  if (!form) return;

  const errorBox = document.getElementById("login-error");
  const btn = document.getElementById("login-btn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    btn.disabled = true;
    btn.textContent = "Signing in…";

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    try {
      const user = await api.login(username, password);
      window.location.href = "dashboard.html";
    } catch (err) {
      errorBox.textContent = err.message || "Login failed";
      errorBox.hidden = false;
      btn.disabled = false;
      btn.textContent = "Sign in";
    }
  });
});
