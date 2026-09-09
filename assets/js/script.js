'use strict';

const elementToggleFunc = function (elem) { elem.classList.toggle("active"); }

const sidebar = document.querySelector("[data-sidebar]");
const sidebarBtn = document.querySelector("[data-sidebar-btn]");

if (sidebarBtn && sidebar) {
  sidebarBtn.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    elementToggleFunc(sidebar);
    sidebarBtn.setAttribute("aria-expanded", sidebar.classList.contains("active") ? "true" : "false");
  });
}

function bindContactForm(root) {
  const scope = root || document;
  const form = scope.querySelector("[data-form]");
  if (!form) return;
  const formInputs = form.querySelectorAll("[data-form-input]");
  const formBtn = form.querySelector("[data-form-btn]");

  formInputs.forEach((input) => {
    input.addEventListener("input", function () {
      if (form.checkValidity()) {
        formBtn.removeAttribute("disabled");
      } else {
        formBtn.setAttribute("disabled", "");
      }
    });
  });
}

bindContactForm(document);

const navigationLinks = document.querySelectorAll("[data-nav-link]");
const pages = document.querySelectorAll("[data-page]");
const router = window.KolTiginRouter;

function syncDocumentUrl(pageName, { replace = false, keepHash = false } = {}) {
  if (!router || pageName === "guide") return;
  const nextPath = router.pathForPage(pageName, window.location.pathname);
  const hash = keepHash ? window.location.hash : "";
  const currentPath = router.normalizePath(window.location.pathname);
  if (currentPath === nextPath && (keepHash || !window.location.hash)) return;
  const method = replace ? "replaceState" : "pushState";
  history[method]({ page: pageName }, "", `${nextPath}${hash}`);
}

function activatePage(pageName, options = {}) {
  pages.forEach((page) => {
    page.classList.toggle("active", page.dataset.page === pageName);
  });
  navigationLinks.forEach((link) => {
    const target = link.dataset.navPage || link.innerHTML.trim().toLowerCase();
    const highlight = (pageName === "guide" || pageName === "guides") ? "guides" : pageName;
    link.classList.toggle("active", target === highlight);
  });
  if (!options.skipHistory) {
    syncDocumentUrl(pageName, {
      replace: Boolean(options.replace),
      keepHash: Boolean(options.keepHash)
    });
  }
  if (typeof window.applyRouteSeo === "function") window.applyRouteSeo();
  window.scrollTo({ top: 0, behavior: options.instantScroll ? "auto" : "smooth" });

  setTimeout(() => {
    if (pageName === "about" && typeof initializeAbout === "function") initializeAbout();
    if (pageName === "videos" && typeof initializeVideos === "function") initializeVideos();
    if (pageName === "resume" && typeof initializeResume === "function") initializeResume();
    if (pageName === "contact" && typeof initializeContact === "function") initializeContact();
  }, 80);
}

window.activatePage = activatePage;

function applyLegacyHashRedirect() {
  if (!router) return false;
  const target = router.legacyTarget(window.location.hash);
  if (!target) return false;
  const [path, hash = ""] = target.split("#");
  const nextHash = hash ? `#${hash}` : "";
  const nextPath = path || "/";
  if (router.normalizePath(window.location.pathname) === router.normalizePath(nextPath)
      && window.location.hash === nextHash) {
    return false;
  }
  history.replaceState(history.state, "", `${nextPath}${nextHash}`);
  return true;
}

function activateFromLocation(options = {}) {
  if (router && router.isWritingDetailHash(window.location.hash)) {
    activatePage("blog", { skipHistory: true, instantScroll: true, ...options });
    return;
  }
  if (router && router.parseGuidePath(window.location.pathname)) {
    activatePage("guide", { skipHistory: true, instantScroll: true, ...options });
    return;
  }
  if (router && router.isGuideHash(window.location.hash)) {
    activatePage("guide", { skipHistory: true, instantScroll: true, ...options });
    return;
  }
  const section = router ? router.sectionForPath(window.location.pathname) : { page: "about" };
  activatePage(section.page, { skipHistory: true, instantScroll: true, ...options });
}

document.querySelector(".navbar")?.addEventListener("click", function (e) {
  const link = e.target.closest("[data-nav-link]");
  if (!link) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || link.target === "_blank") return;
  e.preventDefault();
  activatePage(link.dataset.navPage);
}, true);

window.addEventListener("popstate", () => {
  activateFromLocation();
});

applyLegacyHashRedirect();
activateFromLocation();
