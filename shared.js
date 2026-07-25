/* shared.js — sidebar/topbar behavior shared by dashboard/profile/admin pages. */

async function initShell(activePage) {
  let user;
  try {
    user = await api.me();
  } catch (_) {
    window.location.href = "index.html";
    return null;
  }

  const nameEl = document.getElementById("side-username");
  const roleEl = document.getElementById("side-role");
  const avatarEl = document.getElementById("side-avatar");
  if (nameEl) nameEl.textContent = user.username;
  if (roleEl) roleEl.textContent = user.role;
  if (avatarEl) avatarEl.textContent = user.username.slice(0, 2).toUpperCase();

  document.querySelectorAll(".nav-link[data-page]").forEach((el) => {
    el.classList.toggle("active", el.dataset.page === activePage);
  });

  // Hide admin-only nav item for non-admins
  if (user.role !== "ADMIN") {
    document.querySelectorAll("[data-role='ADMIN']").forEach((el) => el.style.display = "none");
  }

  const logoutLink = document.getElementById("logout-link");
  if (logoutLink) {
    logoutLink.addEventListener("click", async () => {
      await api.logout();
      window.location.href = "index.html";
    });
  }

  return user;
}
