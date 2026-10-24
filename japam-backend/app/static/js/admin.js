// Spiritual Commerce Admin - Global Interactions

document.addEventListener("DOMContentLoaded", () => {
  // 1. Mobile Sidebar Toggle & Close Handlers
  const toggleBtn = document.getElementById("mobileSidebarToggle");
  const closeBtn = document.getElementById("mobileSidebarClose");
  const sidebar = document.getElementById("adminSidebar");
  const backdrop = document.getElementById("sidebarBackdrop");

  function openSidebar() {
    if (sidebar) sidebar.classList.add("open");
    if (backdrop) backdrop.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeSidebar() {
    if (sidebar) sidebar.classList.remove("open");
    if (backdrop) backdrop.classList.remove("active");
    document.body.style.overflow = "";
  }

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", () => {
      if (sidebar.classList.contains("open")) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", closeSidebar);
  }

  if (backdrop) {
    backdrop.addEventListener("click", closeSidebar);
  }

  // Auto-close sidebar on mobile when a navigation link is clicked
  if (sidebar) {
    const navLinks = sidebar.querySelectorAll(".nav-link");
    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        if (window.innerWidth <= 992) {
          closeSidebar();
        }
      });
    });
  }

  // Close sidebar on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeSidebar();
    }
  });

  // 2. Notification Bell & Dropdown
  const notifBtn = document.getElementById("notificationBellBtn");
  const notifDropdown = document.getElementById("notificationDropdown");
  const clearNotifsBtn = document.getElementById("clearNotifsBtn");
  const bellBadge = document.getElementById("bellBadge");

  if (notifBtn && notifDropdown) {
    notifBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      // Close profile dropdown if open
      if (userDropdown) userDropdown.style.display = "none";
      const isVisible = notifDropdown.style.display === "block";
      notifDropdown.style.display = isVisible ? "none" : "block";
      notifBtn.setAttribute("aria-expanded", !isVisible);
    });

    notifDropdown.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    if (clearNotifsBtn) {
      clearNotifsBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const itemsList = document.getElementById("notificationItemsList");
        if (itemsList) {
          itemsList.innerHTML = '<div style="padding:28px 16px; text-align:center; font-size:0.82rem; color:#8c8277;">✨ All clear! No pending notifications.</div>';
        }
        if (bellBadge) {
          bellBadge.style.display = "none";
        }
        clearNotifsBtn.style.display = "none";
      });
    }
  }

  // 3. User Profile Dropdown
  const userMenuBtn = document.getElementById("userProfileMenu");
  const userDropdown = document.getElementById("userProfileDropdown");

  if (userMenuBtn && userDropdown) {
    userMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      // Close notification dropdown if open
      if (notifDropdown) notifDropdown.style.display = "none";
      userDropdown.style.display = userDropdown.style.display === "block" ? "none" : "block";
    });

    userDropdown.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }

  // Global outside click closes both dropdowns
  document.addEventListener("click", () => {
    if (userDropdown) userDropdown.style.display = "none";
    if (notifDropdown) notifDropdown.style.display = "none";
  });

  // 4. Live Global Search
  const searchInput = document.getElementById("globalSearchInput");
  const searchResults = document.getElementById("searchResultsDropdown");

  if (searchInput && searchResults) {
    let debounceTimer;
    searchInput.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      const query = e.target.value.trim();
      if (query.length < 2) {
        searchResults.style.display = "none";
        return;
      }

      debounceTimer = setTimeout(async () => {
        try {
          const res = await fetch(`/admin/search?q=${encodeURIComponent(query)}`);
          const data = await res.json();
          renderSearchResults(data.results);
        } catch (err) {
          console.error("Search error:", err);
        }
      }, 200);
    });

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) {
          const firstLink = searchResults.querySelector("a");
          if (firstLink) {
            window.location.href = firstLink.href;
          } else {
            window.location.href = `/admin/commerce/products?q=${encodeURIComponent(query)}`;
          }
        }
      }
    });

    document.addEventListener("click", (e) => {
      if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.style.display = "none";
      }
    });
  }

  function renderSearchResults(results) {
    if (!searchResults) return;
    if (!results || results.length === 0) {
      searchResults.innerHTML = '<div style="padding: 12px; font-size: 0.8rem; color: #8c8277; text-align: center;">No spiritual records found</div>';
      searchResults.style.display = "block";
      return;
    }

    searchResults.innerHTML = results.map(r => `
      <a href="${r.url}" style="display: block; padding: 8px 12px; border-bottom: 1px solid #f4eee6; text-decoration: none; color: inherit;" onmouseover="this.style.backgroundColor='#faf8f4'" onmouseout="this.style.backgroundColor='transparent'">
        <div style="font-size: 0.68rem; font-weight: 700; color: #e66a1f; text-transform: uppercase;">${r.category}</div>
        <div style="font-size: 0.84rem; font-weight: 600; color: #1f2937;">${r.title}</div>
        <div style="font-size: 0.74rem; color: #8c8277;">${r.subtitle}</div>
      </a>
    `).join("");
    searchResults.style.display = "block";
  }
});

// Modal Helpers
function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.add("active");
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.remove("active");
}
