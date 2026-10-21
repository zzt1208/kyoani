/* Application logic. Data lives in data.js; images live in assets/. */
"use strict";

/* =========================================================
   评分来源：Bangumi 番组计划（截至 2026 年 10 月，非实时）
   作品海报：各作品公开资料 / Bangumi；角色画像：AniList / Bangumi
   ========================================================= */

const imageSrc = (url) => IMAGE_FILES[url] || url;

/* =========================================================
   APP LOGIC — 渲染、筛选、详情弹窗、导航与动效
   ========================================================= */
document.documentElement.classList.add("js");

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const isReduced = () => reduceMotion.matches;
const workById = new Map(works.map((work) => [work.id, work]));
const state = { filter: "all", query: "", sort: "date", direction: "desc", page: 1, pageSize: 20 };

const escapeXML = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

const normalizeText = (value) => String(value || "")
  .normalize("NFKC")
  .toLowerCase()
  .replace(/[\s\u3000・·\-—–~～]/g, "");

works.forEach((work) => {
  work.characters.forEach((character) => {
    character.workId = work.id;
  });
  work.searchBlob = normalizeText([
    work.title, work.jp, work.year, work.typeLabel,
    work.director, work.writer, work.tags.join(" "),
    work.short, work.detail,
    work.characters.map((character) => `${character.cn} ${character.jp}`).join(" ")
  ].join(" "));
});

const timelineTrack = $("#timelineTrack");
const worksGrid = $("#worksGrid");
const worksPagination = $("#worksPagination");
const paginationSummary = $("#paginationSummary");
const pageNumbers = $("#pageNumbers");
const pagePrev = $("#pagePrev");
const pageNext = $("#pageNext");
const paginationControls = $("#paginationControls");
const pageSizeSelect = $("#pageSize");
const sortDir = $("#sortDir");
const sortDirIcon = $("#sortDirIcon");
const sortDirLabel = $("#sortDirLabel");
const emptyState = $("#emptyState");
const worksCount = $("#worksCount");
const workSearch = $("#workSearch");
const characterGrid = $("#characterGrid");
const characterSearch = $("#characterSearch");
const characterWorkFilter = $("#characterWorkFilter");
const characterCount = $("#characterCount");
const characterTotal = $("#characterTotal");
const characterEmpty = $("#characterEmpty");
const characterClear = $("#characterClear");
const characterPagination = $("#characterPagination");
const characterPaginationSummary = $("#characterPaginationSummary");
const characterPageNumbers = $("#characterPageNumbers");
const characterPrev = $("#characterPrev");
const characterNext = $("#characterNext");
const characterPageSizeSelect = $("#characterPageSize");
const heroArtSlides = $$(".hero-art");
const heroCaption = $("#heroCaption");

/* ---------- 图片加载失败的回退：不出现破图 ---------- */
window.__imageFallback = function (img) {
  const fallback = img.dataset.fallbackSrc;
  if (fallback && img.dataset.fallbackTried !== "1") {
    img.dataset.fallbackTried = "1";
    img.src = fallback;
    return;
  }
  const frame = img.closest("[data-art-frame], .avatar, .character-card__portrait, .modal-hero");
  if (frame) frame.classList.add("is-fallback");
  img.style.display = "none";
  img.setAttribute("alt", "");
};

function coverMarkup(work, { eager = false } = {}) {
  return `<img src="${escapeXML(imageSrc(work.cover))}" data-fallback-src="${escapeXML(work.coverFallback)}"
    alt="《${escapeXML(work.title)}》作品海报，来自公开资料"
    width="800" height="1200" loading="${eager ? "eager" : "lazy"}" decoding="async"
    referrerpolicy="no-referrer" onerror="window.__imageFallback(this)">`;
}

function coverFallback(work) {
  return `<div class="art-fallback" aria-hidden="true">
    <span class="art-fallback__jp">${escapeXML(work.jp)}</span>
    <span class="art-fallback__label">IMAGE PREVIEW · ${escapeXML(work.year)}</span>
  </div>`;
}

function avatarMarkup(work, character, { decorative = true } = {}) {
  const alt = decorative ? "" : `${character.cn}，来自《${work.title}》的角色画像`;
  return `<span class="avatar" aria-hidden="${decorative ? "true" : "false"}">
    <img src="${escapeXML(imageSrc(character.image))}" alt="${escapeXML(alt)}" width="400" height="500"
      loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="window.__imageFallback(this)">
    <span class="avatar__fallback" aria-hidden="true">${escapeXML(Array.from(character.cn)[0] || "京")}</span>
  </span>`;
}

function castMarkup(work) {
  const all = work.characters;
  const cast = all.slice(0, 3);
  if (!cast.length) return "";
  const names = all.map((character) => character.cn).join("、");
  const preview = all.slice(0, 2).map((character) => character.cn).join(" · ");
  return `<div class="cast-row" title="主要角色：${escapeXML(names)}">
    <div class="avatar-stack" role="img" aria-label="主要角色共 ${all.length} 人：${escapeXML(names)}">
      ${cast.map((character) => avatarMarkup(work, character)).join("")}
    </div>
    ${all.length > 3 ? `<span class="cast-more" aria-hidden="true">+${all.length - 3}</span>` : ""}
    <span class="cast-label">主要角色 · ${all.length} 人<span>${escapeXML(preview)}${all.length > 2 ? " …" : ""}</span></span>
  </div>`;
}

function ratingMarkup(work) {
  if (work.score === null || work.score === undefined) {
    return `<span class="rating rating--empty" aria-label="${RATING.platform} 暂无公开评分">
      <span class="rating__line"><span class="plat">${RATING.platform}</span><strong>—</strong><span class="denom">/ 10</span></span>
      <span class="rating__meta">统计 ${RATING.shortTime} · 暂无公开评分</span>
    </span>`;
  }
  return `<span class="rating" aria-label="${RATING.platform} 参考评分 ${Number(work.score).toFixed(1)} / 10，统计时间 ${RATING.time}">
    <span class="rating__line"><span class="plat">${RATING.platform}</span><strong>${Number(work.score).toFixed(1)}</strong><span class="denom">/ 10</span></span>
    <span class="rating__meta">统计 ${RATING.shortTime} · 参考</span>
  </span>`;
}

function typePill(work) {
  return `<span class="type-pill">${escapeXML(work.typeLabel)}</span>`;
}

function tagsMarkup(work) {
  return work.tags.map((tag) => `<span class="tag">${escapeXML(tag)}</span>`).join("");
}

function workMeta(work) {
  return `<span class="type-pill">${escapeXML(work.typeLabel)}</span>
    <span>${work.year}</span>
    <span class="sep" aria-hidden="true"></span>
    <span>${escapeXML(work.tags.slice(0, 2).join(" / "))}</span>`;
}

/* ---------- 作品列表渲染 ---------- */
function matchesState(work) {
  if (state.filter !== "all" && work.type !== state.filter) return false;
  if (state.query && !work.searchBlob.includes(state.query)) return false;
  return true;
}

