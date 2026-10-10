// Loot Generator: a treasure pile built to a budget (by challenge rating or a gold range) and a
// theme, from the Core Rulebook's treasure tables (compendium/loot-tables.json, from Archives of
// Nethys), the wiki's Spheres loot tables (loot-tables-spheres.json) and the priced items in the
// gear compendium. Coins, gems, valuables, mundane gear and magic items; Pathfinder and Spheres
// items mixed by default, with the Spheres versions swapped in on request.
"use strict"

const STORAGE_KEY = "sop-loot-generator"
const $ = (id) => document.getElementById(id)
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch])
const gp = (n) => (Math.round(n * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 }) + " gp"
const rnd = (n) => Math.floor(Math.random() * n)
const pick = (list) => list[rnd(list.length)]
const between = (lo, hi) => lo + Math.random() * (hi - lo)
const norm = (s) => String(s ?? "").toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9+']+/g, " ").trim()
function weighted(weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0)
  let roll = Math.random() * entries.reduce((s, [, w]) => s + w, 0)
  for (const [k, w] of entries) if ((roll -= w) <= 0) return k
  return entries[entries.length - 1]?.[0]
}

// ---------- themes ----------
// shares: how the budget splits; kinds: which magic items turn up (null = the Core Rulebook's own
// Table 15-2); mundane: which ordinary goods; coins: the mix of copper / silver / gold / platinum
const THEMES = {
  hoard: { label: "General hoard", note: "A bit of everything, as the Core Rulebook's random tables give it.",
    shares: { coins: 0.25, gems: 0.1, valuables: 0.1, mundane: 0.05, magic: 0.5 }, kinds: null,
    mundane: { weapon: 3, armor: 2, gear: 4, alchemical: 1 }, coins: { cp: 1, sp: 3, gp: 5, pp: 1 } },
  armory: { label: "Armory", note: "Weapons, armor, shields and ammunition, mundane and magical; little coin.",
    shares: { coins: 0.05, gems: 0, valuables: 0, mundane: 0.35, magic: 0.6 }, kinds: { armor: 42, weapon: 46, potion: 6, wondrous: 6 },
    mundane: { weapon: 6, armor: 4, shield: 2, ammo: 3 }, coins: { sp: 2, gp: 6 } },
  treasury: { label: "Treasury or vault", note: "Coin, gems, jewelry and art; the odd magic item kept for its worth.",
    shares: { coins: 0.55, gems: 0.2, valuables: 0.2, mundane: 0, magic: 0.05 }, kinds: { ring: 30, wondrous: 50, rod: 10, staff: 10 },
    mundane: {}, coins: { sp: 1, gp: 7, pp: 3 } },
  tomb: { label: "Tomb or crypt", note: "Grave goods: jewelry, art, old arms and the magic buried with the dead. Sometimes a cursed piece.",
    shares: { coins: 0.15, gems: 0.15, valuables: 0.3, mundane: 0.05, magic: 0.35 },
    kinds: { armor: 12, weapon: 16, ring: 15, wondrous: 30, scroll: 12, staff: 5, rod: 5, potion: 5 }, cursed: 0.2,
    mundane: { weapon: 3, armor: 2, gear: 1 }, coins: { cp: 2, sp: 3, gp: 4, pp: 1 } },
  laboratory: { label: "Wizard's study or laboratory", note: "Scrolls, wands, potions, staves and rods, with tools and alchemical supplies.",
    shares: { coins: 0.05, gems: 0.05, valuables: 0.05, mundane: 0.15, magic: 0.7 },
    kinds: { scroll: 34, wand: 20, potion: 15, staff: 8, rod: 7, wondrous: 13, ring: 3 }, spells: "arcane",
    mundane: { alchemical: 5, tools: 3, gear: 1 }, coins: { sp: 1, gp: 5, pp: 1 } },
  temple: { label: "Temple or shrine", note: "Offerings and sacred treasures: jewelry and art, divine scrolls, healing potions and wands.",
    shares: { coins: 0.2, gems: 0.1, valuables: 0.25, mundane: 0.05, magic: 0.4 },
    kinds: { potion: 30, scroll: 25, wand: 15, wondrous: 15, armor: 5, weapon: 5, staff: 3, ring: 2 }, spells: "divine",
    mundane: { gear: 2, tools: 1 }, coins: { cp: 3, sp: 4, gp: 4 } },
  apothecary: { label: "Apothecary or alchemist", note: "Potions and alchemical goods, with the tools of the trade.",
    shares: { coins: 0.1, gems: 0, valuables: 0, mundane: 0.3, magic: 0.6 }, kinds: { potion: 85, wondrous: 10, scroll: 5 },
    mundane: { alchemical: 8, tools: 2 }, coins: { sp: 3, gp: 5 } },
  lair: { label: "Monster lair", note: "What past victims carried: loose coin, a few valuables, battered gear and the occasional prize.",
    shares: { coins: 0.45, gems: 0.1, valuables: 0.1, mundane: 0.15, magic: 0.2 }, kinds: null,
    mundane: { weapon: 3, armor: 2, gear: 5 }, coins: { cp: 5, sp: 5, gp: 3 } },
  merchant: { label: "Merchant's stock or caravan", note: "Trade goods and everyday gear, a strongbox, and little magic.",
    shares: { coins: 0.3, gems: 0.05, valuables: 0.15, mundane: 0.4, magic: 0.1 }, kinds: { potion: 40, wondrous: 40, scroll: 10, wand: 10 },
    mundane: { gear: 6, tools: 3, clothing: 3, weapon: 1, alchemical: 1 }, coins: { cp: 2, sp: 5, gp: 5, pp: 1 } },
}
const KIND_OF_ROW = { "Armor and shields": "armor", Weapons: "weapon", Potions: "potion", Rings: "ring", Rods: "rod", Scrolls: "scroll", Staves: "staff", Wands: "wand", "Wondrous items": "wondrous" }
const KIND_LABEL = { armor: "Armor or shield", weapon: "Weapon", potion: "Potion", ring: "Ring", rod: "Rod", scroll: "Scroll", staff: "Staff", wand: "Wand", wondrous: "Wondrous item" }
// which compendium groups hold each kind, by system
const PF_SUBS = { armor: ["Specific armor", "Specific shields"], weapon: ["Specific weapons"], ring: ["Rings"], rod: ["Rods", "Rods (metamagic)"], staff: ["Staves"],
  wondrous: (sub) => /^Wondrous/.test(sub) }
