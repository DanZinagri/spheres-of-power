declare global {
  interface Window {
    PagefindUI?: new (opts: Record<string, unknown>) => { triggerSearch(term: string): void }
  }
}

let loader: Promise<void> | null = null

// Ranking used by both the dropdown and the search page: long pages (whole spheres, classes) are
// penalized less than Pagefind's default (0.75), so they aren't outranked by short pages that only
// mention a term; page titles also carry extra weight (data-pagefind-weight on the title).
const RANKING = { pageLength: 0.3 }
const SEARCH_PAGE = "Search"
const PAGE_SIZE = 20
const FAMILY_CLASS: Record<string, string> = {
  "Spheres of Might": "fam-might",
  "Spheres of Guile": "fam-guile",
  Champions: "fam-champion",
}

function searchUrl(base: URL, q: string): string {
  return new URL(`${SEARCH_PAGE}?q=${encodeURIComponent(q)}`, base).href
}

function go(url: string) {
  const nav = (window as unknown as { spaNavigate?: (u: URL) => void }).spaNavigate
  if (nav) nav(new URL(url))
  else window.location.href = url
}

type PFResult = {
  url: string
  meta: { title?: string }
  excerpt: string
  sub_results?: { title: string; url: string; excerpt: string }[]
  filters?: Record<string, string[]>
}
type PF = {
  options(o: Record<string, unknown>): Promise<void>
  filters(): Promise<Record<string, Record<string, number>>>
  search(
    q: string | null,
    o?: Record<string, unknown>,
  ): Promise<{ results: { id: string; data(): Promise<PFResult> }[] } | null>
}
let pfApi: Promise<PF> | null = null

// Pagefind's search API (no UI) for the full results page.
function loadApi(base: URL): Promise<PF> {
  if (!pfApi) {
    pfApi = (async () => {
      const pf = (await import(new URL("pagefind/pagefind.js", base).href)) as PF
      await pf.options({ baseUrl: base.pathname, ranking: RANKING })
      return pf
    })()
    pfApi.catch(() => (pfApi = null))
  }
  return pfApi
}