function renderWorkCards(list, startIndex = 0) {
  worksGrid.innerHTML = list.map((work, index) => {
    const overallIndex = startIndex + index + 1;
    return `<article class="work-card" style="--i:${Math.min(index, 9)}">
      <div class="work-card__media art-frame" data-art-frame>
        ${coverMarkup(work)}
        ${coverFallback(work)}
        <span class="work-card__no" aria-hidden="true">${String(overallIndex).padStart(2, "0")}</span>
        <span class="work-card__type">${escapeXML(work.typeLabel)} · ${work.year}</span>
      </div>
      <div class="work-card__body">
        <div class="work-meta"><span>${work.year}</span><span class="sep" aria-hidden="true"></span><span>${escapeXML(work.tags.slice(0, 2).join(" / "))}</span></div>
        <h3 class="work-card__title">${escapeXML(work.title)}</h3>
        <p class="work-card__jp">${escapeXML(work.jp)}</p>
        <p class="work-card__desc">${escapeXML(work.short)}</p>
        <div class="work-card__footer">
          ${castMarkup(work)}
          ${ratingMarkup(work)}
        </div>
      </div>
      <button class="work-hit" type="button" data-open-work="${escapeXML(work.id)}" aria-haspopup="dialog" aria-label="查看《${escapeXML(work.title)}》的作品详情与人物"></button>
    </article>`;
  }).join("");
}

function updateWorksCount(count, total = works.length) {
  worksCount.innerHTML = `<strong>${count}</strong> 部作品`;
  worksCount.setAttribute("aria-label", `当前显示 ${count} 部作品，共 ${total} 部`);
}

function sortedVisibleWorks() {
  const directionFactor = state.direction === "desc" ? 1 : -1;
  const filtered = works
    .map((work, index) => ({ work, index }))
    .filter((entry) => matchesState(entry.work));

  filtered.sort((a, b) => {
    if (state.sort === "score") {
      const aScore = a.work.score === null || a.work.score === undefined ? -Infinity : a.work.score;
      const bScore = b.work.score === null || b.work.score === undefined ? -Infinity : b.work.score;
      const aMissing = aScore === -Infinity;
      const bMissing = bScore === -Infinity;
      if (aMissing !== bMissing) return aMissing ? 1 : -1;
      if (aScore !== bScore) return (bScore - aScore) * directionFactor;
      if (a.work.year !== b.work.year) return b.work.year - a.work.year;
      return a.index - b.index;
    }
    if (a.work.year !== b.work.year) return (b.work.year - a.work.year) * directionFactor;
    return a.index - b.index;
  });

  return filtered.map((entry) => entry.work);
}

function renderSortDirection() {
  const descending = state.direction === "desc";
  sortDirIcon.textContent = descending ? "↓" : "↑";
  sortDirLabel.textContent = descending ? "降序" : "升序";
  sortDir.title = descending ? "切换为升序" : "切换为降序";
  sortDir.setAttribute("aria-label", descending ? "当前降序，点击切换为升序" : "当前升序，点击切换为降序");
}

function renderPagination(totalCount, totalPages) {
  if (!worksPagination) return;
  const hasResults = totalCount > 0;
  worksPagination.hidden = !hasResults;
  if (!hasResults) {
    paginationSummary.textContent = "";
    pageNumbers.innerHTML = "";
    paginationControls.hidden = true;
    return;
  }

  paginationSummary.innerHTML = `第 <strong>${String(state.page).padStart(2, "0")}</strong> / ${String(totalPages).padStart(2, "0")} 页 · 共 <strong>${totalCount}</strong> 部`;
  const needsPager = totalPages > 1;
  paginationControls.hidden = !needsPager;
  if (!needsPager) {
    pageNumbers.innerHTML = "";
    pagePrev.disabled = true;
    pageNext.disabled = true;
    return;
  }

  pageNumbers.innerHTML = Array.from({ length: totalPages }, (_, index) => {
    const page = index + 1;
    const current = page === state.page;
    return `<button class="page-num" type="button" data-page="${page}" aria-label="第 ${page} 页"${current ? ' aria-current="page"' : ""}>${String(page).padStart(2, "0")}</button>`;
  }).join("");
  pagePrev.disabled = state.page <= 1;
  pageNext.disabled = state.page >= totalPages;
}

function renderWorks() {
  const visible = sortedVisibleWorks();
  const totalPages = Math.max(1, Math.ceil(visible.length / state.pageSize));
  state.page = Math.min(Math.max(1, state.page), totalPages);
  const start = (state.page - 1) * state.pageSize;
  const pageWorks = visible.slice(start, start + state.pageSize);

  worksGrid.hidden = pageWorks.length === 0;
  emptyState.hidden = visible.length !== 0;
  renderWorkCards(pageWorks, start);
  updateWorksCount(visible.length);
  renderPagination(visible.length, totalPages);
}

function scrollToWorks() {
  const toolbar = document.getElementById("worksToolbar");
  if (!toolbar) return;
  const top = toolbar.getBoundingClientRect().top + window.scrollY - 96;
  window.scrollTo({ top, behavior: isReduced() ? "auto" : "smooth" });
}

function setPage(page) {
  const visible = sortedVisibleWorks();
  const totalPages = Math.max(1, Math.ceil(visible.length / state.pageSize));
  const nextPage = Math.min(Math.max(1, page), totalPages);
  if (nextPage === state.page) return;
  state.page = nextPage;
  renderWorks();
  scrollToWorks();
}

function setSort(sort) {
  if (sort !== "date" && sort !== "score") return;
  if (state.sort === sort) return;
  state.sort = sort;
  state.direction = "desc";
  state.page = 1;
  $$(".sort-btn").forEach((button) => {
    const active = button.dataset.sort === sort;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  renderSortDirection();
  renderWorks();
}

function setFilter(filter) {
  state.filter = filter;
  state.page = 1;
  $$(".filter-btn").forEach((button) => {
    const active = button.dataset.filter === filter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  renderWorks();
}

function setQuery(value) {
  state.query = normalizeText(value);
  state.page = 1;
  renderWorks();
}

$$(".filter-btn").forEach((button) => {
  button.addEventListener("click", () => setFilter(button.dataset.filter));
});

$$(".sort-btn").forEach((button) => {
  button.addEventListener("click", () => setSort(button.dataset.sort));
});

sortDir.addEventListener("click", () => {
  state.direction = state.direction === "desc" ? "asc" : "desc";
  state.page = 1;
  renderSortDirection();
  renderWorks();
});

renderSortDirection();

pageNumbers.addEventListener("click", (event) => {
  const button = event.target.closest("[data-page]");
  if (!button) return;
  setPage(Number(button.dataset.page));
});
pagePrev.addEventListener("click", () => setPage(state.page - 1));
pageNext.addEventListener("click", () => setPage(state.page + 1));

pageSizeSelect.addEventListener("change", () => {
  const nextSize = Number(pageSizeSelect.value);
  if (![12, 20, 40].includes(nextSize)) return;
  state.pageSize = nextSize;
  state.page = 1;
  renderWorks();
  scrollToWorks();
});

workSearch.addEventListener("input", (event) => setQuery(event.target.value));
workSearch.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && workSearch.value) {
    event.preventDefault();
    workSearch.value = "";
    setQuery("");
    workSearch.blur();
  }
});

[workSearch, characterSearch].forEach((input) => {
  const hint = input.closest(".search-wrap")?.querySelector(".search-hint");
  hint?.addEventListener("click", () => input.focus());
});
characterSearch.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && characterSearch.value) {
    event.preventDefault();
    characterSearch.value = "";
    characterState.query = "";
    characterState.page = 1;
    renderCharacters();
    characterSearch.blur();
  }
});