const SP_SUBS = { armor: ["Specific armor and shields"], weapon: ["Specific weapons"], ring: ["Charms (rings)"], rod: ["Apparatuses (rods)"], staff: ["Implements (staves)"],
  wand: ["Spell engines (wands)"], wondrous: ["Marvelous items"] }
const SP_KIND_LABEL = { ring: "Charm", rod: "Apparatus", staff: "Implement", wand: "Spell engine", wondrous: "Marvelous item", potion: "Compound", scroll: "Scroll", armor: "Armor or shield", weapon: "Weapon" }
const MUNDANE_SUBS = { gear: ["Adventuring Gear", "Kits"], alchemical: ["Alchemical Tools", "Alchemical Weapons", "Alchemical Remedies", "Alchemical Items"], tools: ["Tools"],
  clothing: ["Clothing", "Entertainment"] }
// a Pathfinder item's obvious Spheres counterpart (the Spheres of Power box): name pattern -> the Spheres name
const SPHERES_SWAPS = [
  [/^Belt of Giant Strength/i, "Belt of Wild Might"], [/^Belt of Incredible Dexterity/i, "Belt of Avian Speed"], [/^Belt of Mighty Constitution/i, "Belt of Mountains"],
  [/^Headband of Vast Intelligence/i, "Headband of Genius"], [/^Headband of Inspired Wisdom/i, "Headband of Sages"], [/^Headband of Alluring Charisma/i, "Headband of Alluring Magnetism"],
  [/^Cloak of Resistance/i, "Cape of Resistance"], [/^Ring of Protection/i, "Aegis Ring"], [/^Amulet of Natural Armor/i, "Necklace of Natural Armor"],
]
// what valuables look like (the Core Rulebook gives the grades and values; the descriptions are ours)
const VALUABLE_LOOKS = {
  "Jewelry, Minor": [["copper", "brass", "bronze", "ivory", "carved wood"], ["ring", "bracelet", "pair of earrings", "hairpin"]],
  "Jewelry, Normal": [["silver", "gold", "jade", "coral"], ["armband", "necklace", "brooch", "ring", "bracelet", "pendant"]],
  "Jewelry, Precious": [["gem-set gold", "platinum", "gem-set platinum", "pearl-strung gold"], ["circlet", "necklace", "signet ring", "tiara", "torc", "scepter"]],
  "Fine Artwork": [["an oil", "a small marble", "a woven", "an illuminated", "a porcelain", "a carved jade", "a gilded"], ["painting", "statuette", "tapestry", "manuscript", "vase", "idol", "reliquary"]],
  "Masterwork Tools": [["a set of masterwork", "a case of masterwork"], ["thieves' tools", "artisan's tools", "healer's instruments", "jeweler's tools", "surgeon's tools"]],
}

