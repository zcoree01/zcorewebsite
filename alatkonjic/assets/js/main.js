/* Alat d.o.o. Konjic — interakcije i animacije (bez vanjskih biblioteka) */
(function () {
  "use strict";
  var doc = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- Page fade-in / fade-out ---------- */
  var fade = $(".page-fade");
  function revealPage() { if (fade) fade.classList.add("is-done"); }
  if (document.readyState === "complete") revealPage();
  else { window.addEventListener("load", revealPage); setTimeout(revealPage, 900); }
  window.addEventListener("pageshow", function (e) { if (e.persisted && fade) fade.classList.remove("is-leaving"); revealPage(); });
  if (fade && !reduce) {
    document.addEventListener("click", function (e) {
      var a = e.target.closest("a");
      if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      var href = a.getAttribute("href");
      if (!href || href.charAt(0) === "#" || /^(mailto|tel|https?):/i.test(href) || a.hasAttribute("download")) return;
      var url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.hash)) return;
      e.preventDefault();
      fade.classList.remove("is-done"); fade.classList.add("is-leaving");
      setTimeout(function () { location.href = a.href; }, 280);
    });
  }

  /* ---------- Header: scrolled state, hide on scroll down, progress ---------- */
  var header = $(".header");
  var progress = $(".progress");
  var lastY = window.scrollY, ticking = false;
  function onScroll() {
    var y = window.scrollY;
    if (header) {
      header.classList.toggle("is-scrolled", y > 30);
      var menuOpen = document.body.classList.contains("menu-open");
      header.classList.toggle("is-hidden", !menuOpen && y > 400 && y > lastY + 4);
      if (y < lastY - 4) header.classList.remove("is-hidden");
    }
    if (progress) {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = "scaleX(" + (h > 0 ? y / h : 0) + ")";
    }
    updateTimeline();
    updateParallax();
    lastY = y; ticking = false;
  }
  window.addEventListener("scroll", function () { if (!ticking) { requestAnimationFrame(onScroll); ticking = true; } }, { passive: true });

  /* ---------- Mobile menu ---------- */
  var burger = $(".burger");
  if (burger) {
    burger.addEventListener("click", function () {
      var open = document.body.classList.toggle("menu-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      burger.setAttribute("aria-label", open ? "Zatvori meni" : "Otvori meni");
    });
    $$(".mobile-menu a").forEach(function (a) { a.addEventListener("click", function () { document.body.classList.remove("menu-open"); burger.setAttribute("aria-expanded", "false"); }); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && document.body.classList.contains("menu-open")) burger.click(); });
  }

  /* ---------- Reveal on scroll ---------- */
  var revealEls = $$("[data-reveal], .stat, .t-item");
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-in"); });
  }
  // Stagger groups
  $$("[data-stagger]").forEach(function (group) {
    var step = parseFloat(group.getAttribute("data-stagger")) || 0.08;
    $$("[data-reveal]", group).forEach(function (el, i) { el.style.setProperty("--d", (i * step).toFixed(2) + "s"); });
  });

  /* ---------- Counters ---------- */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var dec = (el.getAttribute("data-count").split(".")[1] || "").length;
    var dur = 1800, start = null;
    function fmt(v) { return dec ? v.toFixed(dec) : String(Math.round(v)); }
    if (reduce) { el.textContent = fmt(target); return; }
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(target * eased);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var counters = $$("[data-count]");
  if ("IntersectionObserver" in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { animateCount(en.target); cio.unobserve(en.target); } });
    }, { threshold: 0.5 });
    counters.forEach(function (c) { cio.observe(c); });
  } else counters.forEach(animateCount);

  /* ---------- Card spotlight ---------- */
  $$(".svc").forEach(function (card) {
    card.addEventListener("pointermove", function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty("--mx", (e.clientX - r.left) + "px");
      card.style.setProperty("--my", (e.clientY - r.top) + "px");
    });
  });

  /* ---------- Timeline progress ---------- */
  var tl = $(".timeline"), tlProg = $(".timeline__progress");
  function updateTimeline() {
    if (!tl || !tlProg) return;
    var r = tl.getBoundingClientRect();
    var vh = window.innerHeight * 0.6;
    var p = Math.min(Math.max((vh - r.top) / r.height, 0), 1);
    tlProg.style.height = (p * 100) + "%";
  }

  /* ---------- Parallax ---------- */
  var parallax = reduce ? [] : $$("[data-parallax]");
  function updateParallax() {
    parallax.forEach(function (el) {
      var r = el.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      var speed = parseFloat(el.getAttribute("data-parallax")) || 0.12;
      var offset = (r.top + r.height / 2 - window.innerHeight / 2) * speed * -1;
      el.style.transform = "translate3d(0," + offset.toFixed(1) + "px,0)";
    });
  }

  /* ---------- Hero video: skip on save-data / reduced motion ---------- */
  var vid = $(".hero__media video");
  if (vid) {
    var conn = navigator.connection || {};
    if (reduce || conn.saveData) { vid.removeAttribute("autoplay"); vid.pause(); }
    else {
      var p = vid.play();
      if (p && p.catch) p.catch(function () {});
    }
  }

  /* ---------- Machine tabs ---------- */
  var tabs = $$(".tab[data-filter]");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var f = tab.getAttribute("data-filter");
      tabs.forEach(function (t) { t.setAttribute("aria-selected", t === tab ? "true" : "false"); });
      $$(".machine").forEach(function (m, i) {
        var show = f === "all" || m.getAttribute("data-cat") === f;
        m.hidden = !show;
        if (show && !reduce) {
          m.style.opacity = "0"; m.style.transform = "translateY(20px)";
          setTimeout(function () { m.style.opacity = ""; m.style.transform = ""; }, 30 + (i % 6) * 50);
        }
      });
    });
  });

  /* ---------- FAQ: one open at a time ---------- */
  var faqs = $$(".faq details");
  faqs.forEach(function (d) {
    d.addEventListener("toggle", function () { if (d.open) faqs.forEach(function (o) { if (o !== d) o.open = false; }); });
  });
  if (location.hash === "#faq") { var f0 = faqs[0]; if (f0) f0.open = true; }

  /* ---------- Map (privacy: load on request) ---------- */
  var mapBtn = $("[data-load-map]");
  if (mapBtn) {
    mapBtn.addEventListener("click", function () {
      var box = mapBtn.closest(".map");
      var iframe = document.createElement("iframe");
      iframe.src = box.getAttribute("data-src");
      iframe.title = "Lokacija Alat d.o.o. Konjic na Google Maps";
      iframe.loading = "lazy";
      iframe.referrerPolicy = "no-referrer-when-downgrade";
      iframe.allowFullscreen = true;
      box.innerHTML = "";
      box.appendChild(iframe);
    });
  }

  /* ---------- Contact form ---------- */
  var form = $("#contact-form");
  if (form) {
    var status = $(".form__status", form);
    var started = Date.now();
    var setErr = function (field, on) { var w = field.closest(".field, .consent"); if (w) w.classList.toggle("has-error", on); };
    var validate = function () {
      var ok = true;
      $$("[required]", form).forEach(function (f) {
        var bad = f.type === "checkbox" ? !f.checked : !f.value.trim() || (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value.trim()));
        setErr(f, bad); if (bad) ok = false;
      });
      return ok;
    };
    $$("input, textarea", form).forEach(function (f) {
      f.addEventListener("input", function () { var w = f.closest(".has-error"); if (w) setErr(f, false); });
      f.addEventListener("change", function () { var w = f.closest(".has-error"); if (w) setErr(f, false); });
    });

    function mailtoFallback(data) {
      var body = "Ime i prezime: " + data.get("name") + "\nEmail: " + data.get("email") + "\nTelefon: " + (data.get("phone") || "-") + "\n\n" + data.get("message");
      var subject = data.get("subject") || "Upit sa web stranice";
      location.href = "mailto:info@alatkonjic.com?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
      status.className = "form__status is-ok";
      status.textContent = "Otvoren je vaš email klijent s pripremljenom porukom. Ako se nije otvorio, pišite nam direktno na info@alatkonjic.com.";
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      status.className = "form__status"; status.textContent = "";
      if (!validate()) {
        status.className = "form__status is-err";
        status.textContent = "Molimo popunite obavezna polja označena zvjezdicom.";
        var first = $(".has-error input, .has-error textarea", form); if (first) first.focus();
        return;
      }
      var data = new FormData(form);
      if (data.get("website")) return; // honeypot
      data.append("elapsed", String(Date.now() - started));
      var btn = $("button[type=submit]", form);
      btn.classList.add("is-loading");
      var endpoint = form.getAttribute("data-endpoint");
      var done = function () { btn.classList.remove("is-loading"); };
      if (!endpoint || location.protocol === "file:") { done(); mailtoFallback(data); return; }
      fetch(endpoint, { method: "POST", body: data, headers: { "Accept": "application/json" } })
        .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }).then(function (j) { if (!r.ok || !j.ok) throw new Error(j.error || "send"); return j; }); })
        .then(function () {
          done(); form.reset();
          status.className = "form__status is-ok";
          status.textContent = "Hvala! Vaša poruka je poslana. Odgovaramo u roku od jednog radnog dana.";
        })
        .catch(function () { done(); mailtoFallback(data); });
    });
  }

  /* ---------- Misc ---------- */
  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  var toTop = $(".to-top");
  if (toTop) toTop.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); });

  onScroll();
})();
