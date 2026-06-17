/* ============================================================================
   TACTIC — script.js
   Vanilla JS. No frameworks, no libraries.

   Modules
   ---------------------------------------------------------------------------
   A  Helpers & shared state
   B  Sample content + per-section store
   C  Navigation (mobile sheet, sticky shadow, smooth scroll)
   D  Typing effect
   E  Section tabs (roving tabindex + content swap)
   F  Live word / character counters
   G  Analyze flow (loader → metrics → suggestions → coach)
   H  Suggestion "Apply" micro-interaction
   I  CTAs: Start Translating / Watch Demo / Analyze again
   J  Scroll-reveal (IntersectionObserver)
   ========================================================================== */

(function () {
  "use strict";

  /* ===========================================================================
     A · HELPERS & SHARED STATE
     =========================================================================== */
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const srStatus = $("[data-sr-status]");
  let isAnalyzing = false;

  const announce = (msg) => { if (srStatus) srStatus.textContent = msg; };

  // Smooth scroll that respects the sticky nav height and reduced-motion.
  function scrollToEl(el, focusEl) {
    if (!el) return;
    el.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" });
    if (focusEl) {
      setTimeout(() => {
        focusEl.setAttribute("tabindex", focusEl.tabIndex < 0 ? "-1" : focusEl.tabIndex);
        focusEl.focus({ preventScroll: true });
      }, REDUCED ? 0 : 520);
    }
  }

  /* ===========================================================================
     B · SAMPLE CONTENT + PER-SECTION STORE
     ---------------------------------------------------------------------------
     The Abstrak / Abstract sections are pre-filled with a coherent sample so the
     demo flows end-to-end; every other section starts empty. Each panel keeps
     its own text per tab so switching sections never loses what you typed.
     =========================================================================== */
  const SAMPLE = {
    src: "Penelitian ini bertujuan untuk mengetahui pengaruh strategi penerjemahan " +
         "berbasis korpus terhadap kualitas terjemahan akademik mahasiswa. Banyak " +
         "mahasiswa masih mengalami kesulitan dalam menjaga keakuratan makna dan gaya " +
         "bahasa akademik. Penelitian ini menggunakan pendekatan kualitatif dengan " +
         "analisis teks paralel.",
    tgt: "This research aim to know the effect of corpus-based translation strategies " +
         "on the academic translation quality of students. A lot of students still have " +
         "difficulty to keep the meaning accuracy and academic style. This research uses " +
         "a qualitative approach with parallel text analysis."
  };

  // store[area][tabKey] = text
  const store = {
    src: { abstrak: SAMPLE.src, pendahuluan: "", kajian: "", metode: "", temuan: "", diskusi: "", kesimpulan: "" },
    tgt: { abstrak: SAMPLE.tgt, pendahuluan: "", kajian: "", metode: "", temuan: "", diskusi: "", kesimpulan: "" }
  };
  const current = { src: "abstrak", tgt: "abstrak" };

  const areaEl = { src: $('[data-area="src"]'), tgt: $('[data-area="tgt"]') };

  /* ===========================================================================
     C · NAVIGATION
     =========================================================================== */
  const nav       = $("[data-nav]");
  const navToggle = $("[data-nav-toggle]");
  const navMenu   = $("#nav-menu");

  // mobile sheet
  function setMenu(open) {
    navMenu.classList.toggle("is-open", open);
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
  navToggle.addEventListener("click", () => setMenu(!navMenu.classList.contains("is-open")));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

  // sticky shadow on scroll
  const onScroll = () => nav.classList.toggle("is-stuck", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // in-page anchor links: close the sheet (CSS handles the smooth scroll)
  $$('.nav__link[href^="#"], .hero__cue[href^="#"]').forEach((a) => {
    a.addEventListener("click", () => setMenu(false));
  });

  /* ===========================================================================
     D · TYPING EFFECT
     =========================================================================== */
  function typeText(el, text, speed = 26) {
    return new Promise((resolve) => {
      el.classList.remove("is-done");
      if (REDUCED) { el.textContent = text; el.classList.add("is-done"); resolve(); return; }
      el.textContent = "";
      let i = 0;
      (function tick() {
        if (i <= text.length) {
          el.textContent = text.slice(0, i);
          i++;
          // small natural pauses after sentence punctuation
          const last = text[i - 2];
          const delay = (last === "." || last === "!" || last === "?") ? speed * 7 : speed;
          setTimeout(tick, delay);
        } else {
          el.classList.add("is-done");
          resolve();
        }
      })();
    });
  }

  // Run all non-deferred typing targets (the hero bubble) once the page settles.
  function runIntroTyping() {
    $$("[data-typing]").forEach((el) => {
      if (el.hasAttribute("data-typing-deferred")) return;
      typeText(el, el.dataset.text || el.textContent.trim());
    });
  }

  /* ===========================================================================
     E · SECTION TABS  (roving tabindex + arrow-key navigation)
     =========================================================================== */
  function activateTab(area, tabBtn, { focus = false } = {}) {
    const list = tabBtn.closest("[data-tablist]");
    const tabs = $$(".tab", list);
    const newKey = tabBtn.dataset.tab;
    const ta = areaEl[area];

    // persist current section text, then load the chosen section
    store[area][current[area]] = ta.value;
    current[area] = newKey;
    ta.value = store[area][newKey] || "";
    ta.setAttribute("aria-labelledby", tabBtn.id);

    tabs.forEach((t) => {
      const active = t === tabBtn;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", String(active));
      t.tabIndex = active ? 0 : -1;
    });

    updateCount(area);
    if (focus) tabBtn.focus();
  }

  $$("[data-tablist]").forEach((list) => {
    const area = list.dataset.tablist;
    const tabs = $$(".tab", list);

    tabs.forEach((tab, idx) => {
      tab.addEventListener("click", () => activateTab(area, tab));
      tab.addEventListener("keydown", (e) => {
        let next = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") next = tabs[(idx + 1) % tabs.length];
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = tabs[(idx - 1 + tabs.length) % tabs.length];
        else if (e.key === "Home") next = tabs[0];
        else if (e.key === "End") next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); activateTab(area, next, { focus: true }); }
      });
    });
  });

  /* ===========================================================================
     F · LIVE WORD / CHARACTER COUNTERS
     =========================================================================== */
  function countWords(text) {
    const t = text.trim();
    return t ? t.split(/\s+/).length : 0;
  }
  function updateCount(area) {
    const text = areaEl[area].value;
    const w = $(`[data-words="${area}"]`);
    const c = $(`[data-chars="${area}"]`);
    if (w) w.textContent = countWords(text);
    if (c) c.textContent = text.length;
  }

  Object.keys(areaEl).forEach((area) => {
    areaEl[area].value = store[area][current[area]];   // seed from store
    areaEl[area].addEventListener("input", () => {
      store[area][current[area]] = areaEl[area].value;
      updateCount(area);
    });
    updateCount(area);
  });

  /* ===========================================================================
     G · ANALYZE FLOW
     =========================================================================== */
  const analyzeBtn  = $("[data-analyze]");
  const analyzeHint = $("[data-analyze-hint]");
  const loader      = $("[data-loader]");
  const progressBar = $("[data-progress]");
  const progressFill= $(".loader__fill");
  const results     = $("[data-results]");
  const resultsHead = $("#results-title");

  const RING_CIRC = 327;          // 2π·52, matches the CSS dash-array
  const DURATION  = REDUCED ? 450 : 3000;

  // count-up a single number element
  function countUp(el, target, ms) {
    if (REDUCED) { el.textContent = target; return; }
    const start = performance.now();
    (function frame(now) {
      const p = Math.min((now - start) / ms, 1);
      const eased = 1 - Math.pow(1 - p, 3);          // ease-out cubic
      el.textContent = Math.round(eased * target);
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = target;
    })(start);
  }

  // reset results visuals so "Analyze again" replays cleanly
  function resetResults() {
    $$(".metric").forEach((m) => {
      const bar = $(".metric__bar", m);
      bar.style.transition = "none";
      bar.style.strokeDashoffset = RING_CIRC;
      m.setAttribute("aria-valuenow", "0");
      const num = $("[data-countup]", m);
      if (num) num.textContent = "0";
    });
    $$("[data-sugg]").forEach((s) => s.classList.remove("is-in"));
    const coach = $(".coachsays__text");
    if (coach) { coach.textContent = ""; coach.classList.remove("is-done"); }
    // force reflow so the "none" transition above is committed before re-enabling
    void results.offsetWidth;
  }

  // animate the three metric rings + numbers
  function animateMetrics() {
    $$(".metric").forEach((m) => {
      const value = Number(m.dataset.value);
      const bar = $(".metric__bar", m);
      bar.style.transition = "";   // restore CSS transition
      requestAnimationFrame(() => {
        bar.style.strokeDashoffset = RING_CIRC * (1 - value / 100);
      });
      m.setAttribute("aria-valuenow", String(value));
      const num = $("[data-countup]", m);
      if (num) countUp(num, Number(num.dataset.countup), REDUCED ? 1 : 1400);
    });
  }

  // reveal + type the panels of the results section
  function showResults() {
    results.hidden = false;

    // reveal any scroll-reveal children that were hidden while the section was off
    $$("[data-reveal]", results).forEach((el) => {
      const delay = el.dataset.revealDelay;
      if (delay) el.style.transitionDelay = `${delay}ms`;
      el.classList.add("is-visible");
    });

    resetResults();
    scrollToEl(results, resultsHead);

    // let the scroll begin, then play the meters and stagger the suggestions
    setTimeout(() => {
      animateMetrics();
      $$("[data-sugg]").forEach((s) => s.classList.add("is-in"));
      const coach = $(".coachsays__text");
      if (coach) setTimeout(() => typeText(coach, coach.dataset.text, 18), REDUCED ? 0 : 900);
    }, REDUCED ? 0 : 420);

    announce("Analysis complete. Accuracy 85 percent, Grammar 70 percent, Academic style 82 percent.");
  }

  // drive the loader progress bar over DURATION, then resolve
  function runLoader() {
    return new Promise((resolve) => {
      loader.hidden = false;
      const start = performance.now();
      (function frame(now) {
        const p = Math.min((now - start) / DURATION, 1);
        const pct = Math.round(p * 100);
        progressFill.style.width = pct + "%";
        progressBar.setAttribute("aria-valuenow", String(pct));
        if (p < 1) requestAnimationFrame(frame);
        else { loader.hidden = true; resolve(); }
      })(start);
    });
  }

  function runAnalysis() {
    if (isAnalyzing) return;

    // persist whatever is in the boxes right now
    store.src[current.src] = areaEl.src.value;
    store.tgt[current.tgt] = areaEl.tgt.value;

    // need something in the target panel to inspect
    if (!areaEl.tgt.value.trim()) {
      analyzeHint.textContent = "Add some English text in the Target panel for Coach Taci to inspect.";
      analyzeHint.classList.add("is-warn");
      analyzeBtn.classList.add("is-pulse");
      scrollToEl($("#workspace"));
      areaEl.tgt.focus({ preventScroll: true });
      setTimeout(() => analyzeBtn.classList.remove("is-pulse"), 2400);
      return;
    }

    isAnalyzing = true;
    analyzeBtn.classList.remove("is-pulse");
    analyzeBtn.setAttribute("aria-busy", "true");
    analyzeBtn.disabled = true;
    analyzeHint.classList.remove("is-warn");
    analyzeHint.textContent = "Coach Taci is on it…";
    announce("Analyzing your translation.");

    runLoader().then(() => {
      showResults();
      analyzeBtn.disabled = false;
      analyzeBtn.removeAttribute("aria-busy");
      analyzeHint.textContent = "Inspection done — scroll down for Coach Taci's notes.";
      isAnalyzing = false;
    });
  }

  analyzeBtn.addEventListener("click", runAnalysis);

  /* ===========================================================================
     H · SUGGESTION "APPLY" MICRO-INTERACTION
     =========================================================================== */
  $$("[data-apply]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("is-applied")) return;
      btn.classList.add("is-applied");
      btn.textContent = "Applied ✓";
    });
  });

  /* ===========================================================================
     I · CTAs
     =========================================================================== */
  // helper to force a section's tab back to "abstrak" with the sample loaded
  function loadSampleSection(area) {
    if (!store[area].abstrak.trim()) store[area].abstrak = SAMPLE[area];
    const btn = $(`[data-tablist="${area}"] [data-tab="abstrak"]`);
    if (btn) activateTab(area, btn);
  }

  // Start Translating → workspace + focus source
  $$("[data-start]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      setMenu(false);
      scrollToEl($("#workspace"), areaEl.src);
    });
  });

  // Watch Demo → guarantee sample is loaded, then run the full analysis
  $("[data-demo]").addEventListener("click", () => {
    setMenu(false);
    loadSampleSection("src");
    loadSampleSection("tgt");
    scrollToEl($("#workspace"));
    setTimeout(runAnalysis, REDUCED ? 0 : 650);
  });

  // Analyze again
  $("[data-reanalyze]").addEventListener("click", runAnalysis);

  /* ===========================================================================
     J · SCROLL-REVEAL
     =========================================================================== */
  const revealItems = $$("[data-reveal]").filter((el) => !results.contains(el));
  if ("IntersectionObserver" in window && !REDUCED) {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const delay = el.dataset.revealDelay;
          if (delay) el.style.transitionDelay = `${delay}ms`;
          el.classList.add("is-visible");
          obs.unobserve(el);
        }
      });
    }, { threshold: 0.16, rootMargin: "0px 0px -8% 0px" });
    revealItems.forEach((el) => io.observe(el));
  } else {
    revealItems.forEach((el) => el.classList.add("is-visible"));
  }

  /* ===========================================================================
     INIT
     =========================================================================== */
  window.addEventListener("load", () => {
    setTimeout(runIntroTyping, REDUCED ? 0 : 600);
  });
})();
