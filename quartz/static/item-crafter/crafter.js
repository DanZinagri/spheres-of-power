// Spheres of Power magic item crafter: prices an item from the Ultimate Spheres of Power crafting
// rules (Magical Items page) and works out crafting cost, time, the item creation check and
// construction requirements. Talents and effects are typed in (with suggestions and rules links from
// the site's compendium for the spheres it covers); only the rule framework is built in.
"use strict"

const STORAGE_KEY = "sop-item-crafter"
const RULES_URL = "../../Spheres-Of-Power/Magical-Items"

const SPHERES = ["Alteration", "Bear", "Blood", "Conjuration", "Creation", "Dark", "Death", "Destruction", "Divination", "Enhancement", "Fallen Fey", "Fate", "Illusion", "Life", "Light", "Mana", "Mind", "Nature", "Protection", "Telekinesis", "Time", "War", "Warp", "Weather"]
const RANGES = ["Personal", "Touch", "Close", "Medium", "Long"]
const DURATIONS = { r: "1 round/level", m: "1 minute/level", "10m": "10 minutes/level", h: "1 hour/level", inst: "Instantaneous", conc: "Concentration", var: "Variable", charm: "As charm", "1rd": "1 round" }
const DUR_STEPS = ["r", "m", "10m", "h"]
const ACTIVATIONS = { full: ["1 full-round action", -1], standard: ["1 standard action", 0], move: ["1 move action", 3], swift: ["1 swift action", 5] }

// Item Base Powers: [name, base range index, base duration], plus the sphere's own complexity options
const POWERS = {
  Alteration: { powers: [["Shapeshift", 0, "r"]], mods: [["Additional trait", 1], ["Multiple forms (user chooses)", 1], ["Mass Alteration", 2]] },
  Bear: { powers: [["Bear spirit", 0, "m"]], mods: [["Bearacteristic (once per spirit)", 1], ["Unlimited bearacteristic", 3]] },
  Blood: { powers: [["Blood control", 1, "r"], ["Extract blood construct", 1, "r"]], mods: [["Change (quicken)/(still) effect", 1]] },
  Conjuration: { powers: [["Summon companion", 0, "r"]], mods: [["(form) talent", 1], ["Duration step (Lingering Companion / Greater Summoning)", 1]] },
  Creation: { powers: [["Alter (repair or destroy)", 1, "inst"], ["Create object", 0, "r"]], mods: [["Change alter effect", 1]] },
  Dark: { powers: [["Darkness", 0, "r"]], mods: [["Shadow talent effect", 1]] },
  Death: { powers: [["Ghost strike", 1, "var"], ["Reanimate", 1, "r"]], mods: [["Empowered ghost strike", 1], ["Change ghost strike", 1], ["Reanimate multiple targets", 2], ["+1 HD reanimated", 1]] },
  Destruction: { powers: [["Destructive blast", 1, "inst"]], mods: [["1 damage die per caster level", 1]] },
  Divination: { powers: [["Divine", 2, "conc"], ["Sense", 0, "m"]], mods: [["Change divine subject", 1]] },
  Enhancement: { powers: [["Enhancement", 1, "r"]], mods: [["Change enhancement", 1]] },
  "Fallen Fey": { powers: [["Fey-link", 0, "m"]], mods: [["Improved fey-blessing / extra terrain", 1], ["Talent costing a spell point", 2]] },
  Fate: { powers: [["Serendipity consecration", 0, "r"]], mods: [["Word instead of consecration", 1], ["Motif", 1]] },
  Illusion: { powers: [["Silent visual figment", 1, "r"]], mods: [["Glamer", 1], ["Suppression glamer", 2]] },
  // the rules say "cure or restore"; which one is set when the item is made (being usable as either
  // is Versatile Restoration, +1), so they are separate base powers here
  Life: { powers: [["Cure", 1, "inst"], ["Restore", 1, "inst"], ["Temporary hit points (1 per caster level)", 1, "m"]],
    mods: [["Usable as a cure or a restore, or another restore variant (per extra option)", 1], ["All options in one use", 2], ["Add temporary hit points to a cure or restore", 1]] },
  Light: { powers: [["Glow", 0, "m"]], mods: [["Lesser light (normal light only)", -1], ["Lens instead of light", 1], ["(nimbus) talent", 1]] },
  Mana: { powers: [["Expunge (Spellburn)", 2, "inst"], ["Manipulate", 2, "1rd"]], mods: [["Alternate expunge / manipulation", 1], ["Enhanced expunge / manipulation", 2], ["Manabond", 2]] },
  Mind: { powers: [["Suggestion charm", 1, "charm"]], mods: [["Alternate charm", 1], ["Open Mind (any creature type)", 1], ["Mass charm", 2], ["Greater charm", 1], ["Powerful charm", 3], ["Cloud", 2]] },
  Nature: { powers: [["Geomancing", 0, "r"]], mods: [["Greater geomancing", 1], ["Nature spirit", 1]] },
  Protection: { powers: [["Aegis", 0, "m"], ["Ward", 0, "r"]], mods: [["Change aegis or ward", 1], ["Keep the aegis alongside a (succor)", 1]] },
  Telekinesis: { powers: [["Sustained force", 0, "r"]], mods: [] },
  Time: { powers: [["Haste or slow", 0, "r"]], mods: [["Change alter time effect", 1]] },
  War: { powers: [["Totem", 0, "r"]], mods: [["Rally instead of totem", 2], ["Greater Rally", 2], ["Momentum", 1], ["Change totem", 1]] },
  Warp: { powers: [["Teleport (close)", 0, "inst"]], mods: [["Teleport distance +1 step", 2], ["Bend space", 1]] },
  Weather: { powers: [["Weather change", 0, "r"]], mods: [["Area +1 step", 2]] },
}

const ROW_KINDS = {
  talent: { label: "Talent", base: 1, sp: "SP", access: true, bypass: true },
  advanced: { label: "Advanced talent", base: 2, sp: "SP", access: true, bypass: false },
  feat: { label: "Feat", base: 1, access: true, bypass: false },
  metamagic: { label: "Metamagic feat", base: 1, sp: "SP", access: true, bypass: false },
  unique: { label: "Unique change", base: 1 },
  limitation: { label: "Limitation", base: -1 },
  simultaneous: { label: "Simultaneous trigger", base: 3 },
  mythicMastery: { label: "Mythic Infusion", base: 1, sp: "MP/day", access: true, bypass: false },
  mythicPath: { label: "Mythic Path Infusion", base: 2, sp: "MP/day", access: true, bypass: false },
  custom: { label: "Other", custom: true },
}

const KINDS = {
  marvelous: { label: "Marvelous item", feat: "Craft Marvelous Item", base: 400, talentBased: true, uses: "cl" },
  apparatus: { label: "Apparatus", feat: "Craft Apparatus", base: 2000, talentBased: true, uses: "cl" },
  compound: { label: "Compound", feat: "Distill Compound", base: 50, talentBased: true, uses: "cl", strict: true, consumable: true },
  scroll: { label: "Scroll", feat: "Capture Spell", base: 25, talentBased: true, uses: "cl", strict: true, consumable: true },
  engine: { label: "Spell engine", feat: "Craft Spell Engine", uses: "cl", strict: true },
  implement: { label: "Implement", feat: "Craft Implement Of Power", uses: "msb" },
  charm: { label: "Charm", feat: "Forge Charm", uses: "msb" },
  arms: { label: "Weapon / armor", feat: "Smith Magical Weapons And Armor", uses: "msb" },
  custom: { label: "Custom priced", feat: "", uses: "cl" },
}

const MARVELOUS_USES = { 1: ["1/day", 1], 2: ["2/day", 2], 3: ["3/day", 3], 4: ["4/day", 4], unlimited: ["Unlimited (5+/day)", 5], limited50: ["At will, 50 uses total", 2.5] }
const COMPOUND_FORMS = { potion: "Potion", oil: "Oil", powder: "Powder", other: "Other form" }

// Table: Charm Bonuses
const CHARMS = {
  ability: { label: "Enhancement bonus to an ability score", sphere: "Enhancement", min: 1, max: 6, price: (b) => b * b * 1000, cl: (b) => 2 * b, unit: "+" },
  deflection: { label: "AC bonus (deflection)", sphere: "Protection", min: 1, max: 5, price: (b) => b * b * 2000, cl: (b) => 3 * b, unit: "+" },
  natural: { label: "AC bonus (natural armor)", sphere: "Alteration", min: 1, max: 5, price: (b) => b * b * 2000, cl: (b) => 3 * b, unit: "+" },
  acOther: { label: "AC bonus (other type)", sphere: null, min: 1, max: 3, price: (b) => b * b * 2500, cl: (b) => 3 * b, unit: "+" },
  energy: { label: "Energy resistance", sphere: "Protection", min: 5, max: 30, price: (b) => 1600 * b - 4000, cl: (b) => Math.ceil(b / 2), unit: "resist " },
  resistance: { label: "Save bonus (resistance)", sphere: "Protection", min: 1, max: 5, price: (b) => b * b * 1000, cl: (b) => 3 * b, unit: "+" },
  saveOther: { label: "Save bonus (other type)", sphere: null, min: 1, max: 3, price: (b) => b * b * 2000, cl: (b) => 3 * b, unit: "+" },
  skill: { label: "Skill bonus (competence)", sphere: "Mind", min: 1, max: 20, price: (b) => b * b * 100, cl: (b) => b, unit: "+" },
  sr: { label: "Spell resistance", sphere: "Protection", min: 13, max: 99, price: (b) => 10000 * (b - 12), cl: (b) => Math.ceil(b / 2), unit: "SR " },
  maneuver: { label: "CMB/CMD (competence, one maneuver)", sphere: "Enhancement", min: 1, max: 5, price: (b) => b * b * 1000, cl: (b) => 3 * b, unit: "+" },
}
const OTHER_BONUS_SPHERES = { Mind: "Morale (Mind)", Divination: "Insight (Divination)", Fate: "Luck / profane / sacred (Fate)" }

const SLOTS = {
  none: ["None (held)", ""], slotless: ["Slotless", "Various effects"], armor: ["Armor", "Protection (armor)"], belt: ["Belt", "Physical improvement"],
  body: ["Body", "Protection (multiple), class ability improvement"], chest: ["Chest", "Utility"], eyes: ["Eyes", "Vision"], feet: ["Feet", "Movement"],
  hands: ["Hands", "Gauntlets: destructive power · Gloves: quickness"], head: ["Head", "Interaction"], headband: ["Headband", "Mental improvement, ranged attacks, morale"],
  neck: ["Neck", "Protection (natural), discernment"], ring: ["Ring", "Protection (deflection/energy), utility"], shield: ["Shield", "Protection (shield)"],
  shoulders: ["Shoulders", "Transformation, protection (resistance)"], weapon: ["Weapon", "Offense"], wrists: ["Wrists", "Bracelets: allies · Bracers: combat"],
}
const WORK = { normal: ["Quiet workshop (8 h/day)", 8], distracted: ["Distracting place (half benefit)", 4], adventuring: ["While adventuring (2 h/day)", 2] }