// the everyday arms a "+1" turns up on (and most of what an armory racks): the Core Rulebook's
const COMMON_WEAPONS = new Set(["longsword", "short sword", "greatsword", "dagger", "rapier", "scimitar", "battleaxe", "greataxe", "warhammer", "heavy mace", "light mace",
  "morningstar", "spear", "longspear", "shortspear", "glaive", "halberd", "longbow", "shortbow", "composite longbow", "composite shortbow", "light crossbow", "heavy crossbow",
  "quarterstaff", "falchion", "flail", "heavy flail", "lance", "trident", "handaxe", "kukri", "sickle", "club", "greatclub", "bastard sword", "dwarven waraxe", "whip", "sling",
  "javelin", "guisarme", "ranseur", "scythe", "light hammer", "light pick", "heavy pick", "sap", "starknife", "earth breaker", "throwing axe", "punching dagger"])
const COMMON_ARMOR = new Set(["padded", "leather", "studded leather", "chain shirt", "hide", "scale mail", "chainmail", "breastplate", "splint mail", "banded mail", "half-plate",
  "full plate", "buckler", "light wooden", "light steel", "heavy wooden", "heavy steel", "tower"])
const common = (pool, names) => { const hits = pool.filter((e) => names.has(norm(e.name))); return hits.length ? hits : pool }
const shieldName = (e) => (/shield|buckler|klar|madu/i.test(e.name) ? e.name : `${e.name} shield`)

// ---------- data ----------
const DATA = { ready: false, tables: null, spheres: null, magic: [], weapon: [], armor: [], shield: [], gear: [], ammo: [], consumable: [], spells: [] }
async function loadData() {
  const get = (f, empty) => fetch(`../compendium/${f}`).then((r) => (r.ok ? r.json() : empty)).catch(() => empty)
  const list = (d) => (Array.isArray(d) ? d : d?.entries ?? [])
  const priced = (d) => list(d).map((e) => ({ ...e, price: Number(e.price) || 0 })).filter((e) => e.price > 0 || e.sub === "Cursed items")
  const [tables, spheres, magic, weapon, armor, shield, gear, ammo, consumable, spells] = await Promise.all([
    get("loot-tables.json", null), get("loot-tables-spheres.json", { bands: [], compounds: [] }), get("gear-index-magic.json", []), get("gear-index-weapon.json", []),
    get("gear-index-armor.json", []), get("gear-index-shield.json", []), get("gear-index-gear.json", []), get("gear-index-ammo.json", []),
    get("gear-index-consumable.json", []), get("spells-index.json", [])])
  Object.assign(DATA, { tables, spheres, magic: priced(magic), weapon: priced(weapon).filter((e) => e.sub === "Weapon"), armor: priced(armor), shield: priced(shield),
    gear: priced(gear), ammo: priced(ammo), consumable: priced(consumable), spells: list(spells).filter((e) => e.mythic !== "True" && e.levels), ready: !!tables })
  render()
}
const isPf = (e) => e.system === "Pathfinder 1e"
const link = (e) => (e?.url ? (/^https?:/.test(e.url) ? e.url : `../../${e.url}`) : "")