const clean = (u: string) => u.replace(/\.html(?=$|#)/, "")

// Pagefind lists a page's matching sections in page order; put the best ones first instead: a
// section whose heading contains the search words, then the one with the most matches.
type Sub = { title: string; url: string; excerpt: string; locations?: number[] }
function rankSubs<T extends Sub>(subs: T[], q: string): T[] {
  const words = q.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? []
  const score = (s: T) => {
    const title = s.title.toLowerCase()
    const inTitle = words.filter((w) => title.includes(w)).length
    const phrase = words.length > 1 && title.includes(words.join(" ")) ? 1 : 0
    return phrase * 1000 + inTitle * 100 + (s.locations?.length ?? 0)
  }
  return subs
    .map((s, i) => ({ s, i, v: score(s) }))
    .sort((a, b) => b.v - a.v || a.i - b.i)
    .map((x) => x.s)
}
const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)

// The full results page (content/Search.md holds an empty #sop-search-page): query in the URL,
// System/Type filters, relevance or A-Z sort, numbered pages.
async function renderSearchPage(host: HTMLElement, base: URL) {
  const params = new URLSearchParams(window.location.search)
  const state = {
    q: params.get("q") ?? "",
    system: (params.get("system") ?? "").split(",").filter(Boolean),
    type: (params.get("type") ?? "").split(",").filter(Boolean),
    sort: params.get("sort") === "title" ? "title" : "relevance",
    page: Math.max(1, Number(params.get("page") ?? "1") || 1),
  }
  host.innerHTML = `
    <form class="sp-form" role="search">
      <input class="sp-input" type="search" placeholder="Search the wiki" aria-label="Search" />
      <select class="sp-sort" aria-label="Sort">
        <option value="relevance">Most relevant</option>
        <option value="title">Title A–Z</option>
      </select>
    </form>
    <div class="sp-layout">
      <aside class="sp-filters"></aside>
      <div class="sp-main"><p class="sp-status"></p><ol class="sp-results"></ol><nav class="sp-pages"></nav></div>
    </div>`
  const input = host.querySelector<HTMLInputElement>(".sp-input")!
  const sort = host.querySelector<HTMLSelectElement>(".sp-sort")!
  const filtersEl = host.querySelector<HTMLElement>(".sp-filters")!
  const status = host.querySelector<HTMLElement>(".sp-status")!
  const list = host.querySelector<HTMLOListElement>(".sp-results")!
  const pages = host.querySelector<HTMLElement>(".sp-pages")!
  input.value = state.q
  sort.value = state.sort

  let pf: PF
  try {
    pf = await loadApi(base)
  } catch {
    status.textContent = "Search index not found."
    return
  }

  // filter checkboxes, from the index's own counts
  const counts = await pf.filters()
  const groups: [string, keyof typeof state][] = [
    ["System", "system"],
    ["Type", "type"],
  ]
  filtersEl.innerHTML = groups
    .map(([name, key]) => {
      const opts = Object.entries(counts[name] ?? {}).sort((a, b) => a[0].localeCompare(b[0]))
      return `<fieldset><legend>${name}</legend>${opts
        .map(
          ([v]) =>
            `<label><input type="checkbox" data-key="${key}" value="${esc(v)}"${
              (state[key] as string[]).includes(v) ? " checked" : ""
            }/> ${esc(v)}</label>`,
        )
        .join("")}</fieldset>`
    })
    .join("")

  let run = 0
  async function update(resetPage: boolean) {
    if (resetPage) state.page = 1
    const p = new URLSearchParams()
    if (state.q) p.set("q", state.q)
    if (state.system.length) p.set("system", state.system.join(","))
    if (state.type.length) p.set("type", state.type.join(","))
    if (state.sort === "title") p.set("sort", "title")
    if (state.page > 1) p.set("page", String(state.page))
    history.replaceState(history.state, "", `${window.location.pathname}${p.size ? "?" + p : ""}`)

    const mine = ++run
    if (!state.q && !state.system.length && !state.type.length) {
      status.textContent = "Type to search, or pick a filter."
      list.replaceChildren()
      pages.replaceChildren()
      return
    }
    status.textContent = "Searching…"
    const filters: Record<string, unknown> = {}
    if (state.system.length) filters.System = { any: state.system }
    if (state.type.length) filters.Type = { any: state.type }
    const found = await pf.search(state.q || null, {
      filters,
      ...(state.sort === "title" ? { sort: { title: "asc" } } : {}),
    })
    if (mine !== run || !found) return
    const total = found.results.length
    const last = Math.max(1, Math.ceil(total / PAGE_SIZE))
    state.page = Math.min(state.page, last)
    const slice = found.results.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE)
    const data = await Promise.all(slice.map((r) => r.data()))
    if (mine !== run) return
    status.textContent = total ? `${total} result${total === 1 ? "" : "s"}` : "No results."
    list.start = (state.page - 1) * PAGE_SIZE + 1
    list.innerHTML = data
      .map((d) => {
        const sys = d.filters?.System?.[0] ?? "Spheres of Power"
        const fam = FAMILY_CLASS[sys] ?? ""
        const subs = rankSubs(d.sub_results ?? [], state.q)
          .filter((s) => clean(s.url) !== clean(d.url))
          .slice(0, 3)
          .map(
            (s) =>
              `<li><a class="internal ${fam}" href="${esc(clean(s.url))}">${esc(s.title)}</a><p>${s.excerpt}</p></li>`,
          )
          .join("")
        return `<li class="sp-result">
          <a class="sp-title internal ${fam}" href="${esc(clean(d.url))}">${esc(d.meta.title ?? clean(d.url))}</a>
          <span class="sp-tags">${esc(sys)}${d.filters?.Type?.[0] ? " · " + esc(d.filters.Type[0]) : ""}</span>
          <p class="sp-excerpt">${d.excerpt}</p>
          ${subs ? `<ul class="sp-subs">${subs}</ul>` : ""}
        </li>`
      })
      .join("")
    // numbered pages: first, last, and two either side of the current one
    const nums: (number | "…")[] = []
    for (let n = 1; n <= last; n++) {
      if (n === 1 || n === last || Math.abs(n - state.page) <= 2) nums.push(n)
      else if (nums[nums.length - 1] !== "…") nums.push("…")
    }
    pages.innerHTML =
      last > 1
        ? nums
            .map((n) =>
              n === "…"
                ? `<span>…</span>`
                : `<button type="button" data-page="${n}"${n === state.page ? ' aria-current="page"' : ""}>${n}</button>`,
            )
            .join("")
        : ""
  }

  let timer: number | undefined
  const onInput = () => {
    state.q = input.value.trim()
    window.clearTimeout(timer)
    timer = window.setTimeout(() => update(true), 200)
  }
  const onSubmit = (e: Event) => {
    e.preventDefault()
    state.q = input.value.trim()
    update(true)
  }
  const onSort = () => {
    state.sort = sort.value
    update(true)
  }
  const onFilter = (e: Event) => {
    const box = e.target as HTMLInputElement
    if (!box.dataset.key) return
    const key = box.dataset.key as "system" | "type"
    state[key] = box.checked ? [...state[key], box.value] : state[key].filter((v) => v !== box.value)
    update(true)
  }
  const onPage = (e: Event) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-page]")
    if (!b) return
    state.page = Number(b.dataset.page)
    update(false)
    host.scrollIntoView({ behavior: "smooth" })
  }
  input.addEventListener("input", onInput)
  host.querySelector("form")!.addEventListener("submit", onSubmit)
  sort.addEventListener("change", onSort)
  filtersEl.addEventListener("change", onFilter)
  pages.addEventListener("click", onPage)
  window.addCleanup(() => {
    input.removeEventListener("input", onInput)
    sort.removeEventListener("change", onSort)
    filtersEl.removeEventListener("change", onFilter)
    pages.removeEventListener("click", onPage)
  })
  if (!state.q) input.focus()
  update(false)
}

