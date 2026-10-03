import fs from "fs"
import { Root, Element } from "hast"
import { visit } from "unist-util-visit"
import { QuartzTransformerPlugin } from "../types"
import { FilePath, slugifyFilePath } from "../../util/path"

interface Options {
  // JSON map of content-relative note path -> family name, written by scripts/scrape.py
  file: string
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
        () => (tree: Root) => {
          const map = load()
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