// ---------- the site's compendium ----------
// compendium/index.json (every mapped sphere's talents, abilities and drawbacks) and
// feats-index.json (Spheres feats): name boxes suggest the base sphere's talents and feats, and a
// recognized name links to its rules. Spheres not mapped yet stay free text.
const COMPENDIUM = { entries: [], feats: [], loaded: false }
async function loadCompendium() {
  const get = (url, empty) => fetch(url).then((r) => (r.ok ? r.json() : empty)).catch(() => empty)
  const [index, feats] = await Promise.all([get("../compendium/index.json", []), get("../compendium/feats-index.json", [])])
  COMPENDIUM.entries = index
  COMPENDIUM.feats = feats.filter((f) => f.system !== "Pathfinder 1e")
  COMPENDIUM.loaded = true
  renderAll()
}
const ROW_KIND_SOURCES = { talent: "talent", advanced: "advanced talent" }
// the compendium entries a row of this kind can name, for this base sphere
function rowSources(kind, sphere) {
  if (ROW_KIND_SOURCES[kind]) return COMPENDIUM.entries.filter((e) => e.sphere === sphere && e.kind === ROW_KIND_SOURCES[kind])
  if (kind === "feat") return COMPENDIUM.feats.filter((f) => f.spheres.includes(sphere))
  if (kind === "metamagic") return COMPENDIUM.feats.filter((f) => f.types.includes("Metamagic"))
  return []
}
const norm = (s) => String(s ?? "").trim().toLowerCase().replace(/[’']/g, "'")
// the compendium entry a row's name matches: its own kind first, then (talents) the other talent kind
function rowMatch(r, sphere) {
  const n = norm(r.name)
  if (!n) return null
  const kinds = r.kind === "talent" ? ["talent", "advanced"] : r.kind === "advanced" ? ["advanced", "talent"] : [r.kind]
  for (const k of kinds) {
    const hit = rowSources(k, sphere).find((e) => norm(e.name) === n)
    if (hit) return { entry: hit, kind: k }
  }
  return null
}
const talentSources = (sphere) => COMPENDIUM.entries.filter((e) => e.sphere === sphere && /talent$/.test(e.kind))
const entryUrl = (e) => `../../${e.url}`
const datalist = (id, list) => `<datalist id="${id}">${list.map((e) => `<option value="${esc(e.name)}"></option>`).join("")}</datalist>`
const cmpLink = (e) => (e ? `<a class="cmp-link" href="${esc(entryUrl(e))}" target="_blank" rel="noopener" title="${esc(e.summary || e.name)}">rules ↗</a>` : "")

// full rules text: a sphere's file (dark.json, ...) or feats.json, fetched the first time an
// effect needs it; the effect rerenders when it arrives
const FULL = { files: {}, byId: {} }
function fullText(e) {
  const file = e.file
  if (!file) return null
  if (!FULL.files[file]) {
    FULL.files[file] = fetch(`../compendium/${file}`).then((r) => (r.ok ? r.json() : { entries: [] })).catch(() => ({ entries: [] }))
      .then((d) => {
        for (const x of d.entries) FULL.byId[x.id] = x
        renderAll()
      })
    return null
  }
  return FULL.byId[e.id] ?? null
}
// compendium markdown -> a little HTML: paragraphs, lists, bold / italics, links reduced to text
function mdHtml(md) {
  const inline = (s) => esc(s)
    .replace(/\[\[(?:[^\]|]*\\?\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*\*([^*]+)\*\*\*/g, "<b><i>$1</i></b>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<i>$2</i>")
    .replace(/\\\|/g, "|")
  return String(md ?? "").trim().split(/\n\s*\n/).map((block) => {
    const lines = block.split("\n")
    if (lines.every((l) => /^\s*[-*] /.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*] /, ""))}</li>`).join("")}</ul>`
    if (/^#{1,6} /.test(lines[0])) return `<p><b>${inline(lines[0].replace(/^#+ /, ""))}</b>${lines.length > 1 ? "<br>" + lines.slice(1).map(inline).join("<br>") : ""}</p>`
    if (/^---+$/.test(block.trim())) return ""
    return `<p>${lines.map(inline).join("<br>")}</p>`
  }).join("")
}
// which rules-text boxes are open (kept across rerenders while the page is open)
const OPEN = new Set()
document.addEventListener("toggle", (e) => {
  const key = e.target.dataset?.open
  if (key) e.target.open ? OPEN.add(key) : OPEN.delete(key)
}, true)
// a collapsible box with an entry's rules text (or a loading line until its file arrives)
function rulesBox(key, title, e) {
  const full = fullText(e)
  const body = full ? mdHtml(full.md) + (full.options?.length ? full.options.map((o) => `<p><b>${esc(o.name)}</b></p>${mdHtml(o.md)}`).join("") : "")
    : `<p class="muted">Loading the rules text…</p>`
  return `<details class="cmp-text" data-open="${esc(key)}" ${OPEN.has(key) ? "open" : ""}><summary>${title}</summary>${body}</details>`
}

// ---------- state ----------

const uid = () => Math.random().toString(36).slice(2, 10)

function blankComp(kind) {
  const c = { id: uid(), kind, label: "", combine: "separate", hasSphere: true, sphere: "Destruction" }
  if (KINDS[kind].talentBased) {
    Object.assign(c, { power: 0, baseRange: 1, baseDur: "inst", range: 1, dur: "inst", activation: "standard", permanent: false, continual: false, rows: [] })
    if (kind === "marvelous") c.uses = "1"
    if (kind === "compound") c.form = "potion"
  }
  if (kind === "engine") Object.assign(c, { focused: false, talents: [], extraSp: 0 })
  if (kind === "implement") Object.assign(c, { enh: 1, extraSpheres: [], talents: [], abilities: [] })
  if (kind === "charm") Object.assign(c, { charm: "resistance", bonus: 1, sphere: "Protection" })
  if (kind === "arms") Object.assign(c, { arms: "weapon", enh: 1, abilities: [] })
  if (kind === "custom") Object.assign(c, { price: 0, feat: "", minCl: 1, basis: "cl" })
  return c
}

function blankItem() {
  return { id: uid(), type: "marvelous", name: "", slot: "slotless", weight: "", cl: 5, description: "", noSpace: false, mythicMastery: false, baseObject: "", baseCost: 0, extraCost: 0, components: [blankComp("marvelous")] }
}

function blankCrafter() {
  return { cl: 5, msb: 5, spellcraft: 10, versatile: false, mythic: false, expensive: false, cheap: false, simple: false, work: "normal", owner: false }
}

let state = load()

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const s = JSON.parse(raw)
      for (const it of s.items ?? []) it.type ??= it.components?.[0]?.kind ?? "marvelous"
      if (s.items?.length) return { items: s.items, activeId: s.activeId ?? s.items[0].id, crafter: { ...blankCrafter(), ...s.crafter } }
    }
  } catch {}
  const item = blankItem()
  return { items: [item], activeId: item.id, crafter: blankCrafter() }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

const item = () => state.items.find((i) => i.id === state.activeId) ?? state.items[0]

// ---------- rules ----------

const isStep = (d) => DUR_STEPS.includes(d)
const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th")
const gp = (n) => (Math.round(n * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 }) + " gp"
const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })
const signed = (n) => (n > 0 ? "+" : n < 0 ? "−" : "±") + fmt(Math.abs(n))

function basePower(c) {
  const p = POWERS[c.sphere]?.powers[c.power]
  return p ? { name: p[0], range: p[1], dur: p[2] } : { name: "Custom base effect", range: Number(c.baseRange) || 0, dur: c.baseDur || "r" }
}

// Item Base Powers: the talents a sphere prices differently from the usual +1, told apart by the
// compendium's tags (or name). Returns [base complexity, why], or null for the usual price.
const rowTags = (r, sphere) => (rowMatch(r, sphere)?.entry.tags ?? []).map((t) => String(t).toLowerCase())
function talentRule(r, c) {
  if (r.kind !== "talent") return null
  const hit = rowMatch(r, c.sphere)?.entry
  if (!hit) return null
  const tags = (hit.tags ?? []).map((t) => String(t).toLowerCase())
  const name = norm(hit.name)
  // "change the effect to ...": the first talent of that tag replaces the base effect
  const firstWith = (tag) => c.rows.find((x) => x.kind === "talent" && rowTags(x, c.sphere).includes(tag)) === r
  switch (c.sphere) {
    case "Alteration":
      if (name === "mass alteration") return [2, "Mass Alteration is +2"]
      break
    case "Dark":
      if (tags.includes("blot") && firstWith("blot")) return [0, "one (blot) talent replaces the darkness for free"]
      if (tags.includes("meld") && firstWith("meld")) return [0, "one (meld) talent replaces the darkness for free"]
      break
    case "Destruction":
      if (name === "admixture") return [0, "Admixture is free; each blast type added costs as usual"]
      break
    case "Illusion":
      if (name === "suppression") return [2, "Suppression is +2"]
      break
    case "Mana":
      if (tags.includes("manabond")) return [2, "a manabond talent is +2"]
      break
    case "Mind":
      if (tags.includes("cloud")) return [2, "a (cloud) talent is +2"]
      break
    case "Protection":
      // a (succor) that replaces the aegis is free; with an (aegis) talent in the effect it is added to it (+1)
      if (tags.includes("succor") && firstWith("succor") && !c.rows.some((x) => x.kind === "talent" && rowTags(x, c.sphere).includes("aegis")))
        return [0, "one (succor) talent replaces the aegis for free"]
      break
    case "War":
      if (tags.includes("rally")) return [2, "a rally in place of the totem is +2"]
      break
    case "Weather":
      for (const tag of ["mantle", "shroud"]) if (tags.includes(tag) && firstWith(tag)) return [0, `one (${tag}) talent replaces the weather change for free (range becomes touch)`]
      break
  }
  return null
}

// what the compendium knows about a row that the crafter should hear about: a talent from the wrong
// sphere, an advanced talent's prerequisites, a feat's caster level, a likely spell point cost
function rowChecks(r, c, cl) {
  const out = { warnings: [], notes: [] }
  const k = ROW_KINDS[r.kind] ?? ROW_KINDS.custom
  if (!COMPENDIUM.loaded || !k.access || !norm(r.name)) return out
  const n = norm(r.name)
  const needCl = (text) => { const m = String(text ?? "").match(/caster level (\d+)|(\d+)(?:st|nd|rd|th) caster level/i); return m ? Number(m[1] || m[2]) : 0 }
  if (r.kind === "talent" || r.kind === "advanced") {
    const hit = rowMatch(r, c.sphere)?.entry
    if (!hit) {
      const other = COMPENDIUM.entries.find((e) => /talent$/.test(e.kind) && norm(e.name) === n)
      if (other) out.warnings.push(`${r.name} is ${/^[aeiou]/i.test(other.sphere) ? "an" : "a"} ${other.sphere} talent: an effect takes talents from its base sphere (${c.sphere}). Mix in a second effect for another sphere.`)
      else out.notes.push(`${r.name} isn't a ${c.sphere} talent in the compendium (check the spelling, or leave it as your own).`)
      return out
    }
    if (hit.kind === "advanced talent") {
      const need = needCl(hit.prerequisites)
      if (need > cl) out.warnings.push(`${hit.name} needs caster level ${need}; the item is caster level ${cl}.`)
      // talents of this sphere named in its prerequisites must be part of the effect too
      let text = (String(hit.prerequisites ?? "").match(/\(([\s\S]*)\)/)?.[1] ?? "").toLowerCase()
      const named = []
      for (const e of talentSources(c.sphere).filter((e) => e.id !== hit.id).sort((a, b) => b.name.length - a.name.length)) {
        const en = norm(e.name)
        if (en.length > 2 && text.includes(en)) { named.push(e.name); text = text.split(en).join(" ") }
      }
      const have = new Set(c.rows.map((x) => norm(x.name)))
      const missing = named.filter((x) => !have.has(norm(x)))
      const either = /\bor\b/.test(String(hit.prerequisites ?? ""))
      if (named.length && (either ? missing.length === named.length : missing.length))
        out.warnings.push(`${hit.name} needs ${either ? "one of " : ""}${missing.join(either ? " or " : ", ")} added to the effect first (its prerequisites: ${hit.prerequisites}).`)
    }
    const sp = guessSp(hit)
    if (sp && !(Number(r.sp) > 0)) out.notes.push(`${hit.name}'s text mentions spending ${sp > 1 ? `${sp} spell points` : "a spell point"}: set its SP if this use needs it (+1 complexity each).`)
  } else if (r.kind === "feat" || r.kind === "metamagic") {
    const f = COMPENDIUM.feats.find((x) => norm(x.name.replace(/\s*\(.*\)\*?$/, "")) === n.replace(/\s*\(.*\)\*?$/, "") || norm(x.name) === n)
    if (!f) { out.notes.push(`${r.name} isn't a Spheres feat in the compendium (check the spelling, or leave it as your own).`); return out }
    const meta = (f.types ?? []).includes("Metamagic")
    if (meta && r.kind === "feat") out.warnings.push(`${f.name} is a metamagic feat: use a Metamagic row (+1, +1 per spell point it costs).`)
    if (!meta && r.kind === "metamagic") out.warnings.push(`${f.name} isn't a metamagic feat: use a Feat row (+1).`)
    const need = needCl(f.prerequisites)
    if (need > cl) out.warnings.push(`${f.name} needs caster level ${need}; the item is caster level ${cl}.`)
  }
  return out
}