$("#emptyClear").addEventListener("click", () => {
  state.filter = "all";
  state.query = "";
  state.page = 1;
  workSearch.value = "";
  $$(".filter-btn").forEach((button) => {
    const active = button.dataset.filter === "all";
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  renderWorks();
  workSearch.focus({ preventScroll: true });
});

const counts = {
  all: works.length,
  tv: works.filter((work) => work.type === "tv").length,
  movie: works.filter((work) => work.type === "movie").length,
  short: works.filter((work) => work.type === "short").length
};
$$(".filter-btn").forEach((button) => {
  const countEl = $(".count", button);
  if (countEl) countEl.textContent = String(counts[button.dataset.filter] ?? 0);
});

document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target;
  const editable = target instanceof HTMLElement && (
    target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable
  );
  if (event.key === "/" && !editable && !modalOpen && !characterOpen && !quoteOpen && !menuOpen) {
    event.preventDefault();
    const characterSection = document.getElementById("characters");
    const inCharacters = characterSection && window.scrollY + window.innerHeight / 2 >= characterSection.offsetTop;
    const target = inCharacters ? characterSearch : workSearch;
    target.focus({ preventScroll: false });
    target.scrollIntoView({ behavior: isReduced() ? "auto" : "smooth", block: "center" });
  }
});

/* ---------- 角色图鉴 ---------- */
const characterState = { query: "", work: "all", page: 1, pageSize: 24 };
let characterAtlas = [];

function buildCharacterAtlas() {
  const map = new Map();
  let order = 0;
  works.forEach((work, workIndex) => {
    (work.characters || []).forEach((character) => {
      if (character.id === null || character.id === undefined) return;
      let entry = map.get(character.id);
      if (!entry) {
        entry = { ...character, works: [], firstWorkIndex: workIndex, order: order++ };
        map.set(character.id, entry);
      }
      entry.works.push(work);
    });
  });
  characterAtlas = Array.from(map.values());
  characterAtlas.forEach((entry) => {
    entry.works.sort((a, b) => works.indexOf(a) - works.indexOf(b));
    entry.primaryWork = entry.works[0];
    entry.searchBlob = normalizeText([
      entry.cn, entry.jp, entry.desc,
      entry.works.map((work) => work.title).join(" ")
    ].join(" "));
  });
  characterAtlas.sort((a, b) => a.firstWorkIndex - b.firstWorkIndex || a.order - b.order);
  if (characterTotal) characterTotal.textContent = String(characterAtlas.length);
  if (characterWorkFilter && characterWorkFilter.options.length <= 1) {
    works.forEach((work) => {
      const option = document.createElement("option");
      option.value = work.id;
      option.textContent = `${work.year} · ${work.title}`;
      characterWorkFilter.appendChild(option);
    });
  }
}

function filteredCharacters() {
  const query = normalizeText(characterState.query);
  return characterAtlas.filter((character) => {
    if (characterState.work !== "all" && !character.works.some((work) => work.id === characterState.work)) return false;
    if (query && !character.searchBlob.includes(query)) return false;
    return true;
  });
}

function characterCardMarkup(character, number) {
  const workTitle = character.primaryWork?.title || "";
  const workCount = character.works.length;
  const workLabel = workCount > 1 ? `《${workTitle}》等 ${workCount} 部` : `《${workTitle}》`;
  const source = imageSrc(character.image || "");
  const alt = `${character.cn || character.jp}，来自${workLabel}的角色画像`;
  const img = source
    ? `<img src="${escapeXML(source)}" alt="${escapeXML(alt)}" width="400" height="500" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="window.__imageFallback(this)">`
    : "";
  const jp = character.jp && character.jp !== character.cn
    ? `<p class="atlas-card__jp">${escapeXML(character.jp)}</p>`
    : "";
  return `<button class="atlas-card" type="button" data-character-id="${character.id}" aria-label="查看${escapeXML(character.cn || character.jp)}的角色介绍">
    <div class="character-card__portrait atlas-card__portrait${source ? "" : " is-fallback"}" data-art-frame>
      ${img}
      <span class="portrait-fallback" aria-hidden="true">
        <span>${escapeXML(Array.from(character.cn || character.jp || "京")[0])}</span>
        <small>${escapeXML(workTitle)}</small>
      </span>
      <span class="character-card__no" aria-hidden="true">${String(number).padStart(2, "0")}</span>
    </div>
    <div class="atlas-card__body">
      <p class="atlas-card__work" title="${escapeXML(character.works.map((work) => work.title).join(" / "))}">${escapeXML(workLabel)}</p>
      <h3 class="atlas-card__name">${escapeXML(character.cn || character.jp)}</h3>
      ${jp}
    </div>
  </button>`;
}

function renderCharacterPagination(total, totalPages) {
  if (!characterPagination) return;
  const show = total > characterState.pageSize;
  characterPagination.hidden = !show;
  if (!show) {
    characterPaginationSummary.textContent = "";
    characterPageNumbers.innerHTML = "";
    return;
  }
  characterPaginationSummary.innerHTML = `第 <strong>${String(characterState.page).padStart(2, "0")}</strong> / ${String(totalPages).padStart(2, "0")} 页 · 共 <strong>${total}</strong> 位`;
  characterPageNumbers.innerHTML = Array.from({ length: totalPages }, (_, index) => {
    const page = index + 1;
    const current = page === characterState.page;
    return `<button class="page-num" type="button" data-character-page="${page}" aria-label="角色第 ${page} 页"${current ? ' aria-current="page"' : ""}>${String(page).padStart(2, "0")}</button>`;
  }).join("");
  characterPrev.disabled = characterState.page <= 1;
  characterNext.disabled = characterState.page >= totalPages;
}

function renderCharacters() {
  if (!characterAtlas.length) buildCharacterAtlas();
  const visible = filteredCharacters();
  const totalPages = Math.max(1, Math.ceil(visible.length / characterState.pageSize));
  characterState.page = Math.min(Math.max(1, characterState.page), totalPages);
  const start = (characterState.page - 1) * characterState.pageSize;
  const pageItems = visible.slice(start, start + characterState.pageSize);
  characterGrid.innerHTML = pageItems.map((character, index) => characterCardMarkup(character, start + index + 1)).join("");
  characterGrid.hidden = pageItems.length === 0;
  characterEmpty.hidden = visible.length !== 0;
  if (characterCount) characterCount.innerHTML = `<strong>${visible.length}</strong> 位主角`;
  renderCharacterPagination(visible.length, totalPages);
}

function setCharacterPage(page) {
  const totalPages = Math.max(1, Math.ceil(filteredCharacters().length / characterState.pageSize));
  const nextPage = Math.min(Math.max(1, page), totalPages);
  if (nextPage === characterState.page) return;
  characterState.page = nextPage;
  renderCharacters();
  const anchor = document.getElementById("characters");
  if (anchor) window.scrollTo({ top: anchor.offsetTop + 80, behavior: isReduced() ? "auto" : "smooth" });
}