// ---------- the pieces ----------
// an item from a priced pool that fits what's left: one that uses a fair share of it when there is one
function fromPool(pool, cap) {
  const fits = pool.filter((e) => e.price > 0 && e.price <= cap)
  if (!fits.length) return null
  const solid = fits.filter((e) => e.price >= cap * 0.2)
  return pick(solid.length >= 3 || (solid.length && Math.random() < 0.7) ? solid : fits)
}
const gradeFor = (cap) => (cap < 4000 ? "minor" : cap < 25000 ? "medium" : "major")
function rollRow(rows, grade) {
  const live = rows.filter((r) => r[grade])
  const roll = 1 + rnd(100)
  return live.find((r) => roll >= r[grade][0] && roll <= r[grade][1]) ?? pick(live)
}
function spellLevel(sp, kind) {
  const L = sp.levels
  const arcane = L.Wizard ?? L.Sorcerer ?? L.Magus ?? L.Bard, divine = L.Cleric ?? L.Druid ?? L.Paladin ?? L.Ranger
  return kind === "arcane" ? arcane : kind === "divine" ? divine : Math.min(arcane ?? 99, divine ?? 99)
}
// a potion, scroll or wand made from a spell: the spell level by the Core Rulebook's table, priced by level x caster level
function spellItem(kind, cap, theme) {
  const cfg = { potion: ["potions", 50, 25, "Potion"], scroll: ["scrolls", 25, 12.5, "Scroll"], wand: ["wands", 750, 375, "Wand"] }[kind]
  const rows = DATA.tables[cfg[0]].map((r) => ({ ...r, price: r.level ? cfg[1] * r.level * r.cl : cfg[2] })).filter((r) => r.price <= cap)
  if (!rows.length) return null
  const grade = gradeFor(cap * (kind === "wand" ? 1 : 8))
  let row = rollRow(rows.filter((r) => r[grade]).length ? rows.filter((r) => r[grade]) : rows, grade)
  if (!row || row.price > cap) row = rows[rows.length - 1]
  const side = kind === "potion" ? "any" : theme.spells ?? pick(["arcane", "arcane", "divine"])
  // a potion holds a spell that targets a creature: the touch spells (failing that, anything but a personal one)
  const atLevel = DATA.spells.filter((sp) => spellLevel(sp, side) === row.level)
  const touch = atLevel.filter((sp) => /^touch/i.test(sp.range ?? ""))
  const spells = kind !== "potion" ? atLevel : touch.length ? touch : atLevel.filter((sp) => !/^personal/i.test(sp.range ?? ""))
  if (!spells.length) return null
  const sp = pick(spells)
  return { kind, name: `${cfg[3]} of ${sp.name}`, value: row.price, system: "Pathfinder", url: sp.url,
    note: `${kind === "scroll" ? (side === "divine" ? "divine" : "arcane") + ", " : ""}spell level ${row.level}, CL ${row.cl}${kind === "wand" ? ", 50 charges" : ""}` }
}
// "+2 longsword" / "+1 breastplate": a bonus row from the Core Rulebook's table on a mundane item
function enhancedItem(kind, cap) {
  const rows = (kind === "armor" ? DATA.tables.armor : DATA.tables.weapons).filter((r) => /^\+\d/.test(r.item) && r.price + 150 <= cap)
  if (!rows.length) return null
  const row = rows[Math.max(0, rows.length - 1 - rnd(2))]
  const shield = /shield/.test(row.item)
  const base = fromPool(kind === "weapon" ? common(DATA.weapon, COMMON_WEAPONS) : common(shield ? DATA.shield : DATA.armor, COMMON_ARMOR), Math.max(1, cap - row.price - (kind === "weapon" ? 300 : 150)))
  if (!base) return null
  return { kind, name: `${row.item.match(/^\+\d/)[0]} ${(shield ? shieldName(base) : base.name).toLowerCase()}`, value: row.price + base.price + (kind === "weapon" ? 300 : 150), system: "Pathfinder", url: base.url,
    note: "enhancement bonus on a masterwork item" }
}
const subMatch = (subs, e) => (typeof subs === "function" ? subs(e.sub ?? "") : (subs ?? []).includes(e.sub))
function pathfinderItem(kind, cap, theme) {
  if (kind === "potion" || kind === "scroll" || kind === "wand") return spellItem(kind, cap, theme)
  if ((kind === "armor" || kind === "weapon") && Math.random() < 0.6) { const e = enhancedItem(kind, cap); if (e) return e }
  const e = fromPool(DATA.magic.filter((x) => isPf(x) && subMatch(PF_SUBS[kind], x)), cap)
  return e ? { kind, name: e.name, value: e.price, system: "Pathfinder", url: e.url, note: e.sub } : enhancedItem(kind, cap)
}
// the wiki's own tables: a compound from the tier table for the level, or an item from the price band the budget reaches
function spheresTableItem(kind, cap, level) {
  if (kind === "potion") {
    const tier = DATA.spheres.compounds.find((t) => t.tier === Math.min(5, Math.max(1, Math.ceil(level / 4)))) ?? DATA.spheres.compounds[0]
    const e = tier && fromPool(tier.entries.filter((x) => x.price > 0), cap)
    return e ? { kind, name: e.name, value: e.price, system: "Spheres", url: `../../${tier.url}`, note: `Compound, ${tier.title.replace("Table: ", "")}` } : null
  }
  const band = [...DATA.spheres.bands].reverse().find((b) => b.min > 0 || b.max > 0 ? b.min <= cap && b.name !== "Artifacts" : false) ?? DATA.spheres.bands[0]
  if (!band) return null
  const entries = band.entries.filter((x) => !/^reroll$/i.test(x.name) && (kind === "any" || norm(x.type).includes({ ring: "charm", rod: "apparatus", staff: "implement", wand: "spell engine", wondrous: "marvelous", weapon: "weapon", armor: "armor", scroll: "scroll" }[kind] ?? "~")))
  if (!entries.length) return null
  const x = pick(entries)
  // its price when the compendium has the item; otherwise somewhere in the band
  const known = DATA.magic.concat(DATA.consumable).find((e) => !isPf(e) && e.price > 0 && norm(e.name) === norm(x.name.replace(/\s*\+\d+$/, "")))
  const value = known && known.price <= cap ? known.price : Math.round(between(Math.max(band.min, cap * 0.2), Math.min(band.max || cap, cap)) / 50) * 50
  return value > 0 && value <= cap ? { kind, name: x.name, value, system: "Spheres", url: known ? link(known) : `../../${band.url}`,
    note: `${x.type || "Spheres item"}, ${band.title.replace("Table: ", "")}${known && known.price <= cap ? "" : " (value estimated)"}` } : null
}
function spheresItem(kind, cap, level) {
  if (kind === "potion" || Math.random() < 0.35) { const t = spheresTableItem(kind, cap, level); if (t) return t }
  if (kind === "scroll") { const e = fromPool(DATA.consumable.filter((x) => !isPf(x) && x.sub === "Scrolls"), cap); if (e) return { kind, name: e.name, value: e.price, system: "Spheres", url: link(e), note: "Scroll" } }
  const e = fromPool(DATA.magic.filter((x) => !isPf(x) && subMatch(SP_SUBS[kind], x)), cap)
  return e ? { kind, name: e.name, value: e.price, system: "Spheres", url: link(e), note: e.sub } : spheresTableItem(kind, cap, level)
}
// a Pathfinder pick's Spheres version, when the Spheres of Power box is ticked and there is an obvious one
function spheresVersion(item, cap, level) {
  if (item.kind === "potion" || item.kind === "wand") {
    const e = spheresItem(item.kind, Math.max(item.value, Math.min(cap, item.value * 1.5)), level)
    return e ? { ...e, note: `${e.note}; in place of ${item.name.toLowerCase()}` } : item
  }
  const swap = SPHERES_SWAPS.find(([re]) => re.test(item.name))
  if (!swap) return item
  const hit = DATA.magic.find((e) => !isPf(e) && norm(e.name) === norm(swap[1]))
  return { ...item, name: `${swap[1]}${(item.name.match(/\s\+\d+$/) ?? [""])[0]}`, system: "Spheres", url: hit ? link(hit) : item.url, note: `Charm; the Spheres version of ${item.name}` }
}