function rowComplexity(r, crafter, c) {
  const k = ROW_KINDS[r.kind] ?? ROW_KINDS.custom
  const rule = c ? talentRule(r, c) : null
  let cx = k.custom ? Number(r.cx) || 0 : (rule ? rule[0] : k.base) + (k.sp ? Number(r.sp) || 0 : 0)
  if (r.kind === "advanced" && crafter.mythic) cx -= 1
  return r.variant ? cx / 2 : cx
}

// price, complexity and requirements of one component
function evalComp(c, it, crafter) {
  const K = KINDS[c.kind]
  const cl = Number(it.cl) || 0
  const out = { price: 0, minCl: 1, warnings: [], notes: [], blockers: [], talents: [], missing: 0, formula: "", lines: [] }
  const needTalent = (name, has, bypass, why) => {
    if (!name) return
    out.talents.push(name)
    if (has) return
    if (bypass && !K.strict) out.missing++
    else out.blockers.push(`${name}: ${why ?? (K.strict ? `${K.label.toLowerCase()}s can't bypass a talent prerequisite` : "can't be bypassed with a higher DC")}`)
  }

  if (K.talentBased) {
    const bp = basePower(c)
    const parts = [[c.continual ? "Continual instantaneous effect" : "Base", c.continual ? 6 : 1]]
    const act = ACTIVATIONS[c.activation] ?? ACTIVATIONS.standard
    if (act[1]) parts.push([act[0], act[1]])
    const dr = (Number(c.range) || 0) - bp.range
    if (dr) parts.push([`Range ${RANGES[bp.range]} → ${RANGES[c.range]}`, dr])
    if (isStep(bp.dur) && isStep(c.dur)) {
      const dd = DUR_STEPS.indexOf(c.dur) - DUR_STEPS.indexOf(bp.dur)
      if (dd) parts.push([`Duration ${DURATIONS[bp.dur]} → ${DURATIONS[c.dur]}`, dd * 2])
    }
    if (c.permanent) parts.push(["Permanency", 2])
    for (const r of c.rows) {
      const k = ROW_KINDS[r.kind] ?? ROW_KINDS.custom
      const rule = talentRule(r, c)
      parts.push([`${k.label}${r.name ? ": " + r.name : ""}${rule ? ` (${rule[1]})` : ""}${r.variant ? " (variant option, half)" : ""}`, rowComplexity(r, crafter, c)])
      const checks = rowChecks(r, c, cl)
      out.warnings.push(...checks.warnings)
      out.notes.push(...checks.notes, ...(rule ? [`${r.name}: ${rule[1]}.`] : []))
      if (k.access) needTalent(r.name || k.label, r.has !== false, k.bypass, r.kind === "advanced" ? "advanced talents can't be bypassed" : null)
    }
    if (crafter.simple) parts.push(["Simple (crafting tradition boon)", -1])
    const raw = parts.reduce((s, p) => s + p[1], 0)
    const cx = Math.max(1, raw)
    let mult = 1
    let multLabel = ""
    if (c.kind === "marvelous") {
      const u = MARVELOUS_USES[c.uses] ?? MARVELOUS_USES[1]
      mult = u[1]
      multLabel = u[1] === 1 ? "" : ` × ${u[1]} (${u[0]})`
    }
    out.complexity = cx
    out.parts = parts
    out.price = K.base * cl * cx * mult
    out.formula = `${fmt(K.base)} × CL ${cl} × complexity ${fmt(cx)}${multLabel}`
    out.minCl = Math.ceil(cx)
    out.range = RANGES[c.range]
    out.duration = c.continual ? "Continuous" : c.permanent ? "Permanent" : DURATIONS[c.dur]
    out.activation = c.kind === "apparatus" ? "Wear, hold or carry" : act[0]
    if (raw < 1) out.warnings.push(`Complexity can't go below 1 (rules total ${fmt(raw)}).`)
    if (cl < cx) out.warnings.push(`Caster level ${cl} is below complexity ${fmt(cx)}; an effect's CL must be at least its complexity.`)
    if (c.permanent) {
      if (c.dur !== "h") out.warnings.push("Permanency needs a duration measured in hours.")
      if (cl < 10) out.warnings.push("Permanency needs caster level 10 or higher.")
    }
    if (c.kind === "apparatus" && !c.continual && !c.permanent && c.dur !== "h")
      out.warnings.push("An apparatus needs a duration measured in hours: raise the duration (+2 complexity per step).")
    if (c.continual && c.kind !== "apparatus") out.warnings.push("The base complexity 6 continual option is for apparatuses.")
    if (c.kind === "marvelous" || c.kind === "compound" || c.kind === "engine") out.saveDc = 10 + Math.floor(cl / 2)
  } else if (c.kind === "engine") {
    const steps = Math.floor(cl / 2)
    const slots = Math.max(0, steps - 1) + (c.focused ? 1 : 0)
    const used = c.talents.length + (Number(c.extraSp) || 0)
    for (const t of c.talents) needTalent(t.name, t.has !== false, true)
    out.price = Math.max(1, steps) ** 2 * 1000
    out.formula = `(CL ${cl} ÷ 2)² × 1,000`
    out.minCl = 2
    out.lines.push(`Capacity ${used} of ${slots} talent / spell point slots · spell point pool ${1 + (Number(c.extraSp) || 0)}`)
    out.saveDc = 10 + Math.floor(cl / 2)
    if (cl < 2) out.warnings.push("A spell engine needs at least caster level 2.")
    if (cl % 2) out.warnings.push(`Spell engines price by even caster levels; CL ${cl} is priced as CL ${steps * 2}.`)
    if (cl > 20) out.warnings.push("The spell engine table stops at caster level 20.")
    if (used > slots) out.warnings.push(`${used} talents and extra spell points, but CL ${cl} only allows ${slots}.`)
  } else if (c.kind === "implement") {
    const enh = Number(c.enh) || 0
    const extra = c.extraSpheres.length
    const tal = c.talents.length
    const ab = c.abilities.reduce((s, a) => s + (Number(a.bonus) || 0), 0)
    const flat = c.abilities.reduce((s, a) => s + (Number(a.gp) || 0), 0)
    const total = enh + extra + 2 * tal + ab
    for (const t of c.talents) needTalent(t.name, t.has !== false, true)
    for (const s of c.extraSpheres) out.talents.push(`${s.name} sphere`)
    out.price = 2000 * total * total + flat
    out.formula = `2,000 × (+${total})²${flat ? ` + ${fmt(flat)}` : ""}`
    out.lines.push(`Bonus equivalent +${total}: +${enh} enhancement${extra ? `, +${extra} extra spheres` : ""}${tal ? `, +${2 * tal} for ${tal} talent${tal > 1 ? "s" : ""}` : ""}${ab ? `, +${ab} special abilities` : ""}`)
    out.minCl = 3 * enh
    if (enh < 1 || enh > 5) out.warnings.push("Implements grant a +1 to +5 enhancement bonus.")
    if (total > 10) out.warnings.push(`Total bonus +${total} is over the +10 limit.`)
  } else if (c.kind === "charm") {
    const ch = CHARMS[c.charm] ?? CHARMS.resistance
    const b = Number(c.bonus) || 0
    out.price = Math.max(0, ch.price(b))
    out.formula = ch.label
    out.minCl = Math.max(1, ch.cl(b))
    out.lines.push(`${ch.unit}${b} ${ch.label.toLowerCase()}`)
    if (b < ch.min || b > ch.max) out.warnings.push(`${ch.label}: allowed range is ${ch.unit}${ch.min} to ${ch.unit}${ch.max}.`)
  } else if (c.kind === "arms") {
    const enh = Number(c.enh) || 0
    const ab = c.abilities.reduce((s, a) => s + (Number(a.bonus) || 0), 0)
    const flat = c.abilities.reduce((s, a) => s + (Number(a.gp) || 0), 0)
    const total = enh + ab
    const unit = c.arms === "armor" ? 1000 : 2000
    out.price = unit * total * total + flat
    out.formula = `${fmt(unit)} × (+${total})²${flat ? ` + ${fmt(flat)}` : ""}`
    out.minCl = 3 * enh
    if (enh < 1 || enh > 5) out.warnings.push("Enhancement bonus must be +1 to +5 (and at least +1 before special abilities).")
    if (total > 10) out.warnings.push(`Total bonus +${total} is over the +10 limit.`)
  } else if (c.kind === "custom") {
    out.price = Number(c.price) || 0
    out.formula = "entered price"
    out.minCl = Number(c.minCl) || 1
  }
  out.basis = c.kind === "custom" ? c.basis : K.uses
  out.feat = c.kind === "custom" ? c.feat : K.feat
  return out
}

function evalItem(it, crafter) {
  const comps = it.components.map((c) => ({ c, r: evalComp(c, it, crafter) }))
  const cl = Number(it.cl) || 0
  // Multiple effects: everything but the most expensive costs x1.5 (x2 when mixed into one effect)
  const order = comps.map((x, i) => i).sort((a, b) => comps[b].r.price - comps[a].r.price)
  const top = order[0]
  let magic = 0
  comps.forEach((x, i) => {
    const mixed = x.c.combine === "mixed" && KINDS[x.c.kind].talentBased
    x.mult = i === top ? 1 : mixed ? 2 : 1.5
    x.total = x.r.price * x.mult
    magic += x.total
  })
  const steps = []
  if (comps.length > 1) steps.push(["Effects (most expensive ×1, others ×1.5 or ×2 mixed)", magic])
  if (it.noSpace) {
    magic *= 2
    steps.push(["No space limitation ×2", magic])
  }
  if (it.mythicMastery) {
    magic += 40000
    steps.push(["Mythic mastery +40,000", magic])
  }
  const baseCost = Number(it.baseCost) || 0
  const extraCost = Number(it.extraCost) || 0
  let craft = magic / 2
  const craftNotes = []
  if (crafter.expensive) {
    craft *= 1.25
    craftNotes.push("Expensive +25%")
  }
  if (crafter.cheap) {
    craft = Math.max(craft - (magic / 2) * 0.1, magic * 0.4)
    craftNotes.push("Cheap −10%")
  }

  const warnings = []
  const blockers = []
  comps.forEach((x, i) => {
    const tag = comps.length > 1 ? `${KINDS[x.c.kind].label}${x.c.label ? ` (${x.c.label})` : ""}: ` : ""
    x.r.warnings.forEach((w) => warnings.push(tag + w))
    x.r.blockers.forEach((w) => blockers.push(tag + w))
  })
  if (crafter.expensive && crafter.cheap) warnings.push("A crafting tradition can't have both Expensive and Cheap.")
  const minCl = Math.max(1, ...comps.map((x) => x.r.minCl))
  if (cl < minCl) warnings.push(`Item caster level ${cl} is below the minimum ${minCl} its effects need.`)

  // item creation check
  let dc = 10 + cl
  const dcParts = [["10 + caster level", 10 + cl]]
  const missing = comps.reduce((s, x) => s + x.r.missing, 0)
  if (missing) {
    dc += 5 * missing
    dcParts.push([`${missing} missing talent${missing > 1 ? "s" : ""}`, 5 * missing])
  }
  const bypass = []
  const noSphere = [...new Set(comps.filter((x) => !x.c.hasSphere && sphereOf(x.c)).map((x) => sphereOf(x.c)))]
  if (noSphere.length) bypass.push([`missing base sphere${noSphere.length > 1 ? "s" : ""} (${noSphere.join(", ")})`, noSphere.length])
  const usesCl = comps.some((x) => x.r.basis === "cl")
  const usesMsb = comps.some((x) => x.r.basis === "msb")
  const clShort = usesCl ? Math.max(0, cl - (Number(crafter.cl) || 0)) : 0
  const msbShort = usesMsb ? Math.max(0, cl - (Number(crafter.msb) || 0)) : 0
  if (clShort) bypass.push([`caster level ${clShort} short`, clShort])
  if (msbShort) bypass.push([`MSB ${msbShort} short`, msbShort])
  for (const [what, n] of bypass) {
    if (crafter.versatile) {
      dc += 5 * n
      dcParts.push([`Versatile Crafter: ${what}`, 5 * n])
    } else blockers.push(`Crafter is ${what}: needs Versatile Crafter (+5 DC each) or a helper who has it.`)
  }
  const strictBypass = crafter.versatile && noSphere.length && comps.some((x) => KINDS[x.c.kind].strict && !x.c.hasSphere)
  if (strictBypass) warnings.push("Versatile Crafter can't bypass prerequisites for compounds, scrolls or spell engines.")

  const bonus = Number(crafter.spellcraft) || 0
  const need = dc - bonus
  const success = Math.min(1, Math.max(0, (21 - need) / 20))
  const cursed = Math.min(1, Math.max(0, (dc - 5 - bonus) / 20))

  // crafting time: 8 hours per 1,000 gp in 4-hour blocks, 8 hours minimum; cheap scrolls/compounds 2 hours
  const quick = comps.every((x) => x.c.kind === "scroll" || x.c.kind === "compound") && magic <= 250
  const hours = quick ? 2 : Math.max(8, Math.ceil(magic / 500) * 4)
  const perDay = WORK[crafter.work]?.[1] ?? 8
  const days = Math.ceil(hours / Math.min(8, perDay))

  const spheres = [...new Set(comps.map((x) => sphereOf(x.c)).filter(Boolean))]
  const feats = [...new Set(comps.map((x) => x.r.feat).filter(Boolean))]
  if (crafter.mythic && comps.some((x) => (x.c.rows ?? []).some((r) => r.kind.startsWith("mythic")))) feats.push("Mythic Crafter")
  if (it.mythicMastery && !feats.includes("Mythic Crafter")) feats.push("Mythic Crafter")

  return { comps, cl, minCl, magic, steps, craft, craftNotes, baseCost, extraCost, totalCraft: craft + baseCost + extraCost, market: magic + baseCost, warnings, blockers, dc, dcParts, bonus, success, cursed, take10: 10 + bonus >= dc, hours, days, perDay, spheres, feats }
}

function sphereOf(c) {
  if (c.kind === "charm") {
    const ch = CHARMS[c.charm]
    return ch?.sphere ?? c.sphere
  }
  if (c.kind === "arms") return c.sphere || ""
  return c.sphere || ""
}

const aura = (cl) => (cl >= 21 ? "overwhelming" : cl >= 12 ? "strong" : cl >= 6 ? "moderate" : "faint")

function statBlock(it, ev) {
  const name = it.name || "Unnamed item"
  const slot = SLOTS[it.slot]?.[0].replace(/ \(.*\)/, "").toLowerCase() ?? it.slot
  const lines = [`### ${name}`, "", `**Aura** ${aura(ev.cl)} ${ev.spheres.join(", ") || "magic"}; **CL** ${ordinal(ev.cl)}`, `**Slot** ${slot}; **Price** ${gp(ev.market)}; **Weight** ${it.weight || "—"}`, ""]
  if (it.description) lines.push(it.description.trim(), "")
  for (const { c, r } of ev.comps) {
    const K = KINDS[c.kind]
    if (K.talentBased) {
      const bp = basePower(c)
      const bits = [`**${c.label || `${c.sphere}: ${bp.name}`}**`, `${K.label}${c.kind === "compound" ? ` (${COMPOUND_FORMS[c.form].toLowerCase()})` : ""}`]
      if (c.kind === "marvelous") bits.push(`usable ${MARVELOUS_USES[c.uses][0]}`)
      bits.push(`activation ${r.activation.toLowerCase()}`, `range ${r.range.toLowerCase()}`, `duration ${r.duration.toLowerCase()}`)
      if (r.saveDc) bits.push(`save DC ${r.saveDc}`)
      lines.push(bits.join("; ") + ".")
      const adds = c.rows.filter((x) => x.name).map((x) => x.name)
      if (adds.length) lines.push(`Includes: ${adds.join(", ")}.`)
      lines.push("")
    } else if (c.kind === "engine") {
      const t = c.talents.map((x) => x.name).filter(Boolean)
      lines.push(`**${c.label || `${c.sphere} spell engine`}** ${c.sphere} base sphere, caster level ${ev.cl}, ${1 + (Number(c.extraSp) || 0)} spell point${c.extraSp > 0 ? "s" : ""}${t.length ? `; talents: ${t.join(", ")}` : ""}${c.focused ? "; focused" : ""}; save DC ${r.saveDc}.`, "")
    } else if (c.kind === "implement") {
      const parts = [`+${c.enh} ${[c.sphere, ...c.extraSpheres.map((s) => s.name)].join(" and ")} implement`]
      const t = c.talents.map((x) => x.name).filter(Boolean)
      if (t.length) parts.push(`grants ${t.join(", ")}`)
      const a = c.abilities.map((x) => x.name).filter(Boolean)
      if (a.length) parts.push(a.join(", "))
      lines.push(`**${c.label || "Implement"}** ${parts.join("; ")}.`, "")
    } else if (c.kind === "charm") {
      lines.push(`**${c.label || "Charm"}** ${r.lines[0]}${CHARMS[c.charm].sphere ? "" : ` (${OTHER_BONUS_SPHERES[c.sphere] ?? c.sphere})`}.`, "")
    } else if (c.kind === "arms") {
      const a = c.abilities.map((x) => x.name).filter(Boolean)
      lines.push(`**${c.label || (c.arms === "armor" ? "Armor" : "Weapon")}** +${c.enh} ${c.arms === "armor" ? "armor/shield" : "weapon"}${a.length ? ` (${a.join(", ")})` : ""}.`, "")
    } else if (c.label) lines.push(`**${c.label}**`, "")
  }
  const reqs = [...ev.feats]
  const talents = [...new Set(ev.comps.flatMap((x) => x.r.talents))]
  reqs.push(...ev.spheres.map((s) => `${s} sphere`))
  if (talents.length) reqs.push(...talents)
  if (ev.comps.some((x) => x.r.basis === "msb")) reqs.push(`MSB ${ev.cl}`)
  lines.push(`**Construction Requirements** ${reqs.join(", ") || "—"}; **Cost** ${gp(ev.totalCraft)}`)
  return lines.join("\n")
}

// ---------- rendering ----------

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch])
const num = (path, v, attrs = "") => `<input type="number" data-bind="${path}" data-type="num" value="${esc(v)}" ${attrs} />`
const txt = (path, v, ph = "", attrs = "") => `<input type="text" data-bind="${path}" value="${esc(v)}" placeholder="${esc(ph)}" ${attrs} />`
const sel = (path, v, opts, re = true, attrs = "") =>
  `<select data-bind="${path}" ${re ? "data-rerender" : ""} ${attrs}>${opts.map(([k, l]) => `<option value="${esc(k)}" ${String(k) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`
const chk = (path, v, label, re = false, title = "") => `<label class="check" ${title ? `title="${esc(title)}"` : ""}><input type="checkbox" data-bind="${path}" ${v ? "checked" : ""} ${re ? "data-rerender" : ""} /> ${label}</label>`
const field = (label, inner, cls = "") => `<label class="field ${cls}"><span>${label}</span>${inner}</label>`
const sphereOpts = SPHERES.map((s) => [s, s])
const btn = (act, label, data = "", cls = "small ghost", title = "") => `<button type="button" class="${cls}" data-act="${act}" ${data} ${title ? `title="${esc(title)}"` : ""}>${label}</button>`

function renderAll() {
  const it = item()
  document.getElementById("itemName").value = it.name
  const lib = document.getElementById("library")
  lib.innerHTML = state.items.map((x) => `<option value="${x.id}" ${x.id === it.id ? "selected" : ""}>${esc(x.name || "Unnamed item")}</option>`).join("")
  document.getElementById("btnDel").disabled = false
  document.getElementById("panel").innerHTML = renderPanel(it)
  refresh()
}

function renderPanel(it) {
  const P = "item"
  const slotHint = SLOTS[it.slot]?.[1]
  return `
  <section class="card">
    <h2>Item</h2>
    <div class="grid">
      ${field("Item type", `<select data-act="setType" aria-label="Item type">${Object.entries(KINDS).map(([k, K]) => `<option value="${k}" ${k === it.type ? "selected" : ""}>${esc(K.label)}${K.feat ? ` (${esc(K.feat)})` : ""}</option>`).join("")}</select>`, "type-field")}
      ${field("Caster level", num(`${P}.cl`, it.cl, 'min="1" max="30"') + ` <span class="muted" data-out="minCl"></span>`)}
      ${field("Slot", sel(`${P}.slot`, it.slot, Object.entries(SLOTS).map(([k, v]) => [k, v[0]])))}
      ${field("Weight", txt(`${P}.weight`, it.weight, "1 lb."))}
    </div>
    ${slotHint ? `<p class="note">Slot affinity: ${esc(slotHint)}. (Guideline only; see <a href="${RULES_URL}#table-item-slot-affinities" target="_blank" rel="noopener">Item Slot Affinities</a>.)</p>` : ""}
    <div class="grid">
      ${field("Base object (supplied separately)", txt(`${P}.baseObject`, it.baseObject, "masterwork longsword"))}
      ${field("Base object cost (gp)", num(`${P}.baseCost`, it.baseCost, 'min="0" step="any"'))}
      ${field("Other material costs (gp)", num(`${P}.extraCost`, it.extraCost, 'min="0" step="any"'))}
    </div>
    <div class="row checks">
      ${chk(`${P}.noSpace`, it.noSpace, "No space limitation (×2)", false, "Needn't be worn or held, e.g. a magical tattoo or orbiting ioun stone")}
      ${chk(`${P}.mythicMastery`, it.mythicMastery, "Mythic mastery (+40,000 gp)", false, "Grants a mythic sphere mastery to a mythic user with the base sphere")}
    </div>
    ${field("Description", `<textarea data-bind="${P}.description" rows="3" placeholder="What it looks like and what it does">${esc(it.description)}</textarea>`)}
  </section>

  <section>
    <div class="row section-head"><h2>Effects</h2><span class="spacer"></span></div>
    <p class="note">Each effect is priced on its own. With more than one, the most expensive is full price and every other one costs ×1.5 (×2 if it's mixed into the same effect). Talent-based effects share the item's caster level.</p>
    ${it.components.map((c, i) => renderComp(c, i, it)).join("")}
    <div class="row add-row">
      ${btn("addComp", `+ Add another ${KINDS[it.type].label.toLowerCase()} effect`, `data-kind="${it.type}"`, "small")}
      ${
        KINDS[it.type].consumable
          ? ""
          : `<select data-act="addOther" aria-label="Add a different kind of effect"><option value="">+ Combine with a different kind of effect…</option>${Object.entries(KINDS)
              .filter(([k, K]) => k !== it.type && !K.consumable)
              .map(([k, K]) => `<option value="${k}">${esc(K.label)}${K.feat ? ` (needs ${esc(K.feat)})` : ""}</option>`)
              .join("")}</select>`
      }
    </div>
    ${KINDS[it.type].consumable ? "" : `<p class="note">Combining kinds follows the Multiple Effects rule (e.g. a weapon with a marvelous-item power): the crafter needs every crafting feat involved.</p>`}
  </section>

  ${renderCrafter()}

  <section class="card">
    <div class="row"><h2>Stat block</h2><span class="spacer"></span>${btn("copy", "Copy", "", "small")}</div>
    <p class="note">Markdown in the wiki's item format. Paste it into a note, handout or the item's description in your VTT.</p>
    <pre class="statblock" data-out="statblock"></pre>
  </section>`
}

function renderComp(c, i, it) {
  const K = KINDS[c.kind]
  const P = `item.components.${i}`
  const head = `
    <div class="comp-head">
      <span class="kind-tag k-${c.kind}">${K.label}</span>
      ${txt(`${P}.label`, c.label, "Effect name (optional)", 'class="comp-label"')}
      <span class="comp-price" data-out="price-${i}"></span>
      <span class="comp-btns">
        ${btn("moveComp", "↑", `data-i="${i}" data-dir="-1"`, "small ghost", "Move up")}
        ${btn("moveComp", "↓", `data-i="${i}" data-dir="1"`, "small ghost", "Move down")}
        ${btn("delComp", "✕", `data-i="${i}"`, "small ghost danger", "Remove effect")}
      </span>
    </div>`
  const combine =
    it.components.length > 1
      ? `<div class="row combine">${
          K.talentBased
            ? field("If not the most expensive", sel(`${P}.combine`, c.combine, [["separate", "Separate effect (×1.5)"], ["mixed", "Mixed into one effect (×2)"]], false))
            : `<span class="note">Costs ×1.5 unless it's the most expensive effect.</span>`
        }</div>`
      : ""
  let body = ""
  if (K.talentBased) body = renderTalentBody(c, P, i)
  else if (c.kind === "engine") body = renderEngine(c, P, i)
  else if (c.kind === "implement") body = renderImplement(c, P, i)
  else if (c.kind === "charm") body = renderCharm(c, P)
  else if (c.kind === "arms") body = renderArms(c, P, i)
  else if (c.kind === "custom") body = renderCustom(c, P)
  return `<div class="card comp">${head}${body}${combine}
    <div class="comp-foot" data-out="foot-${i}"></div></div>`
}

function hasSphereBox(c, P) {
  return chk(`${P}.hasSphere`, c.hasSphere, "Crafter has the base sphere", false, "Yourself or through an ally, implement, spell engine or scroll present for the whole crafting time")
}

function renderTalentBody(c, P, i) {
  const powers = POWERS[c.sphere]?.powers ?? []
  const bp = basePower(c)
  const custom = !powers[c.power]
  const durOpts = isStep(bp.dur) ? DUR_STEPS.map((d) => [d, DURATIONS[d]]) : [[bp.dur, DURATIONS[bp.dur]]]
  const mods = POWERS[c.sphere]?.mods ?? []
  const slug = c.sphere.toLowerCase().replace(/\s+/g, "-")
  return `
    <div class="grid">
      ${field("Base sphere", sel(`${P}.sphere`, c.sphere, sphereOpts, true, `data-reset-power="${i}"`))}
      ${field(`Base power <a href="${RULES_URL}#${slug}" target="_blank" rel="noopener" class="rules-link">rules ↗</a>`, sel(`${P}.power`, custom ? -1 : c.power, [...powers.map((p, k) => [k, p[0]]), [-1, "Custom base effect"]], true, `data-reset-power="${i}"`))}
      ${custom ? field("Base range", sel(`${P}.baseRange`, c.baseRange, RANGES.map((r, k) => [k, r]))) + field("Base duration", sel(`${P}.baseDur`, c.baseDur, Object.entries(DURATIONS))) : ""}
    </div>
    <p class="note">Base: range ${RANGES[bp.range].toLowerCase()}, duration ${DURATIONS[bp.dur].toLowerCase()}.</p>
    ${COMPENDIUM.entries.filter((e) => e.sphere === c.sphere && e.kind === "sphere ability")
      .map((e) => rulesBox(`base:${i}:${e.id}`, `${esc(c.sphere)}: ${esc(e.name)} (base ability rules)`, e)).join("")}
    <div class="grid">
      ${field("Range (±1 per step)", sel(`${P}.range`, c.range, RANGES.map((r, k) => [k, r]), false))}
      ${field(isStep(bp.dur) ? "Duration (±2 per step)" : "Duration (fixed)", sel(`${P}.dur`, c.dur, durOpts, false, isStep(bp.dur) ? "" : "disabled"))}
      ${c.kind === "apparatus" ? "" : field("Activation", sel(`${P}.activation`, c.activation, Object.entries(ACTIVATIONS).map(([k, v]) => [k, `${v[0]} (${signed(v[1])})`]), false))}
      ${c.kind === "marvelous" ? field("Uses", sel(`${P}.uses`, c.uses, Object.entries(MARVELOUS_USES).map(([k, v]) => [k, `${v[0]} (×${v[1]})`]), false)) : ""}
      ${c.kind === "compound" ? field("Form", sel(`${P}.form`, c.form, Object.entries(COMPOUND_FORMS), false)) : ""}
    </div>
    <div class="row checks">
      ${hasSphereBox(c, P)}
      ${chk(`${P}.permanent`, c.permanent, "Permanent (+2)", false, "Needs an hours duration and CL 10+")}
      ${c.kind === "apparatus" ? chk(`${P}.continual`, c.continual, "Continual from an instantaneous effect (base complexity 6)", false, "e.g. Life: continual cure becomes fast healing 1, continual restore becomes an immunity") : ""}
    </div>
    <h3>Talents and modifiers</h3>
    ${compendiumNote(c.sphere)}
    ${["talent", "advanced", "feat", "metamagic"].map((k) => datalist(`cmp-${i}-${k}`, rowSources(k, c.sphere))).join("")}
    ${
      c.rows.length
        ? `<div class="table-wrap"><table class="mods">
      <thead><tr><th>Type</th><th>Name</th><th class="num">SP / CX</th><th title="An option the user picks between: half cost beyond the most expensive">Variant</th><th title="Crafter has this (or a helper does)">Have</th><th class="num">Complexity</th><th></th></tr></thead>
      <tbody>${c.rows.map((r, j) => renderRow(r, `${P}.rows.${j}`, i, j, c.sphere)).join("")}</tbody></table></div>`
        : `<p class="muted">No talents added yet: the effect is just the base power.</p>`
    }
    <div class="row add-row">
      ${btn("addRow", "+ Talent", `data-i="${i}" data-kind="talent"`)}
      ${btn("addRow", "+ Advanced talent", `data-i="${i}" data-kind="advanced"`)}
      ${btn("addRow", "+ Feat", `data-i="${i}" data-kind="feat"`)}
      ${btn("addRow", "+ Metamagic", `data-i="${i}" data-kind="metamagic"`)}
      ${btn("addRow", "+ Other", `data-i="${i}" data-kind="unique"`)}
      ${
        mods.length
          ? `<select data-act="quickMod" data-i="${i}" aria-label="${esc(c.sphere)} options"><option value="">${esc(c.sphere)} options…</option>${mods.map((m, k) => `<option value="${k}">${esc(m[0])} (${signed(m[1])})</option>`).join("")}</select>`
          : ""
      }
    </div>`
}

// how much of a sphere the compendium covers, above its talent rows
function compendiumNote(sphere) {
  if (!COMPENDIUM.loaded) return ""
  const t = talentSources(sphere).length
  const f = COMPENDIUM.feats.filter((x) => x.spheres.includes(sphere)).length
  return t
    ? `<p class="note">Name boxes suggest the ${t} ${esc(sphere)} talents${f ? ` and ${f} feats` : ""} in the site's compendium; a recognized name links to its rules, is priced by the ${esc(sphere)} rules where they differ from +1, and is checked against its prerequisites.</p>`
    : `<p class="note">The site's compendium has no ${esc(sphere)} talents, so type their names in${f ? ` (its ${f} feats are suggested)` : ""}.</p>`
}

function renderRow(r, P, i, j, sphere) {
  const k = ROW_KINDS[r.kind] ?? ROW_KINDS.custom
  const kinds = Object.entries(ROW_KINDS).map(([key, v]) => [key, v.label])
  const listAttr = rowSources(r.kind, sphere).length ? `list="cmp-${i}-${r.kind}"` : ""
  return `<tr>
    <td>${sel(`${P}.kind`, r.kind, kinds)}</td>
    <td>${txt(`${P}.name`, r.name, k.access ? "Talent or feat name" : "What it changes", `${listAttr} data-rerender data-row-name`)}${cmpLink(rowMatch(r, sphere)?.entry)}</td>
    <td class="num">${k.custom ? num(`${P}.cx`, r.cx, 'step="1" title="Complexity"') : k.sp ? num(`${P}.sp`, r.sp, `min="0" title="${k.sp}"`) : ""}</td>
    <td><input type="checkbox" data-bind="${P}.variant" ${r.variant ? "checked" : ""} aria-label="Variant option" /></td>
    <td>${k.access ? `<input type="checkbox" data-bind="${P}.has" ${r.has !== false ? "checked" : ""} aria-label="Crafter has it" />` : ""}</td>
    <td class="num" data-out="row-${i}-${j}"></td>
    <td>${btn("delRow", "✕", `data-i="${i}" data-j="${j}"`, "small ghost danger", "Remove")}</td>
  </tr>${(() => {
    // the talent's or feat's own rules text, under its row
    const hit = rowMatch(r, sphere)?.entry
    return hit ? `<tr class="cmp-text-row"><td colspan="7">${rulesBox(`row:${i}:${hit.id}`, `${esc(hit.name)}: rules text`, hit)}</td></tr>` : ""
  })()}`
}

// a "talent" column suggests the base sphere's compendium talents and links a recognized one
function listTable(c, P, i, list, cols, addLabel) {
  const talents = talentSources(c.sphere)
  const talentCell = (path, x, key, extra) => {
    const hit = talents.find((e) => norm(e.name) === norm(x[key]))
    return txt(path, x[key], extra ?? "", talents.length ? `list="cmp-${i}-sphere" data-rerender` : "") + cmpLink(hit)
  }
  const rows = c[list]
    .map(
      (x, j) => `<tr>${cols.map(([key, , type, extra]) => `<td class="${type === "num" ? "num" : ""}">${type === "num" ? num(`${P}.${list}.${j}.${key}`, x[key], extra ?? "") : type === "has" ? `<input type="checkbox" data-bind="${P}.${list}.${j}.${key}" ${x[key] !== false ? "checked" : ""} aria-label="Crafter has it" />` : type === "sphere" ? sel(`${P}.${list}.${j}.${key}`, x[key], sphereOpts, false) : type === "talent" ? talentCell(`${P}.${list}.${j}.${key}`, x, key, extra) : txt(`${P}.${list}.${j}.${key}`, x[key], extra ?? "")}</td>`).join("")}
      <td>${btn("delItem", "✕", `data-i="${i}" data-list="${list}" data-j="${j}"`, "small ghost danger", "Remove")}</td></tr>`,
    )
    .join("")
  return `${cols.some(([, , type]) => type === "talent") ? datalist(`cmp-${i}-sphere`, talents) : ""}${c[list].length ? `<div class="table-wrap"><table class="mods"><thead><tr>${cols.map(([, label, type]) => `<th class="${type === "num" ? "num" : ""}">${label}</th>`).join("")}<th></th></tr></thead><tbody>${rows}</tbody></table></div>` : ""}
    <div class="row add-row">${btn("addItem", addLabel, `data-i="${i}" data-list="${list}"`)}</div>`
}

function renderEngine(c, P, i) {
  return `
    <div class="grid">
      ${field("Base sphere", sel(`${P}.sphere`, c.sphere, sphereOpts))}
      ${field("Extra spell points", num(`${P}.extraSp`, c.extraSp, 'min="0"'))}
    </div>
    <div class="row checks">
      ${hasSphereBox(c, P)}
      ${chk(`${P}.focused`, c.focused, "Focused (sphere drawback, +1 slot)", false, "Takes a sphere-specific drawback for a bonus talent or spell point")}
    </div>
    <p class="note">Base engine: CL 2, 1 spell point, 1,000 gp. Every 2 caster levels adds one talent or spell point. Uses the item's caster level.</p>
    <h3>Talents</h3>
    ${listTable(c, P, i, "talents", [["name", "Talent", "talent", "Talent name"], ["has", "Have", "has"]], "+ Talent")}`
}

function renderImplement(c, P, i) {
  return `
    <div class="grid">
      ${field("Base sphere", sel(`${P}.sphere`, c.sphere, sphereOpts))}
      ${field("Enhancement bonus", num(`${P}.enh`, c.enh, 'min="1" max="5"'))}
    </div>
    <div class="row checks">${hasSphereBox(c, P)}</div>
    <p class="note">Each extra sphere is +1 bonus equivalent; each granted talent is +2. Price 2,000 × (total)², max +10. Caster level at least 3 × enhancement, limited by the crafter's MSB.</p>
    <h3>Extra spheres</h3>
    ${listTable(c, P, i, "extraSpheres", [["name", "Sphere", "sphere"]], "+ Sphere")}
    <h3>Granted talents</h3>
    ${listTable(c, P, i, "talents", [["name", "Talent", "talent", "Talent name"], ["has", "Have", "has"]], "+ Talent")}
    <h3>Other special abilities</h3>
    ${listTable(c, P, i, "abilities", [["name", "Ability", "text", "Name"], ["bonus", "+Bonus", "num", 'min="0"'], ["gp", "Flat gp", "num", 'min="0" step="any"']], "+ Ability")}`
}

function renderCharm(c, P) {
  const ch = CHARMS[c.charm] ?? CHARMS.resistance
  return `
    <div class="grid">
      ${field("Charm", sel(`${P}.charm`, c.charm, Object.entries(CHARMS).map(([k, v]) => [k, v.label])))}
      ${field(ch.unit.trim() === "+" ? "Bonus" : ch.unit.trim(), num(`${P}.bonus`, c.bonus, `min="${ch.min}" max="${ch.max}"`))}
      ${ch.sphere ? field("Base sphere", `<span class="static">${ch.sphere}</span>`) : field("Bonus type", sel(`${P}.sphere`, c.sphere in OTHER_BONUS_SPHERES ? c.sphere : "Fate", Object.entries(OTHER_BONUS_SPHERES), false))}
    </div>
    <div class="row checks">${hasSphereBox(c, P)}</div>`
}

function renderArms(c, P, i) {
  return `
    <div class="grid">
      ${field("Type", sel(`${P}.arms`, c.arms, [["weapon", "Weapon"], ["armor", "Armor or shield"]], false))}
      ${field("Enhancement bonus", num(`${P}.enh`, c.enh, 'min="1" max="5"'))}
      ${field("Ability sphere", sel(`${P}.sphere`, c.sphere, [["", "None"], ...sphereOpts], false))}
    </div>
    <div class="row checks">${hasSphereBox(c, P)}</div>
    <p class="note">Put the masterwork item's cost under Base object above. Special abilities need their base sphere; caster level at least 3 × enhancement, limited by the crafter's MSB.</p>
    <h3>Special abilities</h3>
    ${listTable(c, P, i, "abilities", [["name", "Ability", "text", "Name"], ["bonus", "+Bonus", "num", 'min="0"'], ["gp", "Flat gp", "num", 'min="0" step="any"']], "+ Ability")}`
}

function renderCustom(c, P) {
  return `
    <p class="note">For anything priced another way: a converted Pathfinder item, a quick conversion, or a GM-set price.</p>
    <div class="grid">
      ${field("Price (gp)", num(`${P}.price`, c.price, 'min="0" step="any"'))}
      ${field("Crafting feat", txt(`${P}.feat`, c.feat, "Craft Marvelous Item"))}
      ${field("Base sphere", sel(`${P}.sphere`, c.sphere, [["", "None"], ...sphereOpts], false))}
      ${field("Minimum CL", num(`${P}.minCl`, c.minCl, 'min="1"'))}
      ${field("Crafter limit", sel(`${P}.basis`, c.basis, [["cl", "Caster level"], ["msb", "Magic skill bonus"]], false))}
    </div>
    <div class="row checks">${hasSphereBox(c, P)}</div>`
}

function renderCrafter() {
  const C = state.crafter
  const P = "crafter"
  return `
  <section class="card">
    <h2>Crafter</h2>
    <p class="note">Saved for every item in this browser.</p>
    <div class="grid">
      ${field("Caster level", num(`${P}.cl`, C.cl, 'min="0"'))}
      ${field("Magic skill bonus", num(`${P}.msb`, C.msb, 'min="0"'))}
      ${field("Spellcraft (or Craft) bonus", num(`${P}.spellcraft`, C.spellcraft))}
      ${field("Working conditions", sel(`${P}.work`, C.work, Object.entries(WORK).map(([k, v]) => [k, v[0]]), false))}
    </div>
    <div class="row checks">
      ${chk(`${P}.versatile`, C.versatile, "Versatile Crafter", false, "Bypass a missing base sphere or caster level / MSB at +5 DC each")}
      ${chk(`${P}.mythic`, C.mythic, "Mythic Crafter", false, "Advanced talents cost +1 instead of +2; enables mythic infusions")}
    </div>
    <h3>Crafting tradition</h3>
    <div class="row checks">
      ${chk(`${P}.expensive`, C.expensive, "Expensive (+25% crafting cost)")}
      ${chk(`${P}.cheap`, C.cheap, "Cheap (−10% crafting cost)")}
      ${chk(`${P}.simple`, C.simple, "Simple (−1 complexity)")}
    </div>
    <p class="note">Only the traditions that change price, cost or complexity are here; see <a href="${RULES_URL}#crafting-traditions-ts" target="_blank" rel="noopener">Crafting Traditions</a> for the rest.</p>
  </section>`
}

function renderSummary(it, ev) {
  const pct = (x) => Math.round(x * 100) + "%"
  const kv = (rows) => `<dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>`
  const talents = [...new Set(ev.comps.flatMap((x) => x.r.talents))]
  return `
  <div class="card">
    <div class="stat-grid">
      <div class="stat"><b>${fmt(ev.market)}</b><span>Price gp</span></div>
      <div class="stat"><b>${fmt(ev.totalCraft)}</b><span>Cost gp</span></div>
      <div class="stat"><b>${ev.cl}</b><span>CL</span></div>
    </div>
  </div>
  <div class="card">
    <h3>Price</h3>
    ${kv([
      ...ev.comps.map((x) => [esc(x.c.label || KINDS[x.c.kind].label), `${gp(x.r.price)}${x.mult !== 1 ? ` ×${x.mult}` : ""}`]),
      ...ev.steps.map(([k, v]) => [k, gp(v)]),
      ...(ev.baseCost ? [["Base object", gp(ev.baseCost)]] : []),
      ["<b>Market price</b>", `<b>${gp(ev.market)}</b>`],
    ])}
  </div>
  <div class="card">
    <h3>Crafting</h3>
    ${kv([
      ["Materials (½ price)", gp(ev.magic / 2)],
      ...(ev.craftNotes.length ? [[ev.craftNotes.join(", "), gp(ev.craft)]] : []),
      ...(ev.baseCost ? [["Base object", gp(ev.baseCost)]] : []),
      ...(ev.extraCost ? [["Other materials", gp(ev.extraCost)]] : []),
      ["<b>Total cost</b>", `<b>${gp(ev.totalCraft)}</b>`],
      ["Work time", `${ev.hours} hours`],
      ["Calendar", `${ev.days} day${ev.days > 1 ? "s" : ""} at ${Math.min(8, ev.perDay)} h/day`],
    ])}
    ${state.crafter.cheap ? `<p class="note">Cheap items sell for 90% of the usual amount.</p>` : ""}
  </div>
  <div class="card">
    <h3>Item creation check</h3>
    ${kv([...ev.dcParts.map(([k, v], n) => [k, n ? "+" + v : v]), ["<b>DC</b>", `<b>${ev.dc}</b>`]])}
    <p class="${ev.take10 ? "ok" : "warn"}">Take 10: ${ev.take10 ? "succeeds" : "fails"} (${10 + ev.bonus} vs DC ${ev.dc})</p>
    <p class="muted">Rolling: ${pct(ev.success)} success, ${pct(ev.cursed)} cursed item (fail by 5+).</p>
  </div>
  <div class="card">
    <h3>Requirements</h3>
    ${kv([
      ["Feats", esc(ev.feats.join(", ") || "—")],
      ["Spheres", esc(ev.spheres.join(", ") || "—")],
      ["Talents", esc(talents.join(", ") || "—")],
      [ev.comps.some((x) => x.r.basis === "msb") && !ev.comps.some((x) => x.r.basis === "cl") ? "MSB" : "Caster level", `${ev.cl}${ev.comps.some((x) => x.r.basis === "msb") && ev.comps.some((x) => x.r.basis === "cl") ? " (CL and MSB)" : ""}`],
    ])}
  </div>
  ${
    ev.blockers.length || ev.warnings.length
      ? `<div class="card issues">
    ${ev.blockers.map((w) => `<p class="blocker">✕ ${esc(w)}</p>`).join("")}
    ${ev.warnings.map((w) => `<p class="warn">! ${esc(w)}</p>`).join("")}
  </div>`
      : `<div class="card"><p class="ok">✓ Meets the crafting rules.</p></div>`
  }
  <p class="note">These are the book's guidelines; compare against similar items, and the GM has the final say on price.</p>`
}

// recompute and fill outputs without rebuilding inputs (keeps focus while typing)
function refresh() {
  const it = item()
  const ev = evalItem(it, state.crafter)
  const out = (k, html) => {
    const el = document.querySelector(`[data-out="${k}"]`)
    if (el) el.innerHTML = html
  }
  ev.comps.forEach((x, i) => {
    out(`price-${i}`, gp(x.r.price) + (x.mult !== 1 ? ` <span class="muted">×${x.mult}</span>` : ""))
    const foot = []
    if (x.r.complexity != null) {
      foot.push(`<b>Complexity ${fmt(x.r.complexity)}</b> = ${x.r.parts.map(([l, v], n) => `<span title="${esc(l)}">${n ? signed(v) : fmt(v)} ${esc(l.toLowerCase())}</span>`).join(" ")}`)
      ;(x.c.rows ?? []).forEach((r, j) => out(`row-${i}-${j}`, fmt(rowComplexity(r, state.crafter, x.c))))
    }
    foot.push(...x.r.lines.map(esc))
    // what the compendium says about the rows: sphere pricing rules applied, likely spell point costs
    foot.push(...(x.r.notes ?? []).map((n) => `<span class="note">${esc(n)}</span>`))
    foot.push(`Price ${esc(x.r.formula)} = <b>${gp(x.r.price)}</b>${x.r.saveDc ? ` · save DC ${x.r.saveDc}` : ""}${x.r.minCl > 1 ? ` · min CL ${x.r.minCl}` : ""}`)
    out(`foot-${i}`, foot.map((f) => `<div>${f}</div>`).join(""))
  })
  out("minCl", ev.minCl > 1 ? `min ${ev.minCl}` : "")
  out("statblock", esc(statBlock(it, ev)))
  document.getElementById("summary").innerHTML = renderSummary(it, ev)
  document.getElementById("itemLine").textContent = `${gp(ev.market)} · CL ${ev.cl} · ${aura(ev.cl)} aura · ${it.components.map((c) => KINDS[c.kind].label.toLowerCase()).join(" + ")}`
}

// ---------- events ----------

function getPath(path) {
  const parts = path.split(".")
  let o = parts[0] === "item" ? item() : state.crafter
  for (const p of parts.slice(1, -1)) o = o[p]
  return [o, parts[parts.length - 1]]
}

function onBind(e) {
  const el = e.target
  const path = el.dataset.bind
  if (!path) return
  const [o, key] = getPath(path)
  if (el.type === "checkbox") o[key] = el.checked
  else if (el.dataset.type === "num") o[key] = el.value === "" ? "" : Number(el.value)
  else o[key] = el.value
  if (el.dataset.resetPower) {
    const c = item().components[Number(el.dataset.resetPower)]
    c.power = Number(c.power)
    const bp = basePower(c)
    c.range = bp.range
    c.dur = bp.dur
  }
  if (el.tagName === "SELECT" && path.endsWith(".baseDur")) {
    const c = getPath(path)[0]
    c.dur = c.baseDur
  }
  // a talent row named after an advanced talent (or the other way round) takes that row type
  if (e.type === "change" && el.hasAttribute("data-row-name")) {
    const comp = item().components[Number(path.split(".")[2])]
    const hit = rowMatch(o, comp.sphere)
    if (hit && hit.kind !== o.kind) o.kind = hit.kind
  }
  if (path.endsWith(".charm")) {
    const c = getPath(path)[0]
    const ch = CHARMS[c.charm]
    c.bonus = Math.min(Math.max(Number(c.bonus) || ch.min, ch.min), ch.max)
    c.sphere = ch.sphere ?? "Fate"
  }
  save()
  if (e.type === "change" && el.hasAttribute("data-rerender")) renderAll()
  else refresh()
}

const panel = document.getElementById("panel")
panel.addEventListener("input", (e) => e.target.tagName !== "SELECT" && e.target.type !== "checkbox" && onBind(e))
panel.addEventListener("change", (e) => {
  if (e.target.dataset.act === "quickMod") return quickMod(e.target)
  if (e.target.dataset.act === "addOther") {
    if (e.target.value) item().components.push(blankComp(e.target.value))
    save()
    return renderAll()
  }
  if (e.target.dataset.act === "setType") return setType(e.target)
  onBind(e)
})

// switching type swaps the main effect for a blank one of the new type; consumables can't hold other kinds
function setType(el) {
  const it = item()
  const kind = el.value
  const others = it.components.slice(1)
  const dropped = KINDS[kind].consumable ? others.filter((c) => c.kind !== kind) : []
  const msg = `Switch to ${KINDS[kind].label.toLowerCase()}? The first effect will be replaced with a blank one${dropped.length ? `, and ${dropped.length} effect${dropped.length > 1 ? "s" : ""} of other kinds will be removed (${KINDS[kind].label.toLowerCase()}s can't combine with them)` : ""}.`
  const touched = it.components.length > 1 || JSON.stringify({ ...it.components[0], id: 0, label: "" }) !== JSON.stringify({ ...blankComp(it.components[0].kind), id: 0, label: "" })
  if (touched && !confirm(msg)) {
    el.value = it.type
    return
  }
  const first = blankComp(kind)
  first.label = it.components[0]?.label ?? ""
  it.type = kind
  it.components = [first, ...others.filter((c) => !dropped.includes(c))]
  save()
  renderAll()
}

function quickMod(el) {
  const c = item().components[Number(el.dataset.i)]
  const m = POWERS[c.sphere]?.mods[Number(el.value)]
  if (!m) return
  c.rows.push({ kind: "custom", name: m[0], cx: m[1], sp: 0, variant: false, has: true })
  save()
  renderAll()
}

panel.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]")
  if (!b || b.tagName === "SELECT") return
  const it = item()
  const i = Number(b.dataset.i)
  const c = it.components[i]
  switch (b.dataset.act) {
    case "addComp":
      it.components.push(blankComp(b.dataset.kind))
      break
    case "delComp":
      if (it.components.length === 1) return toast("An item needs at least one effect.")
      it.components.splice(i, 1)
      break
    case "moveComp": {
      const to = i + Number(b.dataset.dir)
      if (to < 0 || to >= it.components.length) return
      ;[it.components[i], it.components[to]] = [it.components[to], it.components[i]]
      break
    }
    case "addRow":
      c.rows.push({ kind: b.dataset.kind, name: "", sp: 0, cx: 1, variant: false, has: true })
      break
    case "delRow":
      c.rows.splice(Number(b.dataset.j), 1)
      break
    case "addItem":
      c[b.dataset.list].push(b.dataset.list === "extraSpheres" ? { name: "Destruction" } : b.dataset.list === "talents" ? { name: "", has: true } : { name: "", bonus: 1, gp: 0 })
      break
    case "delItem":
      c[b.dataset.list].splice(Number(b.dataset.j), 1)
      break
    case "copy":
      return copyStatBlock()
    default:
      return
  }
  save()
  renderAll()
})