characterSearch.addEventListener("input", (event) => {
  characterState.query = event.target.value;
  characterState.page = 1;
  renderCharacters();
});
characterWorkFilter.addEventListener("change", (event) => {
  characterState.work = event.target.value;
  characterState.page = 1;
  renderCharacters();
});
characterClear.addEventListener("click", () => {
  characterState.query = "";
  characterState.work = "all";
  characterState.page = 1;
  characterSearch.value = "";
  characterWorkFilter.value = "all";
  renderCharacters();
  characterSearch.focus();
});
characterPageNumbers.addEventListener("click", (event) => {
  const button = event.target.closest("[data-character-page]");
  if (!button) return;
  setCharacterPage(Number(button.dataset.characterPage));
});
characterPrev.addEventListener("click", () => setCharacterPage(characterState.page - 1));
characterNext.addEventListener("click", () => setCharacterPage(characterState.page + 1));
characterPageSizeSelect.addEventListener("change", () => {
  const nextSize = Number(characterPageSizeSelect.value);
  if (![12, 24, 48].includes(nextSize)) return;
  characterState.pageSize = nextSize;
  characterState.page = 1;
  renderCharacters();
  const anchor = document.getElementById("characters");
  if (anchor) window.scrollTo({ top: anchor.offsetTop + 80, behavior: isReduced() ? "auto" : "smooth" });
});

/* ---------- 年表渲染 ---------- */
function renderTimeline() {
  timelineTrack.setAttribute("role", "list");
  timelineTrack.innerHTML = timelineData.map((item) => `<article class="timeline-item" role="listitem">
    <div class="timeline-year">${escapeXML(item.year)}</div>
    <div class="timeline-kind">${escapeXML(item.kind)}</div>
    <span class="timeline-node" aria-hidden="true"></span>
    <div class="timeline-copy">
      <h3>${escapeXML(item.title)}</h3>
      <p>${escapeXML(item.desc)}</p>
      <span class="timeline-tag">${escapeXML(item.tag)}</span>
    </div>
  </article>`).join("");
}

/* ---------- 详情弹窗 ---------- */
const workModal = $("#workModal");
const modalPanel = $(".modal__panel", workModal);
const modalScroll = $("#modalScroll");
const modalClose = $("#modalClose");
const siteHeader = $("#siteHeader");
const mainEl = $("#main");
const footerEl = $("#footer");
let modalOpen = false;
let lastFocused = null;
let modalHideTimer = null;
let menuOpen = false;
let menuHideTimer = null;
const menuToggle = $("#menuToggle");
const mobileMenu = $("#mobileMenu");
const characterModal = $("#characterModal");
const characterModalPanel = $(".character-modal__panel", characterModal);
const characterModalClose = $("#characterModalClose");
const characterModalImage = $("#characterModalImage");
const characterModalFallback = $("#characterModalFallback");
const characterModalName = $("#characterModalName");
const characterModalJp = $("#characterModalJp");
const characterModalWorks = $("#characterModalWorks");
const characterModalDesc = $("#characterModalDesc");
const characterModalSource = $("#characterModalSource");
const characterShareButton = $("#characterShareButton");
const characterQuoteButton = $("#characterQuoteButton");
const quoteModal = $("#quoteModal");
const quotePanel = $(".quote-modal__panel", quoteModal);
const quoteModalClose = $("#quoteModalClose");
const quoteCanvas = $("#quoteCanvas");
const quoteInput = $("#quoteInput");
const quoteName = $("#quoteName");
const quoteHint = $("#quoteHint");
const quoteDownload = $("#quoteDownload");
const quoteCopy = $("#quoteCopy");
const quoteImageCache = new Map();
characterModalImage?.addEventListener("error", () => window.__imageFallback(characterModalImage));
let characterOpen = false;
let characterLastFocused = null;
let characterHideTimer = null;
let activeWorkId = null;
let activeCharacterId = null;
let suppressUrlSync = false;
let quoteOpen = false;
let quoteCharacter = null;
let quoteLastFocused = null;
let quoteHideTimer = null;

function lockPage() {
  document.body.classList.toggle("is-locked", modalOpen || characterOpen || quoteOpen || menuOpen);
}

function setPageInert(inert) {
  if (siteHeader) siteHeader.inert = inert;
  if (mainEl) mainEl.inert = inert;
  if (footerEl) footerEl.inert = inert;
}

function getFocusable(container) {
  return $$("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])", container)
    .filter((element) => {
      const style = window.getComputedStyle(element);
      return style.visibility !== "hidden" && style.display !== "none" && element.getClientRects().length > 0;
    });
}

function formatArchiveDate(value) {
  const text = String(value || "");
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : text;
}

function workLength(work) {
  if (work.type === "movie") return work.runtime || "剧场版";
  if (work.type === "tv") return work.episodes ? `${work.episodes} 话` : "TV 动画";
  if (work.runtime) return work.runtime;
  if (work.episodes) return `${work.episodes} 话`;
  return work.typeLabel;
}

function workPeriod(work) {
  if (work.broadcastStart) {
    return work.broadcastEnd ? `${work.broadcastStart} — ${work.broadcastEnd}` : work.broadcastStart;
  }
  return formatArchiveDate(work.releaseDate) || String(work.year);
}

function relatedWorksFor(work) {
  return works
    .filter((item) => item.id !== work.id && (item.director === work.director || item.writer === work.writer))
    .sort((a, b) => {
      const ad = a.director === work.director ? 1 : 0;
      const bd = b.director === work.director ? 1 : 0;
      return bd - ad || b.year - a.year;
    })
    .slice(0, 4);
}

function archiveRowMarkup(label, value, className = "") {
  return `<div class="archive-row ${className}"><dt>${escapeXML(label)}</dt><dd>${value}</dd></div>`;
}

function archiveValueMarkup(value) {
  return escapeXML(value);
}

function themeRowsMarkup(work) {
  const rows = [];
  (work.openings || []).forEach((item) => {
    rows.push(archiveRowMarkup("OP", `<span class="archive-song-title">${escapeXML(item.title)}</span>${item.artist ? `<span class="archive-song-artist">${escapeXML(item.artist)}</span>` : ""}`, "archive-row--theme"));
  });
  (work.endings || []).forEach((item) => {
    rows.push(archiveRowMarkup("ED", `<span class="archive-song-title">${escapeXML(item.title)}</span>${item.artist ? `<span class="archive-song-artist">${escapeXML(item.artist)}</span>` : ""}`, "archive-row--theme"));
  });
  return rows.join("");
}

function workArchiveMarkup(work) {
  const info = [
    ["发行 / 放送", workPeriod(work)],
    ["话数 / 片长", workLength(work)]
  ];
  if (work.source) info.push(["原作", work.source]);
  const credits = [
    ["导演 / 监督", work.director],
    ["编剧 / 系列构成", work.writer],
    ["制作公司", work.studio],
    ["音乐", work.music]
  ].filter(([, value]) => value);
  const themes = themeRowsMarkup(work);
  return `<section class="modal-section">
    <p class="modal-section__eyebrow">Archive / 作品档案</p>
    <div class="archive-ledger">
      <div class="archive-group">
        <p class="archive-group__label">作品信息</p>
        <dl class="archive-rows">${info.map(([label, value]) => archiveRowMarkup(label, archiveValueMarkup(value))).join("")}</dl>
      </div>
      <div class="archive-group">
        <p class="archive-group__label">制作</p>
        <dl class="archive-rows">${credits.map(([label, value]) => archiveRowMarkup(label, archiveValueMarkup(value))).join("")}</dl>
      </div>
      ${themes ? `<div class="archive-group"><p class="archive-group__label">主题歌</p><dl class="archive-rows">${themes}</dl></div>` : ""}
    </div>
  </section>`;
}