function magicItems(budget, theme, opts, level) {
  const out = []
  let left = budget
  for (let guard = 0; guard < 40 && left >= 25 && out.length < 12; guard++) {
    const grade = gradeFor(left)
    const kind = theme.kinds ? weighted(theme.kinds) : KIND_OF_ROW[rollRow(DATA.tables.kinds, grade).item]
    const source = opts.source === "mix" ? (Math.random() < 0.5 ? "pf" : "spheres") : opts.source
    let item = source === "pf" ? pathfinderItem(kind, left, theme) : spheresItem(kind, left, level)
    if (!item && opts.source === "mix") item = source === "pf" ? spheresItem(kind, left, level) : pathfinderItem(kind, left, theme)
    if (!item) continue
    if (opts.spheres && item.system === "Pathfinder") item = spheresVersion(item, left, level)
    // no doubles: a second potion, scroll or compound of the same thing stacks; anything else is rolled again
    const same = out.find((x) => x.name === item.name)
    if (same) {
      if (!["potion", "scroll"].includes(item.kind)) continue
      same.each ??= same.value
      same.qty = (same.qty ?? 1) + 1
      same.value += item.value
    } else out.push(item)
    left -= item.value
  }
  // a tomb's nasty surprise: a cursed item passing for something useful
  if (theme.cursed && out.length && Math.random() < theme.cursed) {
    const cursed = DATA.magic.filter((e) => e.sub === "Cursed items")
    const curse = pick(DATA.tables.curses ?? [])
    if (cursed.length) { const e = pick(cursed); out.push({ kind: "cursed", name: e.name, value: 0, system: "Pathfinder", url: e.url, note: `cursed item${curse ? ` (or give a real item the "${curse.curse.toLowerCase()}" curse)` : ""}` }) }
  }
  return { items: out, left }
}

function mundaneItems(budget, theme) {
  const out = []
  let left = budget
  if (!Object.keys(theme.mundane).length) return { items: out, left }
  for (let guard = 0; guard < 30 && left >= 1 && out.length < 8; guard++) {
    const kind = weighted(theme.mundane)
    // mostly the everyday arms and armor, with the odd exotic piece
    const usual = Math.random() < 0.75
    const pool = kind === "weapon" ? (usual ? common(DATA.weapon, COMMON_WEAPONS) : DATA.weapon) : kind === "armor" ? (usual ? common(DATA.armor, COMMON_ARMOR) : DATA.armor)
      : kind === "shield" ? DATA.shield : kind === "ammo" ? DATA.ammo : DATA.gear.filter((e) => (MUNDANE_SUBS[kind] ?? []).includes(e.sub))
    const found = fromPool(pool, left)
    if (!found || out.some((x) => x.base === found.name)) continue
    const e = kind === "shield" ? { ...found, name: shieldName(found) } : found
    // cheap goods come in batches; arms are sometimes masterwork
    const each = e.price
    let qty = each <= left / 6 && each < 60 ? 1 + rnd(Math.min(10, Math.floor(left / 3 / each))) : 1
    let name = e.name, value = each
    const mw = kind === "weapon" ? 300 : kind === "armor" || kind === "shield" ? 150 : 0
    if (mw && each + mw <= left && Math.random() < 0.3) { name = `Masterwork ${e.name.toLowerCase()}`; value += mw; qty = 1 }
    out.push({ kind, name, base: found.name, qty, value: value * qty, system: isPf(e) ? "Pathfinder" : "Spheres", url: link(e), note: e.sub ?? { armor: "Armor", shield: "Shield" }[kind] })
    left -= value * qty
  }
  return { items: out, left }
}

