// Spiritual Commerce Admin - Global Interactions

document.addEventListener("DOMContentLoaded", () => {
  // 1. Mobile Sidebar Toggle
  const toggleBtn = document.getElementById("mobileSidebarToggle");
  const sidebar = document.getElementById("adminSidebar");
  const backdrop = document.getElementById("sidebarBackdrop");

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("open");
      if (backdrop) backdrop.classList.toggle("active");
    });
  }

  if (backdrop && sidebar) {
    backdrop.addEventListener("click", () => {
      sidebar.classList.remove("open");
      backdrop.classList.remove("active");
    });
  }

  // 2. User Profile Dropdown
  const userMenuBtn = document.getElementById("userProfileMenu");
  const userDropdown = document.getElementById("userProfileDropdown");

  if (userMenuBtn && userDropdown) {
    userMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      userDropdown.style.display = userDropdown.style.display === "block" ? "none" : "block";
    });

    document.addEventListener("click", () => {
      userDropdown.style.display = "none";
    });
  }

  // 3. Live Global Search
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
      }, 250);
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