// Relative path from the current page to the site root, e.g. "../" for "Folder/Page".
function rootPath(): string {
  const slug = document.body.dataset.slug ?? ""
  const depth = slug.split("/").length - 1
  return depth > 0 ? "../".repeat(depth) : "./"
}

// Pagefind's UI bundle is only downloaded the first time someone opens search.
function loadPagefind(base: URL): Promise<void> {
  if (loader) return loader
  loader = new Promise((resolve, reject) => {
    const css = document.createElement("link")
    css.rel = "stylesheet"
    css.href = new URL("pagefind/pagefind-ui.css", base).href
    document.head.appendChild(css)

    const js = document.createElement("script")
    js.src = new URL("pagefind/pagefind-ui.js", base).href
    js.onload = () => resolve()
    js.onerror = () => {
      loader = null
      reject(new Error("Could not load search index"))
    }
    document.head.appendChild(js)
  })
  return loader
}

document.addEventListener("nav", () => {
  const root = document.querySelector<HTMLElement>(".pf-search")
  if (!root) return
  const button = root.querySelector<HTMLButtonElement>(".pf-search-button")!
  const container = root.querySelector<HTMLElement>(".pf-search-container")!
  const mount = root.querySelector<HTMLElement>(".pf-search-ui")!
  const allLink = root.querySelector<HTMLAnchorElement>(".pf-search-all")!
  const base = new URL(rootPath(), window.location.href)
  let mounted = false

  const page = document.getElementById("sop-search-page")
  if (page) renderSearchPage(page, base)

  // "See all results" (and Enter in the dropdown) open the full search page for the typed text
  const typedText = () => mount.querySelector<HTMLInputElement>("input")?.value.trim() ?? ""
  const onTyping = () => {
    const q = typedText()
    allLink.href = searchUrl(base, q)
    allLink.hidden = !q
  }
  const onEnter = (e: KeyboardEvent) => {
    if (e.key !== "Enter" || !(e.target as HTMLElement).matches("input")) return
    const q = typedText()
    if (!q) return
    e.preventDefault()
    close()
    go(searchUrl(base, q))
  }
  const onAll = (e: MouseEvent) => {
    e.preventDefault()
    close()
    go(allLink.href)
  }
  mount.addEventListener("input", onTyping)
  mount.addEventListener("keydown", onEnter)
  allLink.addEventListener("click", onAll)
  window.addCleanup(() => {
    mount.removeEventListener("input", onTyping)
    mount.removeEventListener("keydown", onEnter)
    allLink.removeEventListener("click", onAll)
  })

  async function open() {
    container.classList.add("active")
    document.body.style.overflow = "hidden"
    if (!mounted) {
      mounted = true
      // Stand-in input so anything typed while Pagefind downloads isn't lost
      const early = document.createElement("input")
      early.className = "pf-search-early"
      early.placeholder = "Loading search…"
      mount.replaceChildren(early)
      early.focus()
      try {
        await loadPagefind(base)
        const typed = early.value
        mount.replaceChildren()
        const ui = new window.PagefindUI!({
          element: mount,
          baseUrl: base.pathname,
          showSubResults: true,
          showImages: false,
          resetStyles: false,
          pageSize: 8,
          excerptLength: 30,
          ranking: RANKING,
          // Quartz serves pages without the .html extension
          processResult: (r: { url: string; sub_results?: Sub[] }) => {
            r.url = r.url.replace(/\.html(?=$|#)/, "")
            r.sub_results?.forEach((s) => (s.url = s.url.replace(/\.html(?=$|#)/, "")))
            // the dropdown re-sorts sections itself, so only give it the three best ones
            if (r.sub_results) r.sub_results = rankSubs(r.sub_results, typedText()).slice(0, 3)
            return r
          },
        })
        if (typed) {
          ui.triggerSearch(typed)
          onTyping()
        }
      } catch {
        mounted = false
        mount.textContent = "Search index not found. Run `npx pagefind --site public` after building."
      }
    }
    mount.querySelector<HTMLInputElement>("input")?.focus()
  }

  function close() {
    container.classList.remove("active")
    document.body.style.overflow = ""
  }

  const onKey = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault()
      container.classList.contains("active") ? close() : open()
    } else if (e.key === "Escape" && container.classList.contains("active")) {
      close()
    }
  }
  const onBackdrop = (e: MouseEvent) => {
    if (e.target === container) close()
  }
  // clicking a result navigates (possibly via SPA routing), so hide the overlay
  const onResult = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest("a")) close()
  }

  button.addEventListener("click", open)
  container.addEventListener("click", onBackdrop)
  mount.addEventListener("click", onResult)
  document.addEventListener("keydown", onKey)
  window.addCleanup(() => {
    button.removeEventListener("click", open)
    container.removeEventListener("click", onBackdrop)
    mount.removeEventListener("click", onResult)
    document.removeEventListener("keydown", onKey)
    document.body.style.overflow = ""
  })
})

export {}
