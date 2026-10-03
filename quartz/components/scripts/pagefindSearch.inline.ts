declare global {
  interface Window {
    PagefindUI?: new (opts: Record<string, unknown>) => unknown
  }
}

let loader: Promise<void> | null = null

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
  const base = new URL(rootPath(), window.location.href)
  let mounted = false

  async function open() {
    container.classList.add("active")
    document.body.style.overflow = "hidden"
    if (!mounted) {
      mounted = true
      mount.textContent = "Loading search…"
      try {
        await loadPagefind(base)
        mount.textContent = ""
        new window.PagefindUI!({
          element: mount,
          baseUrl: base.pathname,
          showSubResults: true,
          showImages: false,
          resetStyles: false,
          pageSize: 8,
          excerptLength: 30,
          // Quartz serves pages without the .html extension
          processResult: (r: { url: string; sub_results?: { url: string }[] }) => {
            r.url = r.url.replace(/\.html(?=$|#)/, "")
            r.sub_results?.forEach((s) => (s.url = s.url.replace(/\.html(?=$|#)/, "")))
            return r
          },
        })
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