function relatedWorksMarkup(work) {
  const related = relatedWorksFor(work);
  if (!related.length) return "";
  return `<section class="modal-section">
    <p class="modal-section__eyebrow">Related / 相关作品</p>
    <p class="related-note">同监督或同编剧的作品，点击可直接切换。</p>
    <div class="related-works">
      ${related.map((item) => `<button class="related-work" type="button" data-related-work="${escapeXML(item.id)}"><span>《${escapeXML(item.title)}》</span><small>${escapeXML(item.year)} · ${item.director === work.director ? "同监督" : "同编剧"}</small></button>`).join("")}
    </div>
  </section>`;
}

function modalHTML(work) {
  const index = works.indexOf(work) + 1;
  const characterItems = work.characters.map((character) => `<button class="modal-char" type="button" data-character-id="${character.id}" aria-label="查看${escapeXML(character.cn)}的角色介绍">
    <span class="avatar" aria-hidden="true">
      <img src="${escapeXML(imageSrc(character.image))}" alt="" width="400" height="500" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="window.__imageFallback(this)">
      <span class="avatar__fallback" aria-hidden="true">${escapeXML(Array.from(character.cn)[0] || "京")}</span>
    </span>
    <div class="modal-char__text">
      <h3 class="modal-char__name">${escapeXML(character.cn)}</h3>
      <p class="modal-char__jp">${escapeXML(character.jp)}</p>
      <p class="modal-char__desc">${escapeXML(character.desc)}</p>
    </div>
  </button>`).join("");

  return `<div class="modal-hero art-frame" data-art-frame>
    ${coverMarkup(work, { eager: true })}
    ${coverFallback(work)}
    <span class="modal-hero__label">WORK ARCHIVE / ${String(index).padStart(2, "0")}</span>
    <div class="modal-hero__title">
      <h2 id="modalTitle">${escapeXML(work.title)}</h2>
      <p class="jp">${escapeXML(work.jp)}</p>
    </div>
  </div>
  <div class="modal-body">
    <div class="modal-topline">
      <div class="modal-meta">${workMeta(work)}</div>
      <div class="modal-rating">${ratingMarkup(work)}</div>
    </div>
    <section class="modal-section">
      <p class="modal-section__eyebrow">Synopsis / 故事</p>
      <p class="modal-synopsis" id="modalDesc">${escapeXML(work.detail)}</p>
      <div class="modal-tags">${tagsMarkup(work)}</div>
    </section>

    ${workArchiveMarkup(work)}

    <section class="modal-section">
      <p class="modal-section__eyebrow">Characters / 主要人物</p>
      <div class="modal-characters">${characterItems}</div>
    </section>

    ${relatedWorksMarkup(work)}

    <div class="modal-source">
      <span>评分平台：${RATING.label} · 统计时间：${RATING.time} · 参考值，非官方实时评分。<br>作品海报来自各作品公开资料 / Bangumi，角色画像来自 AniList / Bangumi，版权归原权利人所有。</span>
      <span class="modal-source__links">
        <a class="modal-source__link" href="${escapeXML(work.bgmUrl)}" target="_blank" rel="noopener noreferrer">Bangumi 作品页 ↗</a>
        <a class="modal-source__link" href="${escapeXML(work.officialUrl)}" target="_blank" rel="noopener noreferrer">官方作品页 ↗</a>
        <button class="modal-source__link modal-share" type="button" data-copy-link>复制作品链接</button>
      </span>
    </div>
  </div>`;
}

function parseModalLocation() {
  const params = new URLSearchParams(window.location.search);
  const work = params.get("work");
  const character = params.get("character");
  return {
    work: work && workById.has(work) ? work : null,
    character: character && characterAtlas.some((item) => String(item.id) === String(character)) ? String(character) : null
  };
}

function syncModalUrl(mode = "replace") {
  if (suppressUrlSync) return;
  const url = new URL(window.location.href);
  url.searchParams.delete("work");
  url.searchParams.delete("character");
  if (activeWorkId) url.searchParams.set("work", activeWorkId);
  if (activeCharacterId !== null) url.searchParams.set("character", String(activeCharacterId));
  const state = activeWorkId || activeCharacterId !== null ? { modal: true } : null;
  const href = url.pathname + url.search + url.hash;
  if (mode === "push") window.history.pushState(state, "", href);
  else window.history.replaceState(state, "", href);
}

async function copyCurrentLink(button) {
  syncModalUrl("replace");
  const original = button.textContent;
  let ok = false;
  try {
    await navigator.clipboard.writeText(window.location.href);
    ok = true;
  } catch {
    try {
      const helper = document.createElement("textarea");
      helper.value = window.location.href;
      helper.setAttribute("readonly", "");
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      document.body.appendChild(helper);
      helper.select();
      ok = document.execCommand("copy");
      helper.remove();
    } catch {
      ok = false;
    }
  }
  button.textContent = ok ? "链接已复制" : "复制失败";
  clearTimeout(button._copyTimer);
  button._copyTimer = window.setTimeout(() => { button.textContent = original; }, 1600);
}

function canvasRoundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawCanvasCover(ctx, image, x, y, w, h) {
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (image.naturalWidth - sw) / 2;
  const sy = 0;
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

function fitCanvasFont(ctx, text, maxWidth, start, min, weight = 500) {
  let size = start;
  do {
    ctx.font = `${weight} ${size}px "Noto Serif SC", "Songti SC", "SimSun", serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  } while (size > min);
  return size;
}

function wrapCanvasText(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  Array.from(text).forEach((char) => {
    const test = line + char;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = char;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function drawQuoteCard(character, quote, image) {
  if (!quoteCanvas || !character) return;
  const ctx = quoteCanvas.getContext("2d");
  const W = quoteCanvas.width;
  const H = quoteCanvas.height;
  const serif = '"Noto Serif SC", "Songti SC", "SimSun", serif';

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#fbf8f1");
  bg.addColorStop(0.55, "#f5eee2");
  bg.addColorStop(1, "#eef2ed");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = "#e8c2c2";
  ctx.beginPath();
  ctx.arc(105, 115, 180, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c9dde2";
  ctx.beginPath();
  ctx.arc(975, 1230, 220, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(182, 149, 98, 0.34)";
  ctx.lineWidth = 2;
  ctx.strokeRect(32, 32, W - 64, H - 64);

  const px = 62;
  const py = 64;
  const pw = 390;
  const ph = 520;
  ctx.save();
  canvasRoundRect(ctx, px, py, pw, ph, 18);
  ctx.clip();
  ctx.fillStyle = "rgba(255, 255, 255, 0.36)";
  ctx.fillRect(px, py, pw, ph);
  if (image && image.naturalWidth) {
    drawCanvasCover(ctx, image, px, py, pw, ph);
  } else {
    ctx.fillStyle = "rgba(38, 53, 65, 0.08)";
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = "#465863";
    ctx.font = `500 110px ${serif}`;
    ctx.textAlign = "center";
    ctx.fillText(Array.from(character.cn || character.jp || "京")[0], px + pw / 2, py + ph / 2);
    ctx.textAlign = "left";
  }
  const portraitShade = ctx.createLinearGradient(0, py + ph - 170, 0, py + ph);
  portraitShade.addColorStop(0, "rgba(20, 31, 40, 0)");
  portraitShade.addColorStop(1, "rgba(20, 31, 40, 0.56)");
  ctx.fillStyle = portraitShade;
  ctx.fillRect(px, py + ph - 170, pw, 170);
  ctx.fillStyle = "rgba(255, 252, 246, 0.9)";
  ctx.font = "500 16px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("KYOTO ANIMATION / CHARACTER", px + 22, py + ph - 22);
  ctx.restore();

  const x = 505;
  ctx.fillStyle = "#b69562";
  ctx.font = "500 18px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("CHARACTER ARCHIVE / KYOTO ANIMATION", x, 128);

  const name = character.cn || character.jp || "";
  const nameSize = fitCanvasFont(ctx, name, 495, 64, 34, 500);
  ctx.fillStyle = "#263541";
  ctx.font = `500 ${nameSize}px ${serif}`;
  ctx.fillText(name, x, 222);
  ctx.fillStyle = "#5c6c75";
  ctx.font = `400 23px ${serif}`;
  ctx.fillText(character.jp && character.jp !== name ? character.jp : "", x, 264);

  ctx.strokeStyle = "rgba(38, 53, 65, 0.16)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, 294);
  ctx.lineTo(x + 495, 294);
  ctx.stroke();

  const primaryWork = character.primaryWork || (character.works && character.works[0]);
  if (primaryWork) {
    const workLine = `《${primaryWork.title}》`;
    const workSize = fitCanvasFont(ctx, workLine, 495, 23, 16, 400);
    ctx.fillStyle = "#5c6c75";
    ctx.font = `400 ${workSize}px ${serif}`;
    ctx.fillText(workLine, x, 336);
  }

  ctx.strokeStyle = "rgba(38, 53, 65, 0.14)";
  ctx.beginPath();
  ctx.moveTo(60, 646);
  ctx.lineTo(1020, 646);
  ctx.stroke();

  ctx.fillStyle = "rgba(182, 149, 98, 0.82)";
  ctx.font = `400 128px Georgia, "Times New Roman", serif`;
  ctx.fillText("“", 58, 786);

  const displayQuote = quote || "写下你想分享的一句台词。";
  ctx.fillStyle = quote ? "#263541" : "rgba(70, 88, 99, 0.38)";
  ctx.font = `400 38px ${serif}`;
  const quoteLines = wrapCanvasText(ctx, displayQuote, 820);
  const maxLines = 6;
  quoteLines.slice(0, maxLines).forEach((line, index) => {
    const text = index === maxLines - 1 && quoteLines.length > maxLines ? `${line}…` : line;
    ctx.fillText(text, 172, 710 + index * 58);
  });

  ctx.strokeStyle = "rgba(38, 53, 65, 0.14)";
  ctx.beginPath();
  ctx.moveTo(60, 1180);
  ctx.lineTo(1020, 1180);
  ctx.stroke();
  ctx.fillStyle = "#5c6c75";
  ctx.font = "400 15px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("KYOTO ANIMATION / CHARACTER CARD", 60, 1224);
  ctx.fillStyle = "#8b9aa1";
  ctx.font = "400 13px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("PORTRAIT: ANILIST / BANGUMI", 60, 1252);
}

function updateQuoteCard() {
  if (!quoteCharacter) return;
  const quote = quoteInput.value.trim();
  quoteHint.textContent = quote ? "可在上方修改台词，保存为 PNG 分享。" : "输入一句台词后即可保存。";
  quoteDownload.disabled = !quote;
  quoteCopy.disabled = !quote;
  const src = imageSrc(quoteCharacter.image || "");
  let image = quoteImageCache.get(src);
  if (src && !image) {
    image = new Image();
    quoteImageCache.set(src, image);
    image.onload = () => {
      if (quoteOpen && quoteCharacter) drawQuoteCard(quoteCharacter, quoteInput.value.trim(), image);
    };
    image.onerror = () => drawQuoteCard(quoteCharacter, quoteInput.value.trim(), null);
    image.src = src;
  }
  drawQuoteCard(quoteCharacter, quote, image && image.complete && image.naturalWidth ? image : null);
}

function openQuoteModal() {
  if (quoteOpen || !characterOpen) return;
  const character = characterAtlas.find((item) => Number(item.id) === Number(activeCharacterId));
  if (!character) return;
  quoteCharacter = character;
  quoteLastFocused = document.activeElement;
  quoteName.textContent = character.cn || character.jp;
  const preset = typeof CHARACTER_QUOTES !== "undefined" ? (CHARACTER_QUOTES[character.id] || "") : "";
  quoteInput.value = preset;
  clearTimeout(quoteHideTimer);
  quoteModal.hidden = false;
  quoteOpen = true;
  characterModal.inert = true;
  updateQuoteCard();
  if (!preset) quoteHint.textContent = "暂未收录这位角色的台词，可以写一句你喜欢的台词。";
  requestAnimationFrame(() => {
    quoteModal.classList.add("is-open");
    quoteInput.focus({ preventScroll: true });
  });
  lockPage();
}

function closeQuoteModal({ restoreFocus = true } = {}) {
  if (!quoteOpen) return;
  quoteOpen = false;
  quoteModal.classList.remove("is-open");
  characterModal.inert = false;
  lockPage();
  const restoreTarget = restoreFocus && quoteLastFocused && quoteLastFocused.isConnected ? quoteLastFocused : null;
  quoteHideTimer = window.setTimeout(() => {
    quoteModal.hidden = true;
    if (restoreTarget) restoreTarget.focus({ preventScroll: true });
  }, isReduced() ? 20 : 320);
}

function downloadQuoteCard() {
  if (!quoteCharacter || !quoteInput.value.trim()) return;
  try {
    quoteCanvas.toBlob((blob) => {
      if (!blob) {
        quoteHint.textContent = "当前环境无法导出图片，请部署后重试。";
        return;
      }
      const link = document.createElement("a");
      const name = (quoteCharacter.cn || quoteCharacter.jp || "character").replace(/[\\/:*?"<>|]/g, "-");
      link.href = URL.createObjectURL(blob);
      link.download = `${name}-台词卡.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    }, "image/png");
  } catch {
    quoteHint.textContent = "当前环境无法导出图片，请部署后重试。";
  }
}

async function copyQuoteText() {
  const quote = quoteInput.value.trim();
  if (!quote || !quoteCharacter) return;
  const work = quoteCharacter.primaryWork || (quoteCharacter.works && quoteCharacter.works[0]);
  const text = `${quote}\n—— ${quoteCharacter.cn || quoteCharacter.jp}${work ? `《${work.title}》` : ""}`;
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    try {
      const helper = document.createElement("textarea");
      helper.value = text;
      helper.setAttribute("readonly", "");
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      document.body.appendChild(helper);
      helper.select();
      ok = document.execCommand("copy");
      helper.remove();
    } catch {
      ok = false;
    }
  }
  quoteCopy.textContent = ok ? "已复制" : "复制失败";
  window.setTimeout(() => { quoteCopy.textContent = "复制文字"; }, 1500);
}

