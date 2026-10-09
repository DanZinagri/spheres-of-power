// Builds the Pagefind search index for the built site (public/), like `npx pagefind`, and adds one
// search record per compendium entry and per option (quartz/static/compendium/*.json), so a search
// for a talent, option, feat or drawback finds that entry itself, linked to its heading.
//   npx quartz build && node scripts/build-search.mjs
import fs from "fs"
import path from "path"
import * as pagefind from "pagefind"

const SITE = "public"
const COMPENDIUM = "quartz/static/compendium"

// exclude_selectors from pagefind.yml (the CLI's config; the API needs them passed in)
const yml = fs.readFileSync("pagefind.yml", "utf-8")
const excludeSelectors = [...yml.matchAll(/^\s*-\s*(['"])(.*)\1\s*$/gm)].map((m) => m[2])

const KIND_TYPE = {
  "sphere ability": "Spheres",
  package: "Spheres",
  talent: "Talents",
  "advanced talent": "Talents",
  "legendary talent": "Talents",
  "cohort job": "Talents",
  "companion archetype": "Talents",
  "alternate divination": "Spheres",
  // class maps (Commander): its features and the options it picks from
  "class feature": "Class Options",
  "enhanced tactic": "Class Options",
  "battlefield specialty": "Class Options",
  "logistics specialty": "Class Options",
  equipment: "Class Options",
  feat: "Feats",
  drawback: "Drawbacks",
}

// markdown -> plain text for the search index
const plain = (md) =>
  md
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`>|]/g, " ")
    .replace(/-{3,}/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const tagText = (tags, talentTags) =>
  [...tags.map((t) => `(${t})`), ...talentTags.map((t) => `[${t}]`)].join(" ")

const { index, errors } = await pagefind.createIndex({ excludeSelectors })
if (!index) throw new Error(errors.join("\n"))
const site = await index.addDirectory({ path: SITE })
if (site.errors.length) throw new Error(site.errors.join("\n"))
console.log(`Indexed ${site.page_count} pages`)

let records = 0
for (const file of fs.existsSync(COMPENDIUM) ? fs.readdirSync(COMPENDIUM) : []) {
  if (!file.endsWith(".json") || file === "index.json") continue
  const data = JSON.parse(fs.readFileSync(path.join(COMPENDIUM, file), "utf-8"))
  // feats.json: every Spheres feat (a sphere file's own feats are skipped below, so they aren't doubled)
  if (data.category === "feats" && Array.isArray(data.entries)) {
    for (const e of data.entries) {
      const r = await index.addCustomRecord({
        url: `/${e.url}`,
        content: `${e.name}. ${e.name}. ${e.types.map((t) => `(${t})`).join(" ")} ${plain(e.md)}`.trim(),
        language: "en",
        meta: { title: `${e.name} — ${e.types.join(", ")} feat`, image: "" },
        filters: { System: [e.system], Type: ["Feats"] },
        sort: { title: e.name },
      })
      if (r.errors.length) throw new Error(r.errors.join("\n"))
      records++
    }
    continue
  }
  if (!data.sphere || !Array.isArray(data.entries)) continue // only sphere entry files (not classes.json etc.)
  for (const e of data.entries) {
    if (e.kind === "feat") continue // in feats.json
    const page = "/" + e.url.split("#")[0]
    const type = KIND_TYPE[e.kind] ?? "Talents"
    const where = `${e.sphere} ${e.kind}`
    const add = async (title, url, body, extra = "", label = where) => {
      const r = await index.addCustomRecord({
        url,
        // the name leads the content so it carries the most weight in such a short record
        content: `${title}. ${title}. ${extra} ${plain(body)}`.trim(),
        language: "en",
        meta: { title: `${title} — ${label}`, image: "" },
        filters: { System: [e.system], Type: [type] },
        sort: { title },
      })
      if (r.errors.length) throw new Error(r.errors.join("\n"))
      records++
    }
    await add(e.name, `/${e.url}`, e.md, tagText(e.tags, e.talentTags))
    for (const o of e.options ?? []) {
      await add(o.name, `${page}#${o.anchor}`, o.md, `${tagText(o.tags, o.talentTags)} option of ${e.name}`,
                `${e.name} option (${e.sphere})`)
    }
  }
}
console.log(`Added ${records} compendium records`)

const out = await index.writeFiles({ outputPath: path.join(SITE, "pagefind") })
if (out.errors.length) throw new Error(out.errors.join("\n"))
await pagefind.close()
