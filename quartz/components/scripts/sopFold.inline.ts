const FOLDABLE = "h1, h2, h3"

const levelOf = (el: Element) => (/^H[1-6]$/.test(el.tagName) ? Number(el.tagName[1]) : 0)

// Recompute which children of a container are hidden: an element is hidden when any heading
// above it whose section it belongs to is folded (so nested folds keep their own state).
function apply(container: Element) {
  const stack: { level: number; folded: boolean }[] = []
  for (const child of Array.from(container.children)) {
    const level = levelOf(child)
    if (level) {
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop()
    }
    child.classList.toggle("sop-folded", stack.some((s) => s.folded))
    if (level) stack.push({ level, folded: (child as HTMLElement).dataset.folded === "true" })
  }
}

function setFolded(heading: HTMLElement, folded: boolean) {
  heading.dataset.folded = String(folded)
  heading.querySelector(":scope > .sop-fold")?.setAttribute("aria-expanded", String(!folded))
}

// Open every folded section that contains el (used for links into a folded section).
function reveal(el: Element | null) {
  const article = document.querySelector("article")
  while (el && article && el !== article && article.contains(el)) {
    const container = el.parentElement
    if (!container) break
    let needed = levelOf(el) || 99
    for (let s = el.previousElementSibling; s; s = s.previousElementSibling) {
      const level = levelOf(s)
      if (level && level < needed) {
        if ((s as HTMLElement).dataset.folded === "true") setFolded(s as HTMLElement, false)
        needed = level
      }
    }
    apply(container)
    el = container
  }
}

function setup() {
  const article = document.querySelector("article")
  if (!article) return
  const containers = new Set<Element>()
  for (const heading of Array.from(article.querySelectorAll<HTMLElement>(FOLDABLE))) {
    if (heading.dataset.foldReady || heading.closest("table, .sop-roller")) continue
    heading.dataset.foldReady = "true"
    heading.dataset.folded = "false"
    const button = document.createElement("button")
    button.type = "button"
    button.className = "sop-fold"
    button.setAttribute("aria-expanded", "true")
    button.setAttribute("aria-label", "Collapse or expand this section")
    const toggle = (e: Event) => {
      e.preventDefault()
      setFolded(heading, heading.dataset.folded !== "true")
      if (heading.parentElement) apply(heading.parentElement)
    }
    button.addEventListener("click", toggle)
    window.addCleanup(() => button.removeEventListener("click", toggle))
    heading.prepend(button)
    if (heading.parentElement) containers.add(heading.parentElement)
  }
  containers.forEach(apply)
}

function onHash() {
  const id = decodeURIComponent(location.hash.slice(1))
  if (id) reveal(document.getElementById(id))
}

document.addEventListener("nav", () => {
  setup()
  onHash()
})
window.addEventListener("hashchange", onHash)

export {}