function openCharacterModal(characterId, trigger) {
  if (characterOpen) return;
  if (!characterAtlas.length) buildCharacterAtlas();
  const character = characterAtlas.find((item) => Number(item.id) === Number(characterId));
  if (!character) return;
  characterLastFocused = trigger || document.activeElement;
  const image = imageSrc(character.image || "");
  const portrait = characterModalImage.closest("[data-art-frame]");
  portrait?.classList.remove("is-fallback");
  characterModalImage.hidden = !image;
  characterModalImage.alt = `${character.cn || character.jp}的角色画像`;
  characterModalImage.style.display = image ? "" : "none";
  if (image) characterModalImage.src = image;
  else characterModalImage.removeAttribute("src");
  characterModalFallback.textContent = Array.from(character.cn || character.jp || "京")[0];
  characterModalName.textContent = character.cn || character.jp;
  characterModalJp.textContent = character.jp && character.jp !== character.cn ? character.jp : "";
  const characterWorks = character.works
    .slice()
    .sort((a, b) => works.indexOf(a) - works.indexOf(b));
  characterModalWorks.innerHTML = characterWorks.map((work) => `<button class="character-modal__work" type="button" data-character-work="${escapeXML(work.id)}" aria-label="查看《${escapeXML(work.title)}》的动画详情">《${escapeXML(work.title)}》<small>${escapeXML(work.year)}</small></button>`).join("");
  characterModalDesc.textContent = character.desc || "主要角色，详细资料仍在整理中。";
  characterModalSource.href = `https://bgm.tv/character/${character.id}`;
  activeCharacterId = character.id;
  if (!modalOpen) activeWorkId = null;
  characterOpen = true;
  if (modalOpen) workModal.inert = true;
  else setPageInert(true);
  clearTimeout(characterHideTimer);
  characterModal.hidden = false;
  requestAnimationFrame(() => {
    characterModal.classList.add("is-open");
    characterModalClose.focus({ preventScroll: true });
  });
  syncModalUrl("push");
  lockPage();
}

function closeCharacterModal({ restoreFocus = true, updateUrl = true } = {}) {
  if (!characterOpen) return;
  if (quoteOpen) closeQuoteModal({ restoreFocus: false });
  characterOpen = false;
  activeCharacterId = null;
  characterModal.classList.remove("is-open");
  if (modalOpen) workModal.inert = false;
  else setPageInert(false);
  lockPage();
  if (updateUrl) syncModalUrl("replace");
  const restoreTarget = restoreFocus && characterLastFocused && characterLastFocused.isConnected ? characterLastFocused : null;
  characterHideTimer = window.setTimeout(() => {
    characterModal.hidden = true;
    if (restoreTarget) restoreTarget.focus({ preventScroll: true });
  }, isReduced() ? 20 : 320);
}

function switchWorkModal(workId, { pushHistory = true } = {}) {
  const work = workById.get(workId);
  if (!work) return;
  if (!modalOpen) {
    openModal(work.id);
    return;
  }
  modalScroll.innerHTML = modalHTML(work);
  modalScroll.scrollTop = 0;
  activeWorkId = work.id;
  activeCharacterId = null;
  if (pushHistory) syncModalUrl("push");
  modalClose.focus({ preventScroll: true });
}

function openWorkFromCharacter(workId) {
  const work = workById.get(workId);
  if (!work) return;
  const returnTarget = characterLastFocused;
  if (modalOpen) {
    switchWorkModal(workId);
    closeCharacterModal({ restoreFocus: false, updateUrl: false });
    requestAnimationFrame(() => {
      if (modalOpen) modalClose.focus({ preventScroll: true });
    });
  } else {
    closeCharacterModal({ restoreFocus: false, updateUrl: false });
    openModal(workId, returnTarget);
  }
}

function openModal(workId, trigger) {
  const work = workById.get(workId);
  if (!work || modalOpen) return;
  if (menuOpen) closeMenu(false);
  lastFocused = trigger || document.activeElement;
  modalScroll.innerHTML = modalHTML(work);
  modalScroll.scrollTop = 0;
  activeWorkId = work.id;
  activeCharacterId = null;
  modalOpen = true;
  clearTimeout(modalHideTimer);
  workModal.hidden = false;
  requestAnimationFrame(() => {
    workModal.classList.add("is-open");
    modalClose.focus({ preventScroll: true });
  });
  syncModalUrl("push");
  lockPage();
  setPageInert(true);
}

function closeModal({ restoreFocus = true, updateUrl = true } = {}) {
  if (!modalOpen) return;
  if (characterOpen) closeCharacterModal({ restoreFocus: false, updateUrl: false });
  modalOpen = false;
  activeWorkId = null;
  activeCharacterId = null;
  workModal.classList.remove("is-open");
  setPageInert(false);
  lockPage();
  if (updateUrl) syncModalUrl("replace");
  const restoreTarget = restoreFocus && lastFocused && lastFocused.isConnected ? lastFocused : null;
  modalHideTimer = window.setTimeout(() => {
    workModal.hidden = true;
    if (restoreTarget) restoreTarget.focus({ preventScroll: true });
  }, isReduced() ? 20 : 360);
}

function applyModalUrlState(target) {
  suppressUrlSync = true;
  if (characterOpen && (activeWorkId !== target.work || !target.character || String(activeCharacterId) !== String(target.character))) {
    closeCharacterModal({ restoreFocus: false, updateUrl: false });
  }
  if (!target.work) {
    if (modalOpen) closeModal({ restoreFocus: false, updateUrl: false });
  } else if (!modalOpen) {
    openModal(target.work, null);
  } else if (activeWorkId !== target.work) {
    switchWorkModal(target.work, { pushHistory: false });
  }
  if (target.character && !characterOpen) openCharacterModal(target.character, null);
  suppressUrlSync = false;
}

function initializeModalFromUrl() {
  const target = parseModalLocation();
  if (!target.work && !target.character) return;
  suppressUrlSync = true;
  if (target.work) openModal(target.work, null);
  if (target.character) openCharacterModal(target.character, null);
  suppressUrlSync = false;
  syncModalUrl("replace");
}

window.addEventListener("popstate", () => {
  applyModalUrlState(parseModalLocation());
});

modalClose.addEventListener("click", closeModal);
workModal.addEventListener("click", (event) => {
  const copyButton = event.target.closest("[data-copy-link]");
  if (copyButton) {
    copyCurrentLink(copyButton);
    return;
  }
  if (event.target.closest("[data-close-modal]")) {
    closeModal();
    return;
  }
  const relatedButton = event.target.closest("[data-related-work]");
  if (relatedButton) {
    switchWorkModal(relatedButton.dataset.relatedWork);
    return;
  }
  const characterButton = event.target.closest("[data-character-id]");
  if (characterButton) openCharacterModal(characterButton.dataset.characterId, characterButton);
});
characterModalClose.addEventListener("click", () => closeCharacterModal());
characterShareButton.addEventListener("click", () => copyCurrentLink(characterShareButton));
characterQuoteButton.addEventListener("click", () => openQuoteModal());
quoteModalClose.addEventListener("click", () => closeQuoteModal());
quoteModal.addEventListener("click", (event) => {
  if (event.target.closest("[data-close-quote]")) closeQuoteModal();
});
quoteInput.addEventListener("input", updateQuoteCard);
quoteDownload.addEventListener("click", downloadQuoteCard);
quoteCopy.addEventListener("click", copyQuoteText);
characterModal.addEventListener("click", (event) => {
  const workButton = event.target.closest("[data-character-work]");
  if (workButton) {
    openWorkFromCharacter(workButton.dataset.characterWork);
    return;
  }
  if (event.target.closest("[data-close-character]")) closeCharacterModal();
});
characterGrid.addEventListener("click", (event) => {
  const characterButton = event.target.closest("[data-character-id]");
  if (characterButton) openCharacterModal(characterButton.dataset.characterId, characterButton);
});