function copyStatBlock() {
  const text = statBlock(item(), evalItem(item(), state.crafter))
  navigator.clipboard?.writeText(text).then(
    () => toast("Stat block copied"),
    () => toast("Couldn't reach the clipboard; select the text and copy it instead."),
  )
}

let toastTimer
function toast(msg) {
  const t = document.getElementById("toast")
  t.textContent = msg
  t.hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (t.hidden = true), 2500)
}

document.getElementById("itemName").addEventListener("input", (e) => {
  item().name = e.target.value
  save()
  const opt = document.querySelector(`#library option[value="${item().id}"]`)
  if (opt) opt.textContent = e.target.value || "Unnamed item"
  refresh()
})
document.getElementById("library").addEventListener("change", (e) => {
  state.activeId = e.target.value
  save()
  renderAll()
})
document.getElementById("btnNew").addEventListener("click", () => {
  const it = blankItem()
  state.items.push(it)
  state.activeId = it.id
  save()
  renderAll()
  document.getElementById("itemName").focus()
})
document.getElementById("btnDup").addEventListener("click", () => {
  const it = JSON.parse(JSON.stringify(item()))
  it.id = uid()
  it.name = (it.name || "Unnamed item") + " (copy)"
  state.items.push(it)
  state.activeId = it.id
  save()
  renderAll()
})
document.getElementById("btnDel").addEventListener("click", () => {
  const it = item()
  if (!confirm(`Delete "${it.name || "Unnamed item"}"? This can't be undone.`)) return
  state.items = state.items.filter((x) => x.id !== it.id)
  if (!state.items.length) state.items.push(blankItem())
  state.activeId = state.items[0].id
  save()
  renderAll()
})
document.getElementById("btnExport").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ format: "sop-item-crafter", version: 1, items: state.items, crafter: state.crafter }, null, 2)], { type: "application/json" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = "sop-items.json"
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
})
document.getElementById("fileLoad").addEventListener("change", async (e) => {
  const f = e.target.files[0]
  e.target.value = ""
  if (!f) return
  try {
    const data = JSON.parse(await f.text())
    const items = data.items ?? (data.components ? [data] : null)
    if (!items?.length) throw new Error("no items")
    const ids = new Set(state.items.map((x) => x.id))
    for (const it of items) {
      if (ids.has(it.id)) it.id = uid()
      state.items.push({ ...blankItem(), type: it.components?.[0]?.kind ?? "marvelous", ...it })
    }
    state.activeId = state.items[state.items.length - 1].id
    save()
    renderAll()
    toast(`Imported ${items.length} item${items.length > 1 ? "s" : ""}`)
  } catch {
    toast("That file isn't an item crafter export.")
  }
})

