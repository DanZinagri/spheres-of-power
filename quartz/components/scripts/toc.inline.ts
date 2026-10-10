const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    const slug = entry.target.id
    const tocEntryElements = document.querySelectorAll(`a[data-for="${slug}"]`)
    const windowHeight = entry.rootBounds?.height
    if (windowHeight && tocEntryElements.length > 0) {
      if (entry.boundingClientRect.y < windowHeight) {
        tocEntryElements.forEach((tocEntryElement) => tocEntryElement.classList.add("in-view"))
      } else {
        tocEntryElements.forEach((tocEntryElement) => tocEntryElement.classList.remove("in-view"))
      }
    }
  }
})

function toggleToc(this: HTMLElement) {
  this.classList.toggle("collapsed")
  this.setAttribute(
    "aria-expanded",
    this.getAttribute("aria-expanded") === "true" ? "false" : "true",
  )
  const content = this.nextElementSibling as HTMLElement | undefined
  if (!content) return
  content.classList.toggle("collapsed")
}

function setupToc() {
  for (const toc of document.getElementsByClassName("toc")) {
    const button = toc.querySelector(".toc-header")
    const content = toc.querySelector(".toc-content")
    if (!button || !content) return
    button.addEventListener("click", toggleToc)
    window.addCleanup(() => button.removeEventListener("click", toggleToc))
  }
}

// Sub-entries for a section's labelled blocks that aren't headings: the bold header line of each
// .sop-spheres list (Magic Spheres, Feat Types, Magical Items, ...) and each tab of a tab set
// (the home Classes tabs). Each gets an id to link to, listed one level under its section.
const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

function sectionHeading(el: Element): HTMLElement | null {
  // the nearest heading before el (or before the block holding it) at the article's top level
  for (let node: Element | null = el; node && node.tagName !== "ARTICLE"; node = node.parentElement) {
    for (let s = node.previousElementSibling; s; s = s.previousElementSibling) {
      if (/^H[1-6]$/.test(s.tagName) && s.id) return s as HTMLElement
    }
  }
  return null
}

function addSubEntries() {
  const article = document.querySelector("article")
  if (!article) return
  const subs: { heading: HTMLElement; id: string; text: string; open?: () => void }[] = []
  const claim = (el: HTMLElement, text: string, prefix = "", open?: () => void) => {
    const heading = sectionHeading(el)
    if (!heading || !text) return
    if (!el.id) {
      let id = slugify(prefix + text)
      if (document.getElementById(id)) id = `${slugify(heading.id)}-${id}`
      el.id = id
    }
    subs.push({ heading, id: el.id, text, open })
  }
  for (const p of Array.from(article.querySelectorAll<HTMLElement>(".sop-spheres > p"))) {
    const strong = p.querySelector(":scope > strong")
    if (strong) claim(p, strong.textContent?.trim() ?? "")
  }
  for (const pane of Array.from(article.querySelectorAll<HTMLElement>(".sop-tabs > .sop-tab"))) {
    const label = pane.querySelector(":scope > .sop-tab-label")?.textContent?.trim() ?? ""
    // the page's router handles the link without a hashchange, so the entry opens the tab itself
    claim(pane, label, "tab-", () => {
      const tabs = pane.parentElement
      const index = Array.from(tabs?.querySelectorAll(":scope > .sop-tab") ?? []).indexOf(pane)
      const bar = tabs?.querySelector(":scope > .sop-tab-bar")
      ;(bar?.querySelectorAll("button")[index] as HTMLButtonElement | undefined)?.click()
      pane.parentElement?.scrollIntoView()
    })
  }
  for (const toc of Array.from(document.getElementsByClassName("toc"))) {
    const after = new Map<string, Element>()
    for (const sub of subs) {
      const parent = toc.querySelector(`a[data-for="${CSS.escape(sub.heading.id)}"]`)?.closest("li")
      if (!parent || toc.querySelector(`a[data-for="${CSS.escape(sub.id)}"]`)) continue
      const depth = Number(/depth-(\d+)/.exec(parent.className)?.[1] ?? 0) + 1
      const li = document.createElement("li")
      li.className = `depth-${depth} toc-sub`
      const a = document.createElement("a")
      a.href = `#${sub.id}`
      a.dataset.for = sub.id
      a.textContent = sub.text
      if (sub.open) {
        const open = sub.open
        a.addEventListener("click", (e) => {
          e.preventDefault()
          history.replaceState(null, "", a.href)
          open()
        })
      }
      li.appendChild(a)
      const prev = after.get(sub.heading.id) ?? parent
      prev.after(li)
      after.set(sub.heading.id, li)
    }
  }
}

document.addEventListener("nav", () => {
  setupToc()
  addSubEntries()

  // update toc entry highlighting
  observer.disconnect()
  const headers = document.querySelectorAll(
    "h1[id], h2[id], h3[id], h4[id], h5[id], h6[id], .sop-spheres > p[id], .sop-tabs > .sop-tab[id]",
  )
  headers.forEach((header) => observer.observe(header))
})
