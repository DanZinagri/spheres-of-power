function panesOf(tabs: HTMLElement): HTMLElement[] {
  return Array.from(tabs.children).filter((c) => c.classList.contains("sop-tab")) as HTMLElement[]
}

function activate(tabs: HTMLElement, index: number) {
  panesOf(tabs).forEach((pane, i) => (pane.hidden = i !== index))
  tabs.querySelectorAll<HTMLButtonElement>(":scope > .sop-tab-bar > button").forEach((b, i) => {
    b.setAttribute("aria-selected", String(i === index))
    b.tabIndex = i === index ? 0 : -1
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