// ---------- loot generator (compounds, scrolls and spell engines) ----------
// Random consumables put together from the same parts as a hand-built one: a base sphere, one of
// its base powers, and a few of that sphere's talents from the compendium, then priced by the
// rules above. A first pass at loot generation: the picks are random, so read the result (and the
// talents' spell point costs, which are guessed from their text) before handing it out.
//
// which talent tags fit each base power (others are still possible, just less likely)
const POWER_TAGS = {
  "Alteration:0": ["transformation", "body"], "Bear:0": ["bearacteristic"], "Blood:0": ["quicken", "still", "blood art"],
  "Conjuration:0": ["form"], "Creation:0": ["alter"], "Creation:1": ["material"], "Dark:0": ["darkness", "shadow", "blot"],
  "Death:0": ["ghost strike"], "Destruction:0": ["blast type", "blast shape"], "Divination:0": ["divine"], "Divination:1": ["sense"],
  "Enhancement:0": ["enhance"], "Fallen Fey:0": ["fey-blessing"], "Fate:0": ["consecration", "word", "motif"], "Illusion:0": ["glamer", "sensory"],
  "Life:0": ["cure"], "Life:2": ["vitality"], "Light:0": ["light", "lens", "nimbus"], "Mana:0": ["expunge"], "Mana:1": ["manipulation"], "Mind:0": ["charm"],
  "Nature:0": ["geomancing", "spirit"], "Protection:0": ["aegis", "succor"], "Protection:1": ["ward", "succor"], "Time:0": ["time"],
  "War:0": ["totem", "rally", "momentum"], "Warp:0": ["space"], "Weather:0": ["precipitation", "cold", "heat", "wind", "aridity", "storm"],
}
const LOOT = { kind: "all", count: 5, clMin: 1, clMax: 10, talents: 2, sphere: "", results: [] }
const rnd = (n) => Math.floor(Math.random() * n)
const pick = (list) => list[rnd(list.length)]
function weightedPick(list, weight) {
  const total = list.reduce((s, x) => s + weight(x), 0)
  let roll = Math.random() * total
  for (const x of list) if ((roll -= weight(x)) <= 0) return x
  return list[list.length - 1]
}
// the spell points a talent adds to an effect, guessed from its summary ("spend an additional spell point")
function guessSp(e) {
  const t = (e.summary || "").toLowerCase()
  const m = t.match(/spend(?:ing)? (?:an additional |an extra |a |one |1 |two |2 )?(two|2)? ?(?:additional |extra )?spell points?/)
  return m ? (m[1] || / (two|2) /.test(m[0]) ? 2 : 1) : 0
}

