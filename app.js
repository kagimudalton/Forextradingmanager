/* app.js — handles login.html sign-in flow. */

document.addEventListener("DOMContentLoaded", () => {
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
      await api.login(username, password);
      window.location.href = "dashboard.html";
    } catch (err) {
      errorBox.textContent = err.message || "Login failed";
      errorBox.hidden = false;
      btn.disabled = false;
      btn.textContent = "Sign in";
    }
  });
});
