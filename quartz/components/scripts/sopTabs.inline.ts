function panesOf(tabs: HTMLElement): HTMLElement[] {
  return Array.from(tabs.children).filter((c) => c.classList.contains("sop-tab")) as HTMLElement[]
}

function activate(tabs: HTMLElement, index: number) {
  panesOf(tabs).forEach((pane, i) => (pane.hidden = i !== index))
  tabs.querySelectorAll<HTMLButtonElement>(":scope > .sop-tab-bar > button").forEach((b, i) => {
    b.setAttribute("aria-selected", String(i === index))
    b.tabIndex = i === index ? 0 : -1
  })
  syncToc()
}

// Table of contents: only list headings from the tabs currently showing.
function syncToc() {
  document.querySelectorAll<HTMLAnchorElement>(".toc a[data-for]").forEach((a) => {
    const heading = document.getElementById(a.dataset.for ?? "")
    const pane = heading?.closest<HTMLElement>(".sop-tab")
    const li = a.closest("li")
    if (li) li.hidden = !!pane?.hidden
  })
}

// A link to a heading inside a hidden tab (search result, table of contents) opens that tab.
function revealHash() {
  const id = decodeURIComponent(window.location.hash.slice(1))
  if (!id) return
  const target = document.getElementById(id)
  const pane = target?.closest<HTMLElement>(".sop-tab")
  const tabs = pane?.closest<HTMLElement>(".sop-tabs")
  if (!target || !pane || !tabs || !pane.hidden) return
  activate(tabs, panesOf(tabs).indexOf(pane))
  target.scrollIntoView()
}

function setup() {
  for (const tabs of Array.from(document.querySelectorAll<HTMLElement>(".sop-tabs"))) {
    if (tabs.dataset.ready) continue
    const panes = panesOf(tabs)
    if (panes.length === 0) continue
    const bar = document.createElement("div")
    bar.className = "sop-tab-bar"
    bar.setAttribute("role", "tablist")
    panes.forEach((pane, i) => {
      const label = pane.querySelector(":scope > .sop-tab-label")?.textContent?.trim()
      const button = document.createElement("button")
      button.type = "button"
      button.setAttribute("role", "tab")
      button.textContent = label || `Tab ${i + 1}`
      if (pane.dataset.tab) button.dataset.tab = pane.dataset.tab
      button.addEventListener("click", () => activate(tabs, i))
      bar.appendChild(button)
    })
    tabs.prepend(bar)
    tabs.dataset.ready = "true"
    activate(tabs, 0)
  }
  revealHash()
}

document.addEventListener("nav", setup)
window.addEventListener("hashchange", revealHash)
