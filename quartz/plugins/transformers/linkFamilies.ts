import fs from "fs"
import { Root, Element } from "hast"
import { visit } from "unist-util-visit"
import { QuartzTransformerPlugin } from "../types"
import { FilePath, slugifyFilePath } from "../../util/path"

interface Options {
  // JSON map of content-relative note path -> family name, written by scripts/scrape.py
  file: string
}

const SYSTEMS: Record<string, string> = {
  might: "Spheres of Might",
  guile: "Spheres of Guile",
  "guile-alt": "Spheres of Guile",
  champion: "Champions",
}

// A coarse page type for the search page's filters, from the page's path.
function pageType(slug: string): string | undefined {
  const name = slug.split("/").pop() ?? ""
  if (slug.startsWith("Mythic-Rules/") || /^Mythic-/.test(name)) return "Mythic"
  if (/-Feats$|^Feats/.test(name)) return "Feats"
  if (/Drawbacks$/.test(name)) return "Drawbacks"
  if (/Archetype/.test(name)) return "Archetypes"
  if (/Bestiary|Creature/.test(slug)) return "Creatures"
  if (/Talents$/.test(name)) return "Talents"
  return undefined
}

// Adds a `fam-<family>` class to internal links based on the page they point to, so links can be
// colored by product line (Power / Guile / Might / Champions) like the original wiki. Must run
// after CrawlLinks, which sets `data-slug` on internal links.
export const LinkFamilies: QuartzTransformerPlugin<Partial<Options>> = (userOpts) => {
  const file = userOpts?.file ?? "data/link-families.json"
  let families: Map<string, string> | undefined

  const load = () => {
    if (!families) {
      families = new Map()
      if (fs.existsSync(file)) {
        const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, string>
        for (const [path, fam] of Object.entries(raw)) {
          families.set(slugifyFilePath(path as FilePath), fam)
        }
      }
    }
    return families
  }

  return {
    name: "LinkFamilies",
    htmlPlugins() {
      return [
        () => (tree: Root, file) => {
          const map = load()
          // Search metadata for this page (Pagefind): its system (from its own family), a rough
          // type, and its title as a sort key. Hidden; read by the search page's filters/sort.
          const slug = String(file.data.slug ?? "")
          const meta: [string, string][] = [["filter", `System:${SYSTEMS[map.get(slug) ?? ""] ?? "Spheres of Power"}`]]
          // `searchtype` frontmatter (set by scrape.py, e.g. on every archetype in the home Classes
          // tables) wins over the name-based guess
          const type = (file.data.frontmatter?.searchtype as string | undefined) ?? pageType(slug)
          if (type) meta.push(["filter", `Type:${type}`])
          const title = file.data.frontmatter?.title
          if (title) meta.push(["sort", `title:${title}`])
          tree.children.unshift(
            ...meta.map(([kind, value]): Element => ({
              type: "element",
              tagName: "span",
              properties: { hidden: true, [`data-pagefind-${kind}`]: value },
              children: [],
            })),
          )
          visit(tree, "element", (node: Element) => {
            if (node.tagName !== "a") return
            const slug = node.properties?.["data-slug"]
            const fam = typeof slug === "string" ? map.get(slug) : undefined
            if (!fam) return
            const cls = node.properties.className
            const list = Array.isArray(cls) ? cls : cls ? [String(cls)] : []
            node.properties.className = [...list, `fam-${fam}`]
          })
        },
      ]
    },
  }
}
