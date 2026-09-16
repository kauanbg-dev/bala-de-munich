(() => {
  const HASH = {
    "#topo": "/",
    "#mata-mata": "/confrontos",
    "#mvp": "/mvp",
    "#tabela": "/tabela",
    "#stats": "/stats",
    "#elenco": "/elenco",
    "#tatica": "/tatica",
    "#resultados": "/jogos",
    "#amistosos": "/amistosos",
    "#feed": "/feed",
    "#sociais": "/sociais",
  };

  try {
    const path = location.pathname.replace(/\/$/, "") || "/";
    const admin = new URLSearchParams(location.search).has("admin");
    if (path === "/" && admin) {
      location.replace(`/mvp${location.search}`);
      return;
    }
    const dest = HASH[location.hash];
    if (dest && (path === "/" || path === "/index.html")) {
      location.replace(`${dest}${location.search}`);
      return;
    }
  } catch {
    /* ignore */
  }

  const page = document.body.getAttribute("data-page") || "";
  document.querySelectorAll("[data-nav]").forEach((link) => {
    if (link.getAttribute("data-nav") === page) {
      link.setAttribute("aria-current", "page");
      try {
        link.scrollIntoView({ inline: "center", block: "nearest", behavior: "instant" });
      } catch {
        link.scrollIntoView({ inline: "center", block: "nearest" });
      }
    }
  });
  if (page === "lives") {
    document.querySelector(".btn-lives")?.setAttribute("aria-current", "page");
  }
  if (page === "mvp") {
    document.querySelector(".topbar .btn-gold")?.setAttribute("aria-current", "page");
  }

  const siteNav = document.getElementById("site-nav");
  const navToggle = document.querySelector(".nav-toggle");
  if (!siteNav || !navToggle) return;
  if (window.matchMedia("(max-width: 1020px)").matches) return;
  const closeNav = () => {
    siteNav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  };
  navToggle.addEventListener("click", () => {
    const open = siteNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeNav);
  });
  document.addEventListener("click", (event) => {
    if (!siteNav.classList.contains("is-open")) return;
    if (siteNav.contains(event.target) || navToggle.contains(event.target)) return;
    closeNav();
  });
})();