// a spell engine (a wand, in base Pathfinder terms): a sphere at an even caster level, with talents
// and extra spell points filling the slots its caster level allows
function generateEngine(opts) {
  const sphere = opts.sphere || pick(Object.keys(POWERS))
  const c = blankComp("engine")
  c.sphere = sphere
  const it = { ...blankItem(), type: "engine", components: [c], slot: "slotless", generated: true }
  const lo = Math.max(2, Number(opts.clMin) || 2), hi = Math.min(20, Math.max(lo, Number(opts.clMax) || lo))
  it.cl = Math.max(2, 2 * Math.floor((lo + rnd(hi - lo + 1)) / 2))
  const slots = Math.max(0, it.cl / 2 - 1)
  const pool = COMPENDIUM.entries.filter((e) => e.sphere === sphere && e.kind === "talent" && e.status !== "retired")
  const n = Math.min(slots, pool.length, rnd(Number(opts.talents) + 1))
  const names = new Set()
  for (let i = 0; i < n; i++) {
    const e = pick(pool.filter((x) => !names.has(x.name)))
    names.add(e.name)
    c.talents.push({ name: e.name, has: true })
  }
  // some of the slots left over go to extra spell points
  c.extraSp = rnd(Math.min(3, slots - n) + 1)
  it.name = `${sphere} Spell Engine${c.talents.length ? ` (${c.talents[0].name}${c.talents.length > 1 ? ", …" : ""})` : ""}`
  const ev = evalItem(it, state.crafter)
  it.description = `A spell engine of the ${sphere} sphere at caster level ${it.cl}${c.talents.length ? `, with ${c.talents.map((x) => x.name).join(", ")}` : ""}. Spell point pool ${1 + c.extraSp}; save DC ${10 + Math.floor(it.cl / 2)}.`
  return { it, ev, sphere, powerName: "spell engine", talents: c.talents.map((x) => x.name) }
}