function gems(budget) {
  const out = {}
  let left = budget
  const grades = DATA.tables.gems
  for (let guard = 0; guard < 60 && left >= grades[0].value; guard++) {
    const fits = grades.filter((g) => g.value <= left)
    // mostly the best grade the pile can afford, sometimes a lesser one
    const g = fits[Math.max(0, fits.length - 1 - (Math.random() < 0.6 ? 0 : 1 + rnd(2)))]
    const stone = pick(g.stones)
    const key = `${stone}|${g.value}`
    out[key] ??= { kind: "gem", name: stone, qty: 0, value: 0, note: g.grade.replace(/s$/, "").toLowerCase() + `, ${gp(g.value)} each` }
    out[key].qty++
    out[key].value += g.value
    left -= g.value
  }
  return { items: Object.values(out), left }
}

function valuables(budget) {
  const out = []
  let left = budget
  for (let guard = 0; guard < 12 && out.length < 8; guard++) {
    const fits = DATA.tables.valuables.filter((v) => v.min <= left)
    if (!fits.length) break
    const v = pick(fits)
    const value = Math.round(between(v.min, Math.min(v.max, left)) / 5) * 5 || v.min
    const looks = VALUABLE_LOOKS[v.name] ?? [["a fine"], ["object"]]
    const name = `${pick(looks[0])} ${pick(looks[1])}`
    out.push({ kind: "valuable", name: /^(a|an) /.test(name) ? name : `${/^[aeiou]/.test(name) ? "an" : "a"} ${name}`, value, note: v.name.toLowerCase() })
    left -= value
  }
  return { items: out, left }
}

// what's left, as coins in the theme's mix (whole coins; the split is by value)
function coins(amount, theme) {
  const rate = { pp: 10, gp: 1, sp: 0.1, cp: 0.01 }
  // the theme's mix is of how the coins look; by value, copper and silver are a small part of any pile
  const worth = { pp: 1, gp: 1, sp: 0.35, cp: 0.05 }
  const mix = Object.fromEntries(Object.entries(theme.coins).map(([k, w]) => [k, w * worth[k]]))
  const total = Object.values(mix).reduce((a, b) => a + b, 0)
  const out = {}
  let left = amount
  for (const k of ["pp", "gp", "sp", "cp"]) {
    if (!mix[k]) continue
    const n = Math.floor((amount * mix[k]) / total / rate[k])
    if (n > 0) { out[k] = n; left -= n * rate[k] }
  }
  // the rounding, in the smallest coin it fits
  out.gp = (out.gp ?? 0) + Math.floor(left); left -= Math.floor(left)
  out.sp = (out.sp ?? 0) + Math.floor(left * 10); left -= Math.floor(left * 10) / 10
  out.cp = (out.cp ?? 0) + Math.round(left * 100)
  for (const k of Object.keys(out)) if (!out[k]) delete out[k]
  return out
}

// ---------- a whole pile ----------
function budgetFor(o) {
  if (o.mode === "gold") {
    const lo = Math.max(0, Number(o.goldMin) || 0), hi = Math.max(lo, Number(o.goldMax) || lo)
    return { budget: Math.round(between(lo, hi)), basis: `between ${gp(lo)} and ${gp(hi)}` }
  }
  const cr = Math.min(20, Math.max(0.125, Number(o.cr) || 1))
  const row = DATA.tables.perEncounter[Math.max(1, Math.ceil(cr)) - 1]
  const base = row[o.speed] * (cr < 1 ? cr : 1) * (Number(o.amount) || 1) * Math.max(1, Number(o.encounters) || 1)
  const swing = Math.max(0, Math.min(90, Number(o.variance) || 0)) / 100
  return { budget: Math.round(base * between(1 - swing, 1 + swing)), basis: `CR ${o.cr}, ${o.speed} advancement${Number(o.amount) !== 1 ? `, ×${o.amount} treasure` : ""}${Number(o.encounters) > 1 ? `, ${o.encounters} encounters` : ""}: ${gp(base)}${swing ? ` ± ${Math.round(swing * 100)}%` : ""}` }
}
// the level the pile suits (for the compound tier): the CR, or the level whose encounter treasure is nearest the gold
function levelFor(o, budget) {
  if (o.mode !== "gold") return Math.max(1, Math.ceil(Number(o.cr) || 1))
  return DATA.tables.perEncounter.reduce((best, r) => (Math.abs(r.medium - budget) < Math.abs(best.medium - budget) ? r : best)).level
}
function generate(o) {
  const theme = THEMES[o.theme] ?? THEMES.hoard
  const { budget, basis } = budgetFor(o)
  const level = levelFor(o, budget)
  const share = (k) => budget * theme.shares[k] * between(0.8, 1.2)
  // the costly things first; whatever a part can't spend flows on, and the remainder is coin
  const magicBudget = Math.min(budget, share("magic"))
  const magic = magicItems(magicBudget, theme, o, level)
  let spent = magic.items.reduce((s, x) => s + x.value, 0)
  const mundane = mundaneItems(Math.min(budget - spent, share("mundane") + (magicBudget - spent) * 0.3), theme)
  spent += mundane.items.reduce((s, x) => s + x.value, 0)
  const art = valuables(Math.min(budget - spent, share("valuables")))
  spent += art.items.reduce((s, x) => s + x.value, 0)
  const stones = gems(Math.min(budget - spent, share("gems")))
  spent += stones.items.reduce((s, x) => s + x.value, 0)
  const coin = coins(Math.max(0, budget - spent), theme)
  return { budget, basis, theme, level, magic: magic.items, mundane: mundane.items, valuables: art.items, gems: stones.items, coins: coin, at: Date.now() }
}

