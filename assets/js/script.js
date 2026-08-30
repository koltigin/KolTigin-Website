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

function activatePage(pageName) {
  pages.forEach((page) => {
    page.classList.toggle("active", page.dataset.page === pageName);
  });
  navigationLinks.forEach((link) => {
    const target = link.dataset.navPage || link.innerHTML.trim().toLowerCase();
    link.classList.toggle("active", target === pageName);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });

  setTimeout(() => {
    if (pageName === "about" && typeof initializeAbout === "function") initializeAbout();
    if (pageName === "videos" && typeof initializeVideos === "function") initializeVideos();
    if (pageName === "resume" && typeof initializeResume === "function") initializeResume();
    if (pageName === "contact" && typeof initializeContact === "function") initializeContact();
  }, 80);
}

window.activatePage = activatePage;

document.querySelector(".navbar")?.addEventListener("click", function (e) {
  const link = e.target.closest("[data-nav-link]");
  if (!link) return;
  e.preventDefault();
  activatePage(link.dataset.navPage);
}, true);
