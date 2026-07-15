const state = { sites: [], meta: {}, query: "", region: "", system: "", feature: "", sort: "recommended" };
const $ = (selector) => document.querySelector(selector);
const normalize = (value) => String(value ?? "").normalize("NFKC").toLowerCase();

async function loadData() {
  try {
    const response = await fetch("data/sites.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state.sites = data.sites ?? [];
    state.meta = data.meta ?? {};
    initialize();
  } catch (error) {
    console.error(error);
    $("#statusMessage").textContent = "一覧データを読み込めませんでした。GitHub Pagesまたはローカルサーバー経由で開いてください。";
  }
}

function initialize() {
  populateSelect("#regionFilter", unique(state.sites.map(site => site.region)), "すべての地域");
  populateSelect("#systemFilter", unique(state.sites.map(site => site.system)), "すべての系統");
  populateSelect("#featureFilter", unique(state.sites.flatMap(site => site.features)), "すべての内容");
  $("#siteCount").textContent = state.sites.length;
  $("#regionCount").textContent = unique(state.sites.map(site => site.region)).length;
  $("#updatedAt").textContent = formatDate(state.meta.lastUpdated, false);
  bindEvents();
  render();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "ja"));
}

function populateSelect(selector, values, firstLabel) {
  const select = $(selector);
  select.innerHTML = `<option value="">${firstLabel}</option>`;
  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function bindEvents() {
  $("#searchInput").addEventListener("input", event => { state.query = event.target.value; render(); });
  $("#regionFilter").addEventListener("change", event => { state.region = event.target.value; render(); });
  $("#systemFilter").addEventListener("change", event => { state.system = event.target.value; render(); });
  $("#featureFilter").addEventListener("change", event => { state.feature = event.target.value; render(); });
  $("#sortSelect").addEventListener("change", event => { state.sort = event.target.value; render(); });
  $("#resetButton").addEventListener("click", resetFilters);
}

function resetFilters() {
  state.query = state.region = state.system = state.feature = "";
  state.sort = "recommended";
  $("#searchInput").value = "";
  $("#regionFilter").value = "";
  $("#systemFilter").value = "";
  $("#featureFilter").value = "";
  $("#sortSelect").value = "recommended";
  render();
  $("#statusMessage").textContent = "検索条件をリセットしました。";
}

function filteredSites() {
  const query = normalize(state.query).trim();
  const tokens = query.split(/\s+/).filter(Boolean);
  return state.sites.filter(site => {
    if (state.region && site.region !== state.region) return false;
    if (state.system && site.system !== state.system) return false;
    if (state.feature && !site.features.includes(state.feature)) return false;
    if (!tokens.length) return true;
    const haystack = normalize([
      site.name, site.organization, site.region, site.prefecture, site.system,
      site.category, site.summary, ...(site.features ?? []), site.caution
    ].join(" "));
    return tokens.every(token => haystack.includes(token));
  });
}

function sortedSites(sites) {
  const copy = [...sites];
  if (state.sort === "region") return copy.sort((a,b) => a.region.localeCompare(b.region,"ja") || a.priority-b.priority);
  if (state.sort === "name") return copy.sort((a,b) => a.organization.localeCompare(b.organization,"ja"));
  if (state.sort === "recent") return copy.sort((a,b) => b.verified.localeCompare(a.verified) || a.priority-b.priority);
  return copy.sort((a,b) => a.priority-b.priority);
}

function render() {
  const sites = sortedSites(filteredSites());
  const container = $("#results");
  const template = $("#cardTemplate");
  container.replaceChildren();

  sites.forEach(site => {
    const card = template.content.cloneNode(true);
    card.querySelector(".region-badge").textContent = `${site.region}｜${site.prefecture}`;
    card.querySelector(".category-label").textContent = site.category;
    card.querySelector("h3").textContent = site.name;
    card.querySelector(".organization").textContent = site.organization;
    card.querySelector(".summary").textContent = site.summary;
    const featureList = card.querySelector(".feature-list");
    site.features.forEach(feature => {
      const chip = document.createElement("span");
      chip.className = "feature-chip";
      chip.textContent = feature;
      featureList.appendChild(chip);
    });
    if (site.caution) {
      const caution = card.querySelector(".caution");
      caution.hidden = false;
      caution.textContent = site.caution;
    }
    card.querySelector(".verified").textContent = `掲載確認 ${formatDate(site.verified, true)}`;
    const link = card.querySelector(".visit-button");
    link.href = site.url;
    link.setAttribute("aria-label", `${site.organization}のサイトを新しいタブで開く`);
    const copyButton = card.querySelector(".copy-button");
    copyButton.addEventListener("click", () => copyUrl(site.url, copyButton));
    container.appendChild(card);
  });

  $("#resultCount").textContent = sites.length;
  $("#emptyState").hidden = sites.length !== 0;
  $("#statusMessage").textContent = "";
}

async function copyUrl(url, button) {
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(url);
    button.textContent = "コピーしました";
  } catch {
    const temp = document.createElement("textarea");
    temp.value = url; document.body.appendChild(temp); temp.select();
    document.execCommand("copy"); temp.remove();
    button.textContent = "コピーしました";
  }
  setTimeout(() => { button.textContent = original; }, 1600);
}

function formatDate(value, full) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return full ? `${year}年${Number(month)}月${Number(day)}日` : `${year}.${month}.${day}`;
}

document.addEventListener("DOMContentLoaded", loadData);