// ---------- the page ----------
const blankOptions = () => ({ mode: "cr", cr: 5, speed: "medium", amount: 1, encounters: 1, variance: 20, goldMin: 1000, goldMax: 5000, theme: "hoard", source: "mix", spheres: false })
let options = blankOptions()
try { options = { ...options, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") } } catch {}
let pile = null
const saveOptions = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(options)) } catch {} }

const coinValue = (c) => (c.pp ?? 0) * 10 + (c.gp ?? 0) + (c.sp ?? 0) / 10 + (c.cp ?? 0) / 100
const coinText = (c) => ["pp", "gp", "sp", "cp"].filter((k) => c[k]).map((k) => `${c[k].toLocaleString("en-US")} ${k}`).join(", ") || "none"
const SECTIONS = [["magic", "Magic items"], ["mundane", "Mundane gear"], ["valuables", "Art and jewelry"], ["gems", "Gems"]]
function pileText(p) {
  const total = SECTIONS.reduce((s, [k]) => s + p[k].reduce((a, x) => a + x.value, 0), 0) + coinValue(p.coins)
  const lines = [`${p.theme.label} (${p.basis}): ${gp(total)}`, "", `Coins: ${coinText(p.coins)} (${gp(coinValue(p.coins))})`]
  for (const [k, label] of SECTIONS) {
    if (!p[k].length) continue
    lines.push("", `${label} (${gp(p[k].reduce((a, x) => a + x.value, 0))}):`)
    for (const x of p[k]) lines.push(`- ${x.qty > 1 ? `${x.qty} × ` : ""}${x.name}${x.value ? `, ${gp(x.value)}` : ""}${x.note ? ` (${x.note})` : ""}`)
  }
  return lines.join("\n")
}

function field(label, inner, hint) {
  return `<label class="field"><span>${label}</span>${inner}${hint ? `<span class="note">${hint}</span>` : ""}</label>`
}
const opt = (v, label, cur) => `<option value="${esc(v)}" ${String(v) === String(cur) ? "selected" : ""}>${esc(label)}</option>`
const numIn = (key, attrs = "") => `<input type="number" data-opt="${key}" value="${esc(options[key])}" ${attrs} style="width:6.5rem" />`