document.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-open-work]");
  if (!trigger) return;
  openModal(trigger.dataset.openWork, trigger);
});

/* ---------- 移动端菜单 ---------- */
function openMenu() {
  if (menuOpen) return;
  menuOpen = true;
  clearTimeout(menuHideTimer);
  mobileMenu.hidden = false;
  mobileMenu.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => {
    mobileMenu.classList.add("is-open");
    menuToggle.setAttribute("aria-expanded", "true");
    menuToggle.setAttribute("aria-label", "关闭导航菜单");
    const firstLink = $("a", mobileMenu);
    if (firstLink) firstLink.focus({ preventScroll: true });
  });
  if (mainEl) mainEl.inert = true;
  if (footerEl) footerEl.inert = true;
  lockPage();
}

function closeMenu(restoreFocus = true) {
  if (!menuOpen) return;
  menuOpen = false;
  mobileMenu.classList.remove("is-open");
  mobileMenu.setAttribute("aria-hidden", "true");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "打开导航菜单");
  if (mainEl) mainEl.inert = false;
  if (footerEl) footerEl.inert = false;
  lockPage();
  menuHideTimer = window.setTimeout(() => {
    mobileMenu.hidden = true;
  }, isReduced() ? 20 : 460);
  if (restoreFocus) menuToggle.focus({ preventScroll: true });
}

menuToggle.addEventListener("click", () => {
  if (menuOpen) closeMenu(true);
  else openMenu();
});

$$("[data-mobile-nav]").forEach((link) => {
  link.addEventListener("click", () => {
    closeMenu(false);
    window.setTimeout(() => menuToggle.focus({ preventScroll: true }), 0);
  });
});

const desktopMedia = window.matchMedia("(min-width: 861px)");
const onDesktopChange = (event) => {
  if (event.matches && menuOpen) closeMenu(false);
};
if (desktopMedia.addEventListener) desktopMedia.addEventListener("change", onDesktopChange);
else desktopMedia.addListener(onDesktopChange);

/* ---------- 全局键盘 / 焦点陷阱 ---------- */
document.addEventListener("keydown", (event) => {
  if (quoteOpen) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeQuoteModal();
      return;
    }
    if (event.key === "Tab") {
      const focusable = getFocusable(quotePanel);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !quotePanel.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !quotePanel.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }
    return;
  }
  if (characterOpen) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeCharacterModal();
      return;
    }
    if (event.key === "Tab") {
      const focusable = getFocusable(characterModalPanel);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !characterModalPanel.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !characterModalPanel.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }
    return;
  }

  if (event.key === "Escape") {
    if (modalOpen) {
      event.preventDefault();
      closeModal();
      return;
    }
    if (menuOpen) {
      event.preventDefault();
      closeMenu(true);
      return;
    }
  }

  if (modalOpen && event.key === "Tab") {
    const focusable = getFocusable(modalPanel);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !modalPanel.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !modalPanel.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }
});

/* ---------- 页面滚动：导航高亮 / 进度 / 视差 ---------- */
const navLinks = $$("[data-nav]");
const navSections = ["about", "works", "characters", "timeline"]
  .map((id) => document.getElementById(id))
  .filter(Boolean);
let scrollRaf = null;

function updateScrollUI() {
  const scrollY = window.scrollY || window.pageYOffset;
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const progress = Math.min(1, Math.max(0, scrollY / maxScroll));
  $("#scrollProgress").style.width = `${progress * 100}%`;
  siteHeader.classList.toggle("is-scrolled", scrollY > 24);

  const probe = scrollY + Math.min(window.innerHeight * 0.38, 340);
  let current = "";
  navSections.forEach((section) => {
    const top = section.getBoundingClientRect().top + scrollY;
    if (top <= probe) current = section.id;
  });
  navLinks.forEach((link) => {
    if (link.dataset.nav === current) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}

function onScroll() {
  if (scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = null;
    updateScrollUI();
  });
}
window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", onScroll, { passive: true });

const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
const hero = $("#top");
if (hero && finePointer.matches) {
  let heroRaf = null;
  hero.addEventListener("pointermove", (event) => {
    if (isReduced()) return;
    if (heroRaf) cancelAnimationFrame(heroRaf);
    heroRaf = requestAnimationFrame(() => {
      const rect = hero.getBoundingClientRect();
      const px = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      const py = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      hero.style.setProperty("--px", px.toFixed(3));
      hero.style.setProperty("--py", py.toFixed(3));
    });
  }, { passive: true });
  hero.addEventListener("pointerleave", () => {
    hero.style.setProperty("--px", "0");
    hero.style.setProperty("--py", "0");
  }, { passive: true });
}

/* ---------- 滚动淡入 ---------- */
function setupReveal() {
  const revealItems = $$("[data-reveal]");
  if (isReduced() || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -55px 0px" });
  revealItems.forEach((item) => observer.observe(item));
  reduceMotion.addEventListener?.("change", (event) => {
    if (event.matches) {
      revealItems.forEach((item) => item.classList.add("is-visible"));
      observer.disconnect();
    }
  });
}

/* ---------- 返回顶部 ---------- */
$("#toTop").addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: isReduced() ? "auto" : "smooth" });
});

/* ---------- 首屏背景轮播 ---------- */
const heroCaptions = [
  "SCENE / ヴァイオレット・エヴァーガーデン — © KYOTO ANIMATION",
  "SCENE / ヴァイオレット・エヴァーガーデン — © KYOTO ANIMATION",
  "SCENE / ヴァイオレット・エヴァーガーデン — © KYOTO ANIMATION",
  "SCENE / ヴァイオレット・エヴァーガーデン — © KYOTO ANIMATION"
];
let heroCurrent = 0;
let heroTimer = null;

function stopHeroAuto() {
  if (heroTimer) {
    clearInterval(heroTimer);
    heroTimer = null;
  }
}

function startHeroAuto() {
  stopHeroAuto();
  if (document.hidden) return;
  heroTimer = window.setInterval(() => setHeroSlide(heroCurrent + 1), 8000);
}

function setHeroSlide(index) {
  if (!heroArtSlides.length) return;
  const total = heroArtSlides.length;
  heroCurrent = ((index % total) + total) % total;
  heroArtSlides.forEach((slide, slideIndex) => {
    slide.classList.toggle("is-active", slideIndex === heroCurrent);
  });
  if (heroCaption) heroCaption.textContent = heroCaptions[heroCurrent] || "";
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopHeroAuto();
  else startHeroAuto();
});

/* ---------- 初始化 ---------- */
setHeroSlide(0);
startHeroAuto();
renderWorks();
renderCharacters();
renderTimeline();
setupReveal();
updateScrollUI();
initializeModalFromUrl();

window.addEventListener("load", () => {
  onScroll();
}, { once: true });