function generateLootItem(opts) {
  const kind = opts.kind === "either" ? pick(["compound", "scroll"]) : opts.kind === "all" ? pick(["compound", "scroll", "engine"]) : opts.kind
  if (kind === "engine") return generateEngine(opts)
  const sphere = opts.sphere || pick(Object.keys(POWERS))
  const power = rnd(POWERS[sphere].powers.length)
  const c = blankComp(kind)
  const bp = { range: POWERS[sphere].powers[power][1], dur: POWERS[sphere].powers[power][2] }
  Object.assign(c, { sphere, power, baseRange: bp.range, baseDur: bp.dur, range: bp.range, dur: bp.dur, activation: "standard", rows: [] })
  // a scroll sometimes reaches further or lasts longer than the base power
  if (kind === "scroll" && bp.range < RANGES.length - 1 && Math.random() < 0.25) c.range = bp.range + 1
  if (isStep(bp.dur) && bp.dur !== "h" && Math.random() < (kind === "scroll" ? 0.25 : 0.15)) c.dur = DUR_STEPS[DUR_STEPS.indexOf(bp.dur) + 1]
  // talents: those tagged for this power first, untagged ones next, one per tag
  const want = POWER_TAGS[`${sphere}:${power}`] ?? []
  const pool = COMPENDIUM.entries.filter((e) => e.sphere === sphere && e.kind === "talent" && e.status !== "retired")
  const tagsOf = (e) => (e.tags ?? []).map((t) => String(t).toLowerCase())
  // ...and those whose text is about this base power rather than the sphere's other one (a restore
  // talent on a Restore item, not on a Cure)
  const keyOf = (p) => p[0].split(/[ (]/)[0].toLowerCase()
  const mine = keyOf(POWERS[sphere].powers[power])
  const others = POWERS[sphere].powers.filter((_, k) => k !== power).map(keyOf).filter((k) => k !== mine)
  const about = (e) => `${e.name} ${e.summary ?? ""}`.toLowerCase()
  const fit = (e) => (about(e).includes(mine) ? 4 : others.some((k) => about(e).includes(k)) ? 0.15 : 1)
  const weight = (e) => (tagsOf(e).some((t) => want.includes(t)) ? 6 : tagsOf(e).length ? 0.4 : 1) * fit(e)
  const used = new Set(), names = new Set()
  const n = Math.min(pool.length, rnd(Number(opts.talents) + 1))
  for (let i = 0; i < n; i++) {
    const open = pool.filter((e) => !names.has(e.name) && !tagsOf(e).some((t) => used.has(t)))
    if (!open.length) break
    const e = weightedPick(open, weight)
    names.add(e.name)
    for (const t of tagsOf(e)) used.add(t)
    c.rows.push({ kind: "talent", name: e.name, sp: guessSp(e), cx: 1, variant: false, has: true })
  }
  if (kind === "compound") c.form = c.range >= 2 ? "powder" : c.range === 1 && Math.random() < 0.35 ? "oil" : "potion"
  const it = { ...blankItem(), type: kind, components: [c], slot: "slotless", generated: true }
  // caster level: in the asked range, and never below the effect's complexity
  const lo = Math.max(1, Number(opts.clMin) || 1), hi = Math.max(lo, Number(opts.clMax) || lo)
  it.cl = lo + rnd(hi - lo + 1)
  const cx = evalComp(c, it, state.crafter).complexity
  if (it.cl < cx) it.cl = Math.ceil(cx)
  const powerName = POWERS[sphere].powers[power][0]
  const lead = c.rows[0]?.name ?? powerName
  const form = kind === "scroll" ? "Scroll" : COMPOUND_FORMS[c.form]
  it.name = `${form} of ${lead}${c.rows.length > 1 ? ` and ${c.rows[1].name}` : ""}`
  const ev = evalItem(it, state.crafter)
  const r = ev.comps[0].r
  it.description = `${kind === "scroll" ? "A scroll holding" : `A ${COMPOUND_FORMS[c.form].toLowerCase()} carrying`} the ${sphere} sphere's ${powerName.toLowerCase()}${c.rows.length ? `, with ${c.rows.map((x) => x.name).join(", ")}` : ""}. Caster level ${it.cl}; range ${r.range.toLowerCase()}; duration ${String(r.duration).toLowerCase()}${r.saveDc ? `; save DC ${r.saveDc}` : ""}.`
  return { it, ev, sphere, powerName, talents: c.rows.map((x) => x.name + (x.sp ? ` (${x.sp} SP)` : "")) }
}

function lootLine(x) {
  return `${x.it.name} (CL ${x.it.cl}; ${x.sphere}: ${x.powerName}${x.talents.length ? ` + ${x.talents.join(", ")}` : ""}; ${gp(x.ev.market)})`
}

function openLootDialog() {
  document.querySelector("dialog.loot")?.remove()
  const dlg = document.createElement("dialog")
  dlg.className = "picker wide loot"
  const opt = (v, label, cur) => `<option value="${esc(v)}" ${String(v) === String(cur) ? "selected" : ""}>${esc(label)}</option>`
  const draw = () => {
    const total = LOOT.results.reduce((s, x) => s + x.ev.market, 0)
    dlg.innerHTML = `
      <div class="picker-head"><h3>Generate loot</h3><button type="button" class="small ghost" data-loot="close" aria-label="Close">✕</button></div>
      <p class="note">Random compounds, scrolls and spell engines. A compound or scroll is built from a sphere's base power and a few of its talents; a spell engine from a sphere, an even caster level, and talents and spell points up to its slots. All are priced like any other item here. The picks are random and the talents' spell point costs are guessed from their text, so check an item before using it: add it to your items to edit it.</p>
      <div class="row">
        ${field("Kind", `<select data-loot-opt="kind">${opt("all", "Compounds, scrolls and spell engines", LOOT.kind)}${opt("either", "Compounds and scrolls", LOOT.kind)}${opt("compound", "Compounds (potions, oils, powders)", LOOT.kind)}${opt("scroll", "Scrolls", LOOT.kind)}${opt("engine", "Spell engines (wands)", LOOT.kind)}</select>`)}
        ${field("How many", `<input type="number" min="1" max="30" data-loot-opt="count" value="${LOOT.count}" style="width:5rem" />`)}
        ${field("Caster level from", `<input type="number" min="1" max="30" data-loot-opt="clMin" value="${LOOT.clMin}" style="width:5rem" />`)}
        ${field("to", `<input type="number" min="1" max="30" data-loot-opt="clMax" value="${LOOT.clMax}" style="width:5rem" />`)}
        ${field("Talents each (up to)", `<input type="number" min="0" max="5" data-loot-opt="talents" value="${LOOT.talents}" style="width:5rem" />`)}
        ${field("Sphere", `<select data-loot-opt="sphere">${opt("", "Any sphere", LOOT.sphere)}${Object.keys(POWERS).map((s) => opt(s, s, LOOT.sphere)).join("")}</select>`)}
      </div>
      <div class="row add-row">
        <button type="button" class="primary" data-loot="roll">${LOOT.results.length ? "Roll again" : "Generate"}</button>
        ${LOOT.results.length ? `<button type="button" data-loot="addAll">Add all to my items</button><button type="button" data-loot="copy">Copy the list</button><span class="muted">${LOOT.results.length} items, ${gp(total)} in all</span>` : ""}
      </div>
      <div class="picker-results">
        ${LOOT.results.map((x, i) => {
          return `<div class="picker-item" style="cursor:default">
            <span class="pi-name">${esc(x.it.name)} <span class="pi-meta">CL ${x.it.cl} · ${gp(x.ev.market)} · ${esc(x.sphere)}: ${esc(x.powerName)}${x.talents.length ? ` + ${esc(x.talents.join(", "))}` : ""}</span></span>
            <span class="pi-pre">${esc(x.it.description)}${x.ev.comps[0].r.warnings.length ? ` <b>Check:</b> ${esc(x.ev.comps[0].r.warnings.join(" "))}` : ""}</span>
            <span class="row" style="margin-top:.3rem"><button type="button" class="small" data-loot="add" data-i="${i}">${x.added ? "Added" : "Add to my items"}</button><button type="button" class="small ghost" data-loot="reroll" data-i="${i}">Reroll</button></span>
          </div>`
        }).join("")}
        ${COMPENDIUM.loaded ? "" : `<p class="muted">The talents are still loading; items generated now have none.</p>`}
      </div>`
  }
  const addItem = (x) => {
    if (x.added) return
    const { generated, ...it } = x.it
    state.items.push({ ...it, id: uid() })
    state.activeId = state.items[state.items.length - 1].id
    x.added = true
  }
  dlg.addEventListener("change", (e) => {
    const k = e.target.dataset.lootOpt
    if (k) LOOT[k] = e.target.type === "number" ? Number(e.target.value) || 0 : e.target.value
  })
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) return dlg.close()
    const b = e.target.closest("[data-loot]")
    if (!b) return
    const i = Number(b.dataset.i)
    switch (b.dataset.loot) {
      case "close": return dlg.close()
      case "roll":
        LOOT.results = Array.from({ length: Math.min(30, Math.max(1, LOOT.count)) }, () => generateLootItem(LOOT))
        break
      case "reroll":
        LOOT.results[i] = generateLootItem(LOOT)
        break
      case "add":
        addItem(LOOT.results[i])
        save()
        renderAll()
        toast(`Added ${LOOT.results[i].it.name}`)
        break
      case "addAll":
        LOOT.results.forEach(addItem)
        save()
        renderAll()
        toast(`Added ${LOOT.results.length} items`)
        break
      case "copy":
        navigator.clipboard?.writeText(LOOT.results.map(lootLine).join("\n")).then(() => toast("Copied the list"), () => toast("Couldn't copy"))
        return
    }
    draw()
  })
  dlg.addEventListener("close", () => dlg.remove())
  document.body.append(dlg)
  draw()
  dlg.showModal()
}
document.getElementById("btnLoot").addEventListener("click", openLootDialog)

// follow the wiki's dark-mode toggle when embedded on the site
function applyTheme(theme) {
  if (theme === "dark" || theme === "light") document.documentElement.dataset.theme = theme
}
try {
  window.parent?.document?.addEventListener("themechange", (e) => applyTheme(e.detail?.theme))
} catch {}
window.addEventListener("storage", (e) => e.key === "theme" && applyTheme(e.newValue))

renderAll()
loadCompendium()