function render() {
  const o = options, theme = THEMES[o.theme] ?? THEMES.hoard
  const byCr = o.mode !== "gold"
  $("panel").innerHTML = `
    <section class="card">
      <h2>Treasure</h2>
      <div class="row">
        ${field("Worth", `<select data-opt="mode">${opt("cr", "By challenge rating", o.mode)}${opt("gold", "By a gold range", o.mode)}</select>`)}
        ${byCr ? field("Challenge rating", `<select data-opt="cr">${[["0.25", "1/4"], ["0.5", "1/2"], ...Array.from({ length: 20 }, (_, i) => [String(i + 1), String(i + 1)])].map(([v, l]) => opt(v, l, o.cr)).join("")}</select>`, "Or the party's average level")
          + field("Advancement", `<select data-opt="speed">${opt("slow", "Slow", o.speed)}${opt("medium", "Medium", o.speed)}${opt("fast", "Fast", o.speed)}</select>`)
          + field("Treasure", `<select data-opt="amount">${opt("0.5", "Incidental (half)", o.amount)}${opt("1", "Standard", o.amount)}${opt("2", "Double", o.amount)}${opt("3", "Triple", o.amount)}</select>`)
          + field("Encounters' worth", numIn("encounters", 'min="1" max="50"'), "A dungeon's whole haul")
          + field("Swing (±%)", numIn("variance", 'min="0" max="90" step="5"'))
          : field("From (gp)", numIn("goldMin", 'min="0" step="50"')) + field("To (gp)", numIn("goldMax", 'min="0" step="50"'))}
      </div>
      <div class="row">
        ${field("Theme", `<select data-opt="theme">${Object.entries(THEMES).map(([k, t]) => opt(k, t.label, o.theme)).join("")}</select>`)}
        ${field("Magic items from", `<select data-opt="source">${opt("mix", "Pathfinder and Spheres, mixed", o.source)}${opt("pf", "Pathfinder only", o.source)}${opt("spheres", "Spheres only", o.source)}</select>`)}
        <label class="field"><span>&nbsp;</span><span class="row" style="gap:.3rem"><input type="checkbox" data-opt="spheres" ${o.spheres ? "checked" : ""} /> Spheres of Power game (swap in the Spheres versions)</span></label>
      </div>
      <p class="note">${esc(theme.note)} Split: ${Object.entries(theme.shares).filter(([, v]) => v).map(([k, v]) => `${Math.round(v * 100)}% ${k === "valuables" ? "art and jewelry" : k === "mundane" ? "mundane gear" : k === "magic" ? "magic items" : k}`).join(", ")}; what a part can't spend becomes coin.</p>
      ${o.spheres ? `<p class="note">Spheres of Power: Pathfinder potions become compounds and wands become spell engines, and the ability, resistance, deflection and natural armor items become their Spheres charms. Other Pathfinder items (and scrolls) stay as they are.</p>` : ""}
      <div class="row add-row">
        <button type="button" class="primary" id="btnRoll" ${DATA.ready ? "" : "disabled"}>${DATA.ready ? (pile ? "Roll again" : "Generate loot") : "Loading the tables…"}</button>
        ${pile ? `<button type="button" id="btnCopy">Copy as text</button>` : ""}
      </div>
    </section>
    ${pile ? renderPile(pile) : `<section class="card"><p class="muted">Set the worth and a theme, then generate. The pile is built to the budget: magic items first, then mundane gear, art and jewelry and gems, with the rest in coin.</p></section>`}`
}

function renderPile(p) {
  const total = SECTIONS.reduce((s, [k]) => s + p[k].reduce((a, x) => a + x.value, 0), 0) + coinValue(p.coins)
  const row = (x) => `<tr><td>${x.qty > 1 ? `${x.qty} × ` : ""}${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>` : esc(x.name)}${x.system ? ` <span class="pi-meta">${esc(x.system)}${x.kind && (x.system === "Spheres" ? SP_KIND_LABEL[x.kind] : KIND_LABEL[x.kind]) ? ` · ${esc(x.system === "Spheres" ? SP_KIND_LABEL[x.kind] : KIND_LABEL[x.kind])}` : ""}</span>` : ""}${x.note ? `<div class="note">${esc(x.note)}</div>` : ""}</td><td class="num">${x.value ? gp(x.value) : "—"}</td></tr>`
  return `
    <section class="card">
      <div class="row"><h2 style="margin:0">${esc(p.theme.label)}: ${gp(total)}</h2><span class="spacer"></span><span class="muted">${esc(p.basis)} → budget ${gp(p.budget)}</span></div>
      <h3>Coins <span class="muted">${gp(coinValue(p.coins))}</span></h3>
      <p>${esc(coinText(p.coins))}</p>
      ${SECTIONS.map(([k, label]) => (p[k].length ? `<h3>${label} <span class="muted">${gp(p[k].reduce((a, x) => a + x.value, 0))}</span></h3>
        <div class="table-wrap"><table class="mods"><tbody>${p[k].map(row).join("")}</tbody></table></div>` : "")).join("")}
    </section>`
}

function toast(msg) {
  const t = $("toast")
  t.textContent = msg
  t.hidden = false
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => (t.hidden = true), 2500)
}

$("panel").addEventListener("change", (e) => {
  const k = e.target.dataset.opt
  if (!k) return
  options[k] = e.target.type === "checkbox" ? e.target.checked : e.target.type === "number" ? Number(e.target.value) || 0 : e.target.value
  saveOptions()
  render()
})
$("panel").addEventListener("click", (e) => {
  if (e.target.id === "btnRoll" && DATA.ready) { pile = generate(options); render() }
  if (e.target.id === "btnCopy" && pile) navigator.clipboard?.writeText(pileText(pile)).then(() => toast("Copied"), () => toast("Couldn't copy"))
})

// follow the wiki's dark-mode toggle when embedded on the site
function applyTheme(theme) {
  if (theme === "dark" || theme === "light") document.documentElement.dataset.theme = theme
}
try {
  window.parent?.document?.addEventListener("themechange", (e) => applyTheme(e.detail?.theme))
} catch {}
window.addEventListener("storage", (e) => e.key === "theme" && applyTheme(e.newValue))

render()
loadData()
