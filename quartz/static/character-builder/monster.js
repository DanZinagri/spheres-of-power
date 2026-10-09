// Monster Creator: the character builder in "monster" mode (monster.html). A compendium monster
// (compendium/monsters-index.json + monsters/*.json, parsed from Archives of Nethys by
// scripts/monsters.py) is rebuilt from its parts: racial Hit Dice as a racial class, ability scores,
// natural armor and other AC parts, feats, and skill ranks worked back from the printed totals.
// Templates, added Hit Dice, class levels and sphere talents adjust it, and the CR follows the
// Bestiary's monster advancement rules. Exports: a Foundry NPC (the builder's export) and a stat block.
"use strict"

// ---------- rules tables ----------
const CR_LADDER = ["1/8", "1/6", "1/4", "1/3", "1/2", ...Array.from({ length: 30 }, (_, i) => String(i + 1))]
const CR_XP = { "1/8": 50, "1/6": 65, "1/4": 100, "1/3": 135, "1/2": 200, 1: 400, 2: 600, 3: 800, 4: 1200, 5: 1600, 6: 2400,
  7: 3200, 8: 4800, 9: 6400, 10: 9600, 11: 12800, 12: 19200, 13: 25600, 14: 38400, 15: 51200, 16: 76800, 17: 102400,
  18: 153600, 19: 204800, 20: 307200, 21: 409600, 22: 614400, 23: 819200, 24: 1228800, 25: 1638400, 26: 2457600,
  27: 3276800, 28: 4915200, 29: 6553600, 30: 9830400 }
const crIndex = (cr) => Math.max(0, CR_LADDER.indexOf(String(cr)))
const crAdd = (cr, n) => CR_LADDER[Math.min(CR_LADDER.length - 1, Math.max(0, crIndex(cr) + n))]
// Bestiary Table 2-1: hit points gained to go up to each CR (from the one below)
const HP_PER_CR = { 1: 5, 2: 5, 3: 10, 4: 10, 5: 15, 6: 15, 7: 15, 8: 15, 9: 15, 10: 15, 11: 15, 12: 15, 13: 20, 14: 20,
  15: 20, 16: 20, 17: 30, 18: 30, 19: 30, 20: 40 }
const hpForCr = (n) => HP_PER_CR[Math.min(n, 20)] ?? 40
// Table 2-2: size increases (Str, Dex, Con, natural armor) going up from each size
const SIZE_ORDER = ["fine", "dim", "tiny", "sm", "med", "lg", "huge", "grg", "col"]
const SIZE_UP = { fine: [0, -2, 0, 0], dim: [2, -2, 0, 0], tiny: [4, -2, 0, 0], sm: [4, -2, 2, 0], med: [8, -2, 4, 2],
  lg: [8, -2, 4, 3], huge: [8, 0, 4, 4], grg: [8, 0, 4, 5] }
const SIZE_NAMES = { Fine: "fine", Diminutive: "dim", Tiny: "tiny", Small: "sm", Medium: "med", Large: "lg", Huge: "huge",
  Gargantuan: "grg", Colossal: "col" }
const ALIGN_KEYS = { LG: "lg", NG: "ng", CG: "cg", LN: "ln", N: "tn", CN: "cn", LE: "le", NE: "ne", CE: "ce" }
// Bestiary creature types: class skills (the racial Hit Dice's), and default role for class levels
const TYPE_SKILLS = {
  aberration: ["acr", "clm", "esc", "fly", "int", "kar", "per", "spl", "ste", "sur", "swm"],
  animal: ["acr", "clm", "fly", "per", "ste", "swm"], construct: [], ooze: [], vermin: [],
  dragon: ["apr", "blf", "clm", "crf", "dip", "fly", "hea", "int", "kar", "kdu", "ken", "kge", "khi", "klo", "kna", "kno", "kpl", "kre", "lin", "per", "sen", "spl", "ste", "swm", "umd"],
  fey: ["acr", "blf", "clm", "crf", "dip", "dis", "esc", "fly", "kge", "klo", "kna", "per", "prf", "sen", "slt", "ste", "swm", "umd"],
  humanoid: ["clm", "crf", "han", "hea", "pro", "rid", "sur"],
  "magical beast": ["acr", "clm", "fly", "per", "ste", "swm"],
  "monstrous humanoid": ["clm", "crf", "fly", "int", "per", "rid", "ste", "sur", "swm"],
  outsider: ["blf", "crf", "kpl", "per", "sen", "ste"],
  plant: ["per", "ste"], undead: ["clm", "dis", "fly", "int", "kar", "kre", "per", "sen", "spl", "ste"],
}
const TYPE_RULES = { aberration: [8, "med", 4], animal: [8, "med", 2], construct: [10, "high", 2], dragon: [12, "high", 6],
  fey: [6, "low", 6], humanoid: [8, "med", 2], "magical beast": [10, "high", 2], "monstrous humanoid": [10, "high", 4],
  ooze: [8, "med", 2], outsider: [10, "high", 6], plant: [8, "med", 2], undead: [8, "med", 4], vermin: [8, "med", 2] }
// Table 2-4: which classes are "key" (+1 CR per level) for a monster's role; the rest add +1 CR per 2 levels
// until the levels added reach the monster's original CR. NPC classes are never key.
const ROLES = { combat: "Combat", spell: "Spell", skill: "Skill", special: "Special" }
const CLASS_GROUPS = {
  martial: ["barbarian", "fighter", "ranger", "bloodrager", "brawler", "cavalier", "gunslinger", "slayer", "swashbuckler", "samurai", "warpriest", "hunter", "shifter"],
  caster: ["cleric", "druid", "sorcerer", "wizard", "witch", "oracle", "arcanist", "shaman", "psychic", "summoner"],
  skill: ["bard", "rogue", "investigator", "ninja", "skald", "vigilante", "mesmerist", "occultist", "spiritualist", "medium", "alchemist", "inquisitor", "magus"],
  holy: ["monk", "paladin", "antipaladin", "kineticist"],
}
const KEY_FOR_ROLE = { combat: ["martial"], spell: ["caster"], skill: ["martial", "skill"], special: [] }
// natural attacks (plural too: "2 claws"), and the ones that are secondary (-5, 1/2 Str)
const NATURAL_SECONDARY = /\b(hoof|hooves|tentacles?|wings?|pincers?|tail(?: slap)?s?)\b/i
const NATURAL_ATTACKS = /\b(bites?|claws?|gores?|slams?|stings?|talons?|hoof|hooves|tentacles?|wings?|pincers?|tail(?: slap)?s?|tendrils?|touch|rakes?|horns?|butts?|slaps?|stamp|trample|tongues?|quills?|spikes?)\b/i

// the numbers common feats change, as changes on the feat (so they follow edits: more HD, more ranks)
const SKILL_PAIR_FEATS = { Acrobatic: ["acr", "fly"], Alertness: ["per", "sen"], "Animal Affinity": ["han", "rid"], Athletic: ["clm", "swm"],
  Deceitful: ["blf", "dis"], "Deft Hands": ["dev", "slt"], "Magical Aptitude": ["spl", "umd"], Persuasive: ["dip", "int"],
  "Self-Sufficient": ["hea", "sur"], Stealthy: ["esc", "ste"] }
const rankBonus = (k, low, high) => `${low} + ${high - low} * min(1, floor(@skills.${k}.rank / 10))`
function featChanges(name) {
  const ch = (formula, target, type = "untyped") => ({ formula, target, type, operator: "add" })
  const base = name.replace(/\s*\(.*\)$/, "").trim()
  const inner = (name.match(/\(([^)]+)\)/) ?? [])[1] ?? ""
  if (base === "Improved Initiative") return [ch("4", "init")]
  if (base === "Great Fortitude") return [ch("2", "fort")]
  if (base === "Lightning Reflexes") return [ch("2", "ref")]
  if (base === "Iron Will") return [ch("2", "will")]
  if (base === "Toughness") return [ch("max(3, @attributes.hd.total)", "mhp")]
  if (base === "Dodge") return [ch("1", "ac", "dodge")]
  if (base === "Improved Natural Armor") return [ch("1", "nac")]
  if (base === "Agile Maneuvers") return [ch("max(0, @abilities.dex.mod - @abilities.str.mod)", "cmb")]
  if (base === "Skill Focus") { const [k] = skillKeyOf(inner); return k ? [ch(rankBonus(k, 3, 6), `skill.${k}`)] : [] }
  if (SKILL_PAIR_FEATS[base]) return SKILL_PAIR_FEATS[base].map((k) => ch(rankBonus(k, 2, 4), `skill.${k}`))
  return []
}

const crText = (cr) => `CR ${cr}`
const xpOf = (cr) => CR_XP[String(cr)] ?? 0
const sizeName = (k) => SIZES[k]?.[0] ?? "Medium"
const fmt = (n) => (n == null ? "—" : signed(n))

// ---------- loading a compendium monster ----------
async function openMonsterPicker() {
  const box = h("input", { type: "search", placeholder: "Search monsters by name", "aria-label": "Search monsters" })
  const typeSel = h("select", { "aria-label": "Creature type" }, h("option", { value: "" }, "Any type"),
    ...Object.keys(TYPE_RULES).map((t) => h("option", { value: t }, t[0].toUpperCase() + t.slice(1))))
  const crSel = h("select", { "aria-label": "CR" }, h("option", { value: "" }, "Any CR"), ...CR_LADDER.map((cr) => h("option", { value: cr }, `CR ${cr}`)))
  const results = h("div", { class: "picker-results", role: "list" }, h("p", { class: "muted" }, "Loading monsters…"))
  const dlg = openDialog("Load a monster", h("div", { class: "row picker-filters" }, box, typeSel, crSel), results)
  let all = []
  const render = () => {
    const q = box.value.trim().toLowerCase()
    const hits = all.filter((m) => (!q || m.name.toLowerCase().includes(q)) && (!typeSel.value || m.type === typeSel.value) && (!crSel.value || m.cr === crSel.value))
    const rank = (m) => (!q ? 0 : m.name.toLowerCase().startsWith(q) ? 0 : 1)
    hits.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
    const shown = hits.slice(0, 60)
    fill(results, ...shown.map((m) => h("button", { class: "picker-item", role: "listitem", onclick: async () => { dlg.done(); await loadMonster(m) } },
      h("span", { class: "pi-name" }, m.name, h("span", { class: "pi-meta" }, ` CR ${m.cr} · ${m.size} ${m.type}${m.subtypes.length ? ` (${m.subtypes.join(", ")})` : ""} · ${m.hd} HD${m.classes.length ? ` · ${m.classes.join(", ")}` : ""}`)),
      h("span", { class: "pi-pre" }, m.source))),
    hits.length > shown.length ? h("p", { class: "note" }, `Showing ${shown.length} of ${hits.length}; type more of the name or filter.`) : null,
    hits.length ? null : h("p", { class: "muted" }, all.length ? "No monsters match." : "Couldn't load the monsters."))
  }
  for (const el of [box, typeSel, crSel]) el.addEventListener(el === box ? "input" : "change", render)
  loadCompendium("monsters-index.json", []).then((list) => { all = list; render() })
  box.focus()
}

// the monster's skill name ("Knowledge (arcana)", "Craft (traps)") -> builder key, and a specialty
function skillKeyOf(name) {
  const n = name.toLowerCase()
  for (const [k, [label]] of Object.entries(SKILLS)) if (label.toLowerCase() === n) return [k, ""]
  const m = n.match(/^(craft|perform|profession)\s*\((.+)\)$/)
  if (m) return [{ craft: "crf", perform: "prf", profession: "pro" }[m[1]], m[2]]
  return [null, ""]
}

async function loadMonster(entry) {
  const data = await loadCompendium(entry.file, { entries: [] })
  const mon = data.entries.find((x) => x.id === entry.id)
  if (!mon) return toast("Couldn't load that monster.")
  if (!CLASS_DATA.loaded) await loadClassData() // class levels on the stat block need the class data
  const s = blankState()
  s.spheresModule = state.spheresModule
  s.hpMode = "average"
  s.name = mon.statName || mon.name
  s.details.alignment = ALIGN_KEYS[(mon.alignment ?? "N").toUpperCase()] ?? "tn"
  s.details.languages = (mon.languages ?? "").split(";")[0]
  s.race.name = ""
  s.race.size = SIZE_NAMES[mon.size] ?? "med"
  s.race.speed = mon.speed?.land ?? 30
  for (const k of ABL) s.abilities[k] = mon.abilities[k] ?? null
  const type = mon.type ?? ""
  const rules = TYPE_RULES[type] ?? [8, "med", 2]
  s.classes = []
  if (mon.racialHd > 0 || !mon.classes.length) {
    s.classes.push({ ...blankClass(false), name: `${type ? type[0].toUpperCase() + type.slice(1) : "Racial"} (racial HD)`, racial: true,
      level: Math.max(1, mon.racialHd), hd: (mon.hpFormula.match(/\d+d(\d+)/) ?? [])[1] ? +mon.hpFormula.match(/\d+d(\d+)/)[1] : rules[0],
      bab: rules[1], fort: "low", ref: "low", will: "low", skills: rules[2], classSkills: TYPE_SKILLS[type] ?? [], favored: false })
  }
  // class levels printed on the stat block ("Goblin warrior 1"): from the class data when it's known
  for (const cl of mon.classes) {
    const known = CLASS_DATA.list.find((c) => c.label.toLowerCase() === cl.name.toLowerCase() && c.key.startsWith("pf1e:"))
    s.classes.push({ ...blankClass(false), name: cl.name, level: cl.level, ...(known ? { hd: known.hd, bab: known.bab, fort: known.fort,
      ref: known.ref, will: known.will, skills: known.skills, classSkills: known.classSkills } : {}), favored: false, fromBase: true })
  }
  // AC parts other than Dex and size: natural armor and the rest as changes, armor and shield as gear
  const acParts = { ...mon.ac.parts }
  const changes = []
  const typeOfPart = { natural: "nac", deflection: "ac", dodge: "ac", insight: "ac", luck: "ac", sacred: "ac", profane: "ac", morale: "ac", racial: "ac", untyped: "ac" }
  // the Dodge feat's +1 is in the stat block's dodge bonus: the feat brings it (below), so it isn't counted twice
  if (acParts.dodge && mon.feats.some((f) => /^Dodge\b/.test(f))) acParts.dodge -= 1
  for (const [part, v] of Object.entries(acParts)) {
    if (["dex", "size"].includes(part) || !v) continue
    if (part === "armor" || part === "shield") {
      s.gear.push({ name: part === "armor" ? "Armor" : "Shield", kind: part, qty: 1, weight: 0, price: 0, equipped: true, desc: "From the stat block.",
        ac: v, acp: 0, asf: 0, maxDex: "", armorType: part === "armor" ? "lightArmor" : "lightShield", abilities: [], mods: [] })
      continue
    }
    const tgt = typeOfPart[part.split(" ")[0]] ?? "ac"
    changes.push({ formula: String(v), target: tgt, type: tgt === "nac" ? "untyped" : (part.split(" ")[0] in PF1_FORMULA.bonusTypes ? part.split(" ")[0] : "untyped"), operator: "add" })
  }
  // feats (names; the compendium's text when it has them)
  const featIndex = await loadCompendium("feats-index.json", [])
  for (const f of mon.feats) {
    const base = f.replace(/\s*\(.*\)$/, "").replace(/[BMR]$/, "").trim()
    const e = featIndex.find((x) => isPf(x) && x.name.replace(/\s*\(.*\)$/, "").toLowerCase() === base.toLowerCase())
    const name = f.replace(/[BMR]$/, "").trim()
    s.features.push(newFeature("feat", { name, ref: e?.id, desc: e?.summary ?? "", changes: featChanges(name) }))
  }
  // the stat block's own text: special abilities, DR / SR / resistances and so on stay with the monster
  for (const a of mon.specialAbilities) s.features.push(newFeature("misc", { name: `${a.name} (${a.kind})`, desc: a.text, monster: true }))
  s.monster = {
    base: { id: mon.id, name: mon.name, cr: mon.cr, xp: mon.xp, url: mon.url, source: mon.source },
    cr: mon.cr, type, subtypes: mon.subtypes ?? [], role: defaultRole(mon),
    speeds: Object.fromEntries(Object.entries(mon.speed ?? {}).filter(([k]) => k !== "land")),
    senses: mon.senses, aura: mon.aura, defensive: mon.defensive, dr: mon.dr, immune: mon.immune, resist: mon.resist, sr: mon.sr,
    weaknesses: mon.weaknesses, sq: mon.sq, specialAttacks: mon.specialAttacks, sla: mon.sla, spells: mon.spells,
    space: mon.space, reach: mon.reach, gearText: mon.gear, hpAbility: abilityForHp(type, mon),
    baseHd: mon.racialHd, baseCr: mon.cr, templates: [], adjustments: [], addedHd: 0,
    attacks: [...attacksFrom(mon.melee, "melee"), ...attacksFrom(mon.ranged, "ranged")],
    printed: { ac: mon.ac.total, touch: mon.ac.touch, flat: mon.ac.flat, hp: mon.hp, init: mon.init, fort: mon.saves.fort,
      ref: mon.saves.ref, will: mon.saves.will, bab: mon.bab, cmb: mon.cmb, cmd: mon.cmd,
      skills: Object.fromEntries(mon.skills.map((x) => [x.name, x.total])) },
    racialMods: mon.racialMods, monsterChanges: [],
  }
  // Weapon Finesse: Dex to attack with natural attacks and light weapons
  if (mon.feats.some((f) => /^Weapon Finesse/.test(f)))
    for (const a of s.monster.attacks) if (a.range === "melee" && (a.natural || /dagger|rapier|short ?sword|kukri|sickle|sap|whip|light|cestus|gauntlet|unarmed|curve blade/i.test(a.name))) a.finesse = true
  if (changes.length) s.features.push(newFeature("misc", { name: "Armor class (stat block)", changes, desc: "Natural armor and other AC bonuses from the stat block.", monster: true }))
  state = normalize(s)
  state.monster = s.monster
  // derived parts: good saves on the racial Hit Dice, skill ranks and leftovers, attack modifiers
  fitSaves(mon)
  fitSkills(mon)
  fitAttacks()
  save()
  tab = "monster"
  renderAll()
  toast(`Loaded ${mon.name}`)
}

function defaultRole(mon) {
  if (mon.spells) return "spell"
  if (["fey", "aberration"].includes(mon.type) && mon.skills.some((x) => x.name === "Stealth" && x.total >= mon.hd + 5)) return "skill"
  return "combat"
}
// undead use Charisma for hit points; constructs have none (they get bonus hit points by size)
function abilityForHp(type, mon) {
  if (type === "undead") return "cha"
  if (mon.abilities.con == null) return null
  return "con"
}

// "2 claws +8 (1d6+4 plus grab)" -> one row per attack line: count, name, natural / weapon, primary
function attacksFrom(groups, range) {
  const out = []
  ;(groups ?? []).forEach((g, gi) => g.forEach((a) => {
    const natural = range === "melee" && NATURAL_ATTACKS.test(a.name) && a.bonuses.length <= 1
    out.push({ group: gi, range, name: a.name, count: a.count || 1, natural, primary: natural ? !NATURAL_SECONDARY.test(a.name) : true,
      dice: (a.damage.match(/^\s*(\d+d\d+|\d+)/) ?? [])[1] ?? "", printedBonus: a.bonuses[0] ?? null, printedIter: a.bonuses,
      printedDamage: a.damage, crit: a.crit || "", extra: a.extra || "", atkMisc: 0, dmgMisc: 0, finesse: false, enh: 0 })
  }))
  return out
}

// ---------- fitting derived parts to the printed numbers ----------
function fitSaves(mon) {
  const racial = state.classes.find((c) => c.racial)
  if (!racial) return
  const c = calc()
  const lvl = num(racial.level)
  const good = 2 + Math.floor(lvl / 2), poor = Math.floor(lvl / 3)
  for (const k of ["fort", "ref", "will"]) {
    // what the racial row must give = the printed save less everything else (abilities, feats, class levels)
    const racialNow = racial[k] === "high" ? good : poor
    const want = mon.saves[k] - (c.saveTotals[k] - racialNow)
    racial[k] = Math.abs(want - good) < Math.abs(want - poor) ? "high" : "low"
  }
  const after = calc()
  const left = Object.fromEntries(["fort", "ref", "will"].map((k) => [k, mon.saves[k] - after.saveTotals[k]]).filter(([, v]) => v))
  if (Object.keys(left).length)
    addMonsterChange("Saving throws (stat block)", Object.entries(left).map(([k, v]) => ({ formula: String(v), target: k, type: "racial", operator: "add" })),
      "What the stat block's saves have beyond the Hit Dice, ability scores and feats (racial bonuses and the like).")
}

function fitSkills(mon) {
  // racial modifiers line ("+4 Ride, +4 Stealth") as racial changes first
  const racial = []
  for (const m of String(state.monster.racialMods ?? "").matchAll(/([+\-−–]\d+)\s+([A-Z][A-Za-z ()]+?)(?=,|;|$|\s+\()/g)) {
    const [k] = skillKeyOf(m[2].trim())
    if (k) racial.push({ formula: m[1].replace(/[−–]/, "-"), target: `skill.${k}`, type: "racial", operator: "add" })
  }
  if (racial.length) addMonsterChange("Racial skill modifiers", racial, state.monster.racialMods)
  const c = calc()
  const leftovers = []
  for (const sk of mon.skills) {
    const [k, sub] = skillKeyOf(sk.name)
    if (!k) continue
    const cs = c.classSkills.has(k)
    const zero = skillTotal(k, 0, c)
    let rank = sk.total - zero - (cs ? 3 : 0)
    if (rank < 1) rank = 0
    rank = Math.min(rank, c.hd)
    if (SUB_SKILLS.includes(k)) state.subSkills[k].push({ name: sub || sk.name, rank, ability: "" })
    else state.skills[k] = rank
    let got = skillTotal(k, rank, c)
    // a skill with ranks that comes out exactly 3 short is one of the monster's own class skills
    // (outsiders choose four; many monsters have extra ones)
    const racialRow = state.classes.find((cl) => cl.racial)
    if (rank > 0 && !cs && sk.total - got === 3 && racialRow) {
      racialRow.classSkills = [...new Set([...racialRow.classSkills, k])]
      got = skillTotal(k, rank, calc())
    }
    if (got !== sk.total) leftovers.push({ formula: String(sk.total - got), target: `skill.${k}`, type: "untyped", operator: "add" })
  }
  if (leftovers.length) addMonsterChange("Skills (stat block)", leftovers, "What the printed skill totals have beyond ranks, ability, class skill and racial bonuses.")
}

function fitAttacks() {
  const c = calc()
  for (const a of state.monster.attacks) {
    const got = attackBonus(a, c)
    if (a.printedBonus != null) a.atkMisc = a.printedBonus - got
    const dmg = damageBonus(a, c)
    const printedMod = num((a.printedDamage.match(/[+\-−–]\s*\d+\s*$/) ?? ["0"])[0].replace(/[−–]/, "-").replace(/\s/g, ""))
    if (!a.dice) continue
    a.dmgMisc = printedMod - dmg
    // a weapon whose damage is 1/2 Str more is wielded two-handed; a ranged one with Str added is thrown
    const str = c.abl.str.mod
    if (!a.natural && a.range === "melee" && str > 1 && a.dmgMisc === Math.floor(str * 0.5)) { a.twoHanded = true; a.dmgMisc = 0 }
    if (a.range === "ranged" && str && a.dmgMisc === str) { a.thrown = true; a.dmgMisc = 0 }
  }
}

function addMonsterChange(name, changes, desc) {
  state.features.push(newFeature("misc", { name, changes, desc, monster: true }))
}

// ---------- attacks ----------
const naturalCount = () => state.monster.attacks.filter((a) => a.natural && a.group === 0).reduce((n, a) => n + num(a.count), 0)
function attackBonus(a, c) {
  const abl = a.range === "ranged" || a.finesse ? c.abl.dex.mod : c.abl.str.mod
  return c.bab + abl + c.size + num(a.enh) + (a.natural && !a.primary ? -5 : 0) + c.attackMod[a.range === "ranged" ? "ranged" : "melee"]
}
function damageBonus(a, c) {
  const str = c.abl.str.mod
  if (a.range === "ranged") return (a.thrown ? str : 0) + num(a.enh)
  // a lone natural attack adds 1.5 x Str; secondary natural attacks add 1/2 Str; two-handed weapons 1.5 x
  const mult = a.natural ? (!a.primary ? 0.5 : naturalCount() === 1 ? 1.5 : 1) : a.twoHanded ? 1.5 : 1
  return Math.floor(str * mult) + num(a.enh) + c.damageMod.melee
}
function attackText(a, c) {
  const bonus = attackBonus(a, c) + num(a.atkMisc)
  const iter = a.natural ? [bonus] : [bonus, ...Array.from({ length: Math.max(0, Math.ceil(c.bab / 5) - 1) }, (_, i) => bonus - 5 * (i + 1))]
  const dmg = a.dice ? `${a.dice}${(() => { const d = damageBonus(a, c) + num(a.dmgMisc); return d ? signed(d) : "" })()}` : a.printedDamage
  const crit = a.crit ? `/${a.crit}` : ""
  return `${a.count > 1 ? `${a.count} ` : ""}${a.name} ${iter.map(signed).join("/")} (${dmg}${crit}${a.extra ? ` plus ${a.extra}` : ""})`
}

// ---------- CR ----------
// Table 2-1 read backwards: the CR the added hit points buy, from the base CR up
function crFromAddedHp(baseCr, addedHp) {
  let idx = crIndex(baseCr), left = addedHp
  while (left > 0 && idx < CR_LADDER.length - 1) {
    const next = Number(CR_LADDER[idx + 1]) || 1
    const need = hpForCr(next)
    if (left < need) break
    left -= need
    idx++
  }
  return idx - crIndex(baseCr)
}
function classCr(c) {
  const mon = state.monster
  const original = Number(mon.baseCr) || 0
  let total = 0, rows = []
  const added = state.classes.filter((cl) => !cl.racial && !cl.fromBase && num(cl.level) > 0)
  for (const cl of added) {
    const n = cl.name.toLowerCase().replace(/\s*\(.*\)$/, "")
    const npc = ["adept", "aristocrat", "commoner", "expert", "warrior"].includes(n)
    const group = Object.entries(CLASS_GROUPS).find(([, list]) => list.includes(n))?.[0]
      ?? (cl.caster && cl.caster !== "none" ? "caster" : "martial")
    const key = cl.keyOverride ?? (!npc && (KEY_FOR_ROLE[mon.role] ?? []).includes(group))
    const lvl = num(cl.level)
    // non-key: +1 per 2 levels until the levels added reach the original CR, then +1 per level
    const cr = key ? lvl : (() => { let x = 0; for (let i = 1; i <= lvl; i++) x += i > original ? 1 : i % 2 === 0 ? 1 : 0; return x })()
    total += cr
    rows.push({ label: `${cl.name} ${lvl}${npc ? " (NPC class)" : key ? " (key)" : ""}`, cr })
  }
  return { total, rows }
}
// sphere talents: Might and Guile talents count like bonus feats (no CR); Power talents count more,
// like adding spells: +1 CR per CR_PER_POWER talents added
function talentCr() {
  const mon = state.monster
  const per = num(mon.powerTalentsPerCr) || 2
  const added = state.talents.filter((t) => sphereKind(t.sphere) === "magic" && !t.exclude && !t.fromBase).length
  return { added, per, cr: Math.floor(added / per) }
}
function monsterCr() {
  const mon = state.monster
  if (!mon) return null
  const c = calc()
  const rows = [{ label: `${mon.base.name} (stat block)`, cr: 0, base: true }]
  let steps = 0
  if (num(mon.addedHd) > 0) {
    const racial = state.classes.find((cl) => cl.racial)
    const die = num(racial?.hd) || 8
    const perHd = die / 2 + 0.5 + (mon.hpAbility ? c.abl[mon.hpAbility].mod : 0)
    const n = crFromAddedHp(mon.baseCr, num(mon.addedHd) * perHd)
    rows.push({ label: `+${mon.addedHd} racial Hit Dice (about ${Math.round(num(mon.addedHd) * perHd)} hp)`, cr: n })
    steps += n
  }
  for (const t of mon.templates) { rows.push({ label: `${t.name} template`, cr: num(t.cr) }); steps += num(t.cr) }
  const cls = classCr(c)
  rows.push(...cls.rows)
  steps += cls.total
  const tal = talentCr()
  if (tal.added) { rows.push({ label: `${tal.added} Power talent${tal.added > 1 ? "s" : ""} added (+1 CR per ${tal.per})`, cr: tal.cr }); steps += tal.cr }
  for (const a of mon.adjustments) { rows.push({ label: a.label || "Adjustment", cr: num(a.cr) }); steps += num(a.cr) }
  const cr = crAdd(mon.baseCr, steps)
  return { cr, xp: xpOf(cr), rows }
}

// ---------- hooks into the builder ----------
HOOKS.calc = (out, s, m) => {
  if (!s.monster) return
  // average hit points, rounded down once; undead use Charisma, constructs neither (bonus hit points instead)
  const classHp = out.classHp.reduce((a, b) => a + b, 0)
  const ab = s.monster.hpAbility
  // a creature whose first Hit Die is a PC class level gets that die's maximum
  const first = s.classes.find((cl) => num(cl.level) > 0)
  const pcFirst = first && !first.racial && !NPC_CLASS_NAMES.includes(first.name.toLowerCase()) ? num(first.hd) - (num(first.hd) / 2 + 0.5) : 0
  out.hp = Math.floor(classHp + pcFirst) + (ab ? out.abl[ab].mod * out.hd : 0) + constructHp(s) + num(s.monster.bonusHp) + m("mhp")
  // Tiny and smaller creatures, and incorporeal ones, use Dex for CMB
  if (["fine", "dim", "tiny"].includes(s.race.size) || (s.monster.subtypes ?? []).includes("incorporeal")) out.cmb += out.abl.dex.mod - out.abl.str.mod
}
const NPC_CLASS_NAMES = ["adept", "aristocrat", "commoner", "expert", "warrior"]
// constructs' bonus hit points by size (Bestiary, construct type)
const CONSTRUCT_HP = { sm: 10, med: 20, lg: 30, huge: 40, grg: 60, col: 80 }
const constructHp = (s) => (s.monster?.type === "construct" ? CONSTRUCT_HP[s.race.size] ?? 0 : 0)
HOOKS.summary = (c) => {
  const r = monsterCr()
  if (!r) return []
  return [h("div", { class: "card" },
    h("div", { class: "stat-grid" }, h("div", { class: "stat" }, h("b", {}, `CR ${r.cr}`), h("span", {}, "Challenge")),
      h("div", { class: "stat" }, h("b", {}, xpOf(r.cr).toLocaleString("en-US")), h("span", {}, "XP")),
      h("div", { class: "stat" }, h("b", {}, `${c.hd}`), h("span", {}, "HD"))))]
}
HOOKS.exportActor = (actor, c) => {
  const mon = state.monster
  if (!mon) return
  const r = monsterCr()
  actor.system.details.cr = { base: Number(r.cr.includes("/") ? eval(r.cr) : r.cr) }
  for (const k of ABL) if (state.abilities[k] === null) actor.system.abilities[k] = { value: null }
  actor.system.attributes.speed = { land: { base: num(state.race.speed) },
    ...Object.fromEntries(Object.entries(mon.speeds ?? {}).filter(([k]) => k !== "flyManeuver").map(([k, v]) => [k, { base: num(v), ...(k === "fly" && mon.speeds.flyManeuver ? { maneuverability: mon.speeds.flyManeuver } : {}) }])) }
  actor.system.traits = { ...actor.system.traits, senses: { custom: mon.senses ?? "" }, dr: { custom: mon.dr ?? "" }, eres: { custom: mon.resist ?? "" },
    di: { custom: mon.immune ?? "" }, dv: { custom: mon.weaknesses ?? "" } }
  if (mon.sr) actor.system.attributes.sr = { formula: String(num(mon.sr)) }
  actor.system.details.type = mon.type
  // natural attacks and the stat block's attacks as attack items
  for (const a of mon.attacks) {
    const bonus = attackBonus(a, c) + num(a.atkMisc)
    actor.items.push(item("attack", `${a.name}${a.count > 1 ? ` (×${a.count})` : ""}`, {
      subType: a.natural ? "natural" : "weapon",
      description: { value: toHtml(`${attackText(a, c)}${a.extra ? `\n\nPlus ${a.extra}.` : ""}`) },
      actions: [{
        _id: randomId(), name: "Attack", actionType: a.range === "ranged" ? "rwak" : "mwak",
        activation: { type: "attack" },
        ability: { attack: a.range === "ranged" || a.finesse ? "dex" : "str", damage: a.range === "ranged" ? "" : "str",
          damageMult: a.natural ? (!a.primary ? 0.5 : naturalCount() === 1 ? 1.5 : 1) : 1,
          critRange: num((a.crit.match(/^(\d+)/) ?? [])[1]) || 20, critMult: num((a.crit.match(/x(\d)/) ?? [])[1]) || 2 },
        attackBonus: String(num(a.atkMisc) + num(a.enh) || ""),
        damage: { parts: a.dice ? [{ formula: `${a.dice}${num(a.dmgMisc) + num(a.enh) ? ` + ${num(a.dmgMisc) + num(a.enh)}` : ""}`, types: [] }] : [] },
        naturalAttack: { primaryAttack: !!a.primary },
        extraAttacks: { type: a.natural ? "" : "standard" },
        range: { units: a.range === "ranged" ? "ft" : "melee" },
      }],
    }))
  }
  // the stat block's text pieces, for reference
  const notes = [["Aura", mon.aura], ["Defensive abilities", mon.defensive], ["Special attacks", mon.specialAttacks],
    ["Spell-like abilities", mon.sla], ["Spells", mon.spells], ["Special qualities", mon.sq], ["Gear", mon.gearText]].filter(([, v]) => v)
  if (notes.length) actor.items.push(item("feat", "Stat block notes", { subType: "misc", description: { value: toHtml(notes.map(([k, v]) => `${k}: ${v}`).join("\n\n")) } }))
}

// ---------- the Monster tab ----------
panels.monster = () => {
  const mon = state.monster
  if (!mon) return [
    h("h2", {}, "Monster"),
    h("p", { class: "muted" }, "Start from any of the Pathfinder monsters (Archives of Nethys). It's rebuilt from its parts — racial Hit Dice, ability scores, natural armor, feats and skills — so changes recalculate everything. Then apply templates, add Hit Dice, class levels or sphere talents; the CR follows the Bestiary's monster advancement rules."),
    h("button", { class: "primary", onclick: () => openMonsterPicker() }, "Load a monster"),
  ]
  const c = calc()
  const r = monsterCr()
  const setMon = (k, v) => { mon[k] = v; changed() }
  const text = (k, label, hint) => {
    const el = h("input", { value: mon[k] ?? "", "aria-label": label })
    el.addEventListener("input", () => setMon(k, el.value))
    return field(label, el, hint)
  }
  const compare = [["AC", mon.printed.ac, c.ac], ["Touch", mon.printed.touch, c.touch], ["Flat-footed", mon.printed.flat, c.flat],
    ["hp", mon.printed.hp, c.hp], ["Init", mon.printed.init, c.init], ["Fort", mon.printed.fort, c.saveTotals.fort],
    ["Ref", mon.printed.ref, c.saveTotals.ref], ["Will", mon.printed.will, c.saveTotals.will], ["BAB", mon.printed.bab, c.bab],
    ["CMB", mon.printed.cmb, c.cmb], ["CMD", mon.printed.cmd, c.cmd]]
  const edited = mon.templates.length || num(mon.addedHd) || state.classes.some((cl) => !cl.racial && !cl.fromBase)
  return [
    h("div", { class: "row" }, h("h2", { style: "margin:0" }, mon.base.name), h("span", { class: "muted" }, `${mon.base.source}`),
      h("div", { class: "spacer" }), h("a", { href: mon.base.url, target: "_blank", rel: "noopener" }, "On Archives of Nethys"),
      h("button", { onclick: () => openMonsterPicker() }, "Load another"),
      h("button", { class: "primary", onclick: () => exportStatBlock() }, "Stat block")),
    // CR and XP, with each adjustment
    h("div", { class: "card" },
      h("div", { class: "group-title", style: "margin-top:0" }, `Challenge rating: CR ${r.cr} (${xpOf(r.cr).toLocaleString("en-US")} XP)`),
      h("dl", { class: "kv" }, ...r.rows.flatMap((x) => [h("dt", {}, x.label), h("dd", {}, x.base ? `CR ${mon.baseCr}` : x.cr ? signed(x.cr) : "+0")])),
      h("div", { class: "row", style: "margin-top:.5rem" },
        field("Role (for class levels)", (() => { const el = select("monster.role", ROLES); return el })(), "Table 2-4: which classes are key"),
        field("Power talents per +1 CR", input("monster.powerTalentsPerCr", { type: "number", min: 1, placeholder: "2" }, { rerender: true }), "Might and Guile talents count like feats (no CR)"),
        h("button", { class: "small", onclick: () => { mon.adjustments.push({ label: "", cr: 1 }); changed(true) } }, "+ CR adjustment")),
      ...mon.adjustments.map((a, i) => h("div", { class: "row" },
        input(`monster.adjustments.${i}.label`, { placeholder: "Why (e.g. extra special ability)" }),
        input(`monster.adjustments.${i}.cr`, { type: "number", style: "width:4rem" }, { rerender: true }),
        h("button", { class: "small danger", onclick: () => { mon.adjustments.splice(i, 1); changed(true) } }, "Remove")))),
    // printed vs rebuilt
    h("div", { class: "card" },
      h("div", { class: "group-title", style: "margin-top:0" }, edited ? "Base stat block vs now" : "Stat block vs rebuilt"),
      h("div", { class: "mon-compare" }, ...compare.map(([k, p, n]) => h("div", { class: `stat${p != null && p !== n && !edited ? " warn" : ""}` },
        h("b", {}, `${n ?? "—"}`), h("span", {}, `${k}${p != null && p !== n ? ` (book ${p})` : ""}`)))),
      edited ? null : h("p", { class: "note" }, "Highlighted numbers differ from the book: the stat block's own parts don't add up to them (or a rule the builder doesn't apply). Adjust the parts, or add a change on the matching \"(stat block)\" feature.")),
    // advancement
    h("div", { class: "card" },
      h("div", { class: "group-title", style: "margin-top:0" }, "Advancement"),
      h("div", { class: "row" },
        field("Add racial Hit Dice", (() => { const el = h("input", { type: "number", min: 0, value: num(mon.addedHd), style: "width:5rem" }); el.addEventListener("change", () => setRacialHd(+el.value)); return el })(),
          `Base ${mon.baseHd} HD. +1 to an ability per 4 HD, a feat per 2 HD; grow a size at +50% HD.`),
        h("button", { onclick: () => changeSize(1) }, "Size up"), h("button", { onclick: () => changeSize(-1) }, "Size down"),
        h("button", { onclick: () => openTemplatePicker() }, "+ Apply template"),
        h("button", { onclick: () => { tab = "classes"; renderTabs(); renderPanel() } }, "Add class levels…")),
      advancementNotes(c),
      ...mon.templates.map((t, i) => h("div", { class: "card", style: "margin:.4rem 0 0" },
        h("div", { class: "row" }, h("b", {}, `${t.name} template`), h("span", { class: "muted" }, `CR ${signed(num(t.cr))}`), h("div", { class: "spacer" }),
          h("button", { class: "small danger", onclick: () => removeTemplate(i) }, "Remove")),
        t.applied.length ? h("p", { class: "note" }, "Applied: ", t.applied.join("; ")) : null,
        t.review.length ? h("details", {}, h("summary", { class: "note" }, `${t.review.length} rule${t.review.length > 1 ? "s" : ""} to apply by hand`),
          h("ul", { class: "note" }, t.review.map((x) => h("li", {}, x)))) : null))),
    // identity, speeds, defenses
    h("div", { class: "card grid" },
      text("type", "Type"), field("Subtypes", (() => { const el = h("input", { value: mon.subtypes.join(", ") }); el.addEventListener("input", () => setMon("subtypes", el.value.split(",").map((x) => x.trim()).filter(Boolean))); return el })()),
      field("Size", select("race.size", Object.fromEntries(Object.entries(SIZES).map(([k, v]) => [k, v[0]])))),
      field("Land speed", input("race.speed", { type: "number", min: 0, step: 5 })),
      ...["fly", "swim", "climb", "burrow"].map((k) => field(`${k[0].toUpperCase()}${k.slice(1)} speed`, input(`monster.speeds.${k}`, { type: "number", min: 0, step: 5 }, { allowBlank: true }))),
      field("Hit point ability", select("monster.hpAbility", { con: "Constitution", cha: "Charisma (undead)", "": "None (construct)" }, {}, { rerender: true })),
      field("Bonus hit points", input("monster.bonusHp", { type: "number" }), "Constructs: by size"),
      text("space", "Space"), text("reach", "Reach"),
    ),
    h("div", { class: "card grid" },
      text("senses", "Senses"), text("aura", "Aura"), text("defensive", "Defensive abilities"), text("dr", "DR"),
      text("immune", "Immune"), text("resist", "Resist"), text("sr", "SR"), text("weaknesses", "Weaknesses"),
      text("specialAttacks", "Special attacks"), text("sq", "Special qualities"), text("gearText", "Gear (text)")),
    mon.sla ? h("details", { class: "card" }, h("summary", {}, "Spell-like abilities"), textarea("monster.sla", { rows: 4 })) : null,
    mon.spells ? h("details", { class: "card" }, h("summary", {}, "Spells"), textarea("monster.spells", { rows: 4 })) : null,
    // attacks
    h("h3", {}, "Attacks"),
    h("div", { class: "picked-list" }, ...mon.attacks.map((a, i) => {
      const p = `monster.attacks.${i}.`
      return h("div", { class: "card class-row", style: "margin:0" },
        field("Attack", input(p + "name", { style: "width:9rem" })),
        field("Count", input(p + "count", { type: "number", min: 1, style: "width:4rem" })),
        field("Range", select(p + "range", { melee: "Melee", ranged: "Ranged" })),
        h("div", { class: "field" }, h("span", {}, " "), checkbox(p + "natural", "Natural")),
        a.natural ? h("div", { class: "field" }, h("span", {}, " "), checkbox(p + "primary", "Primary")) : null,
        field("Damage dice", input(p + "dice", { style: "width:5rem" })),
        field("Crit", input(p + "crit", { style: "width:5rem", placeholder: "19-20/x2" })),
        field("Plus", input(p + "extra", { style: "width:8rem", placeholder: "grab" })),
        field("Attack adj.", input(p + "atkMisc", { type: "number", style: "width:4rem" }), "vs. rebuilt"),
        field("Damage adj.", input(p + "dmgMisc", { type: "number", style: "width:4rem" })),
        h("div", { class: "spacer" }),
        h("button", { class: "small danger", onclick: () => { mon.attacks.splice(i, 1); changed(true) } }, "Remove"),
        h("p", { class: "note", style: "flex-basis:100%;margin:0" }, attackText(a, c), a.printedBonus != null && !edited ? `  ·  book: ${a.printedIter.map(signed).join("/")} (${a.printedDamage})` : ""))
    })),
    h("button", { style: "margin-top:.5rem", onclick: () => { mon.attacks.push({ group: 0, range: "melee", name: "claw", count: 1, natural: true, primary: true, dice: "1d6", crit: "", extra: "", atkMisc: 0, dmgMisc: 0, enh: 0, printedBonus: null, printedIter: [], printedDamage: "" }); changed(true) } }, "+ Add attack"),
  ]
}

function advancementNotes(c) {
  const mon = state.monster
  const added = num(mon.addedHd)
  if (!added) return null
  const total = mon.baseHd + added
  const bits = [`${total} racial HD: +${Math.floor(added / 4)} ability point${Math.floor(added / 4) === 1 ? "" : "s"} to assign (Abilities tab), ${Math.max(0, Math.ceil(total / 2) - Math.ceil(mon.baseHd / 2))} more feat${Math.ceil(total / 2) - Math.ceil(mon.baseHd / 2) === 1 ? "" : "s"}.`]
  if (added >= mon.baseHd / 2) bits.push("Hit Dice went up by 50% or more: the Bestiary suggests growing a size (Size up).")
  return h("p", { class: "note" }, bits.join(" "))
}

function setRacialHd(n) {
  const mon = state.monster
  const racial = state.classes.find((cl) => cl.racial)
  if (!racial) return toast("This monster has no racial Hit Dice to add to.")
  mon.addedHd = Math.max(0, n)
  racial.level = Math.max(1, mon.baseHd + mon.addedHd)
  changed(true)
}

// Table 2-2: one size step up (or down: the reverse of the step below)
// space by size, and reach for a tall or a long creature
const SPACE = { fine: "1/2 ft.", dim: "1 ft.", tiny: "2-1/2 ft.", sm: "5 ft.", med: "5 ft.", lg: "10 ft.", huge: "15 ft.", grg: "20 ft.", col: "30 ft." }
const REACH = { fine: [0, 0], dim: [0, 0], tiny: [0, 0], sm: [5, 5], med: [5, 5], lg: [10, 5], huge: [15, 10], grg: [20, 15], col: [30, 20] }
// damage dice one size step up (Core Rulebook / Bestiary progression); down is the reverse
const DICE_UP = { "1": "1d2", "1d2": "1d3", "1d3": "1d4", "1d4": "1d6", "1d6": "1d8", "1d8": "2d6", "1d10": "2d8", "1d12": "3d6",
  "2d4": "2d6", "2d6": "3d6", "2d8": "3d8", "2d10": "4d8", "3d6": "4d6", "3d8": "4d8", "4d6": "6d6", "4d8": "6d8",
  "6d6": "8d6", "6d8": "8d8", "8d6": "12d6", "8d8": "12d8" }
const DICE_DOWN = Object.fromEntries(Object.entries(DICE_UP).map(([a, b]) => [b, a]))
Object.assign(DICE_DOWN, { "2d6": "1d8", "2d8": "1d10", "3d6": "2d6" })
const stepDice = (d, dir) => (dir > 0 ? DICE_UP[d] : DICE_DOWN[d]) ?? d

// one size step (Table 2-2): the abilities and natural armor change too unless a template sets them
// itself (stats: false); space, reach and attack damage dice always follow the size
function changeSize(dir, { stats = true, quiet = false } = {}) {
  const from = state.race.size
  const i = SIZE_ORDER.indexOf(from)
  const to = SIZE_ORDER[i + dir]
  if (!to) return
  const step = dir > 0 ? SIZE_UP[from] : SIZE_UP[to]
  const sign = dir > 0 ? 1 : -1
  const bits = []
  if (stats && step) {
    ;["str", "dex", "con"].forEach((k, n) => { if (state.abilities[k] != null) state.abilities[k] = num(state.abilities[k]) + sign * step[n] })
    if (step[3]) addNaturalArmor(sign * step[3])
    bits.push(`Str ${signed(sign * step[0])}, Dex ${signed(sign * step[1])}, Con ${signed(sign * step[2])}${step[3] ? `, natural armor ${signed(sign * step[3])}` : ""}`)
  }
  const mon = state.monster
  // tall unless its reach is shorter than a tall creature's of its size
  const reachNow = parseFloat(mon.reach) || 0
  const long = reachNow > 0 && reachNow < (REACH[from]?.[0] ?? 5)
  mon.space = SPACE[to]
  mon.reach = `${REACH[to][long ? 1 : 0]} ft.`
  for (const a of mon.attacks) if (a.natural || a.range === "melee") a.dice = stepDice(a.dice, dir)
  bits.push(`space ${mon.space}, reach ${mon.reach}, damage dice ${dir > 0 ? "up" : "down"} a step`)
  state.race.size = to
  if (!quiet) toast(`Now ${sizeName(to)}: ${bits.join("; ")}`)
  changed(true)
  return bits
}
function addNaturalArmor(v, { atLeast = false, min = null } = {}) {
  const f = state.features.find((x) => x.monster && x.name === "Armor class (stat block)")
    ?? (state.features.push(newFeature("misc", { name: "Armor class (stat block)", changes: [], monster: true, desc: "" })), state.features.at(-1))
  let ch = f.changes.find((x) => x.target === "nac")
  if (!ch) { ch = { formula: "0", target: "nac", type: "untyped", operator: "add" }; f.changes.push(ch) }
  let n = atLeast ? Math.max(num(ch.formula), v) : num(ch.formula) + v
  if (min != null) n = Math.max(min, n)
  ch.formula = String(n)
}

// ---------- templates ----------
async function openTemplatePicker() {
  const box = h("input", { type: "search", placeholder: "Search templates", "aria-label": "Search templates" })
  const results = h("div", { class: "picker-results", role: "list" }, h("p", { class: "muted" }, "Loading templates…"))
  const dlg = openDialog("Apply a template", h("div", { class: "row picker-filters" }, box), results)
  const data = await loadCompendium("pf1e/templates.json", { entries: [] })
  const render = () => {
    const q = box.value.trim().toLowerCase()
    const hits = data.entries.filter((t) => !q || t.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 80)
    fill(results, ...hits.map((t) => h("button", { class: "picker-item", role: "listitem", onclick: () => { dlg.done(); applyTemplate(t) } },
      h("span", { class: "pi-name" }, t.name, h("span", { class: "pi-meta" }, ` ${t.fields["Simple Template"] === "Yes" ? "simple" : t.fields["Acquired/Inherited Template"] ?? ""}`)),
      h("span", { class: "pi-sum" }, templateCrText(t)))))
  }
  box.addEventListener("input", render)
  render()
  box.focus()
}
const templateField = (t, ...keys) => keys.map((k) => t.fields[k]).find(Boolean) ?? ""
const templateCrText = (t) => templateField(t, "CR", "Challenge Rating") || ((t.name.match(/\(CR ([^)]+)\)/) ?? [])[1] ?? "")
// "+1", "Same as the base creature + 2", "HD 4 or less, as base creature; HD 5 to 10, as base creature +1; ..."
function templateCr(t, hd) {
  const text = templateCrText(t).replace(/[−–]/g, "-")
  // simple templates like celestial / fiendish: "+0 or +1" is +1 at 5 Hit Dice or more
  if (/^\s*\+0 or \+1\s*$/.test(text)) return hd >= 5 ? 1 : 0
  const ranges = [...text.matchAll(/HD\s*(\d+)\s*(?:or less|or fewer)[^;+]*?(?:\+\s*(\d+))?(?=;|$)|HD\s*(\d+)\s*(?:to|-)\s*(\d+)[^;+]*?(?:\+\s*(\d+))?(?=;|$)|HD\s*(\d+)\s*(?:or more|\+)[^;+]*?(?:\+\s*(\d+))?(?=;|$)/gi)]
  for (const m of ranges) {
    if (m[1] && hd <= +m[1]) return num(m[2])
    if (m[3] && hd >= +m[3] && hd <= +m[4]) return num(m[5])
    if (m[6] && hd >= +m[6]) return num(m[7])
  }
  const plus = text.match(/([+-])\s*(\d+)/)
  return plus ? (plus[1] === "-" ? -1 : 1) * +plus[2] : 0
}

const ABL_WORDS = { str: /\bstr(?:ength)?\b/i, dex: /\bdex(?:terity)?\b/i, con: /\bcon(?:stitution)?\b/i, int: /\bint(?:elligence)?\b/i,
  wis: /\bwis(?:dom)?\b/i, cha: /\bcha(?:risma)?\b/i }
// "+4 size bonus to Str and Con, -2 Dex" / "-4 Strength, -4 Con" / "+4 to all ability scores (except Int scores of 2 or less)"
function applyAbilityText(text) {
  const done = []
  for (const clause of text.replace(/[−–]/g, "-").split(/[,;]\s*(?![^()]*\))/)) {
    const v = clause.match(/([+-]\d+)/)
    if (!v) continue
    const n = +v[1]
    const keys = /all ability scores/i.test(clause) ? ABL : ABL.filter((k) => ABL_WORDS[k].test(clause.replace(/\(.*\)/, "")))
    for (const k of keys) {
      if (state.abilities[k] == null) continue
      if (/except Int scores of 2 or less/i.test(clause) && k === "int" && num(state.abilities.int) <= 2) continue
      state.abilities[k] = num(state.abilities[k]) + n
    }
    if (keys.length) done.push(`${keys.length === 6 ? "all ability scores" : keys.map((k) => k[0].toUpperCase() + k.slice(1)).join(", ")} ${signed(n)}`)
  }
  return done
}
// celestial / fiendish style defenses by Hit Dice: "Hit Dice Resist Acid, Cold, and Electricity DR 1-4 5 — 5-10 10 5/evil 11+ 15 10/evil"
function applyDefenseTable(text, hd) {
  const types = (text.match(/Resist\s+(.+?)\s+DR\b/) ?? [])[1]
  if (!types) return null
  for (const m of text.replace(/[−–]/g, "-").matchAll(/(\d+)(?:-(\d+)|\+)\s+(\d+)\s+(\S+)/g)) {
    const lo = +m[1], hi = m[2] ? +m[2] : Infinity
    if (hd < lo || hd > hi) continue
    const kinds = types.replace(/,?\s+and\s+/g, ", ").split(/,\s*/).map((x) => x.trim().toLowerCase()).filter(Boolean)
    const resist = kinds.map((k) => `${k} ${m[3]}`).join(", ")
    const dr = /\d+\/\w+/.test(m[4]) ? m[4] : ""
    return { resist, dr }
  }
  return null
}

// the parts of a template the builder can apply: size, ability scores, natural armor, type and subtypes,
// senses, defenses by Hit Dice, SR; everything else is listed to apply by hand
function applyTemplate(t) {
  const mon = state.monster
  const applied = [], review = []
  const f = t.fields
  const hd = calc().hd
  const cr = templateCr(t, hd)
  // size first (space, reach, damage dice); the template gives its own ability and armor changes
  const size = f.Size ?? ""
  if (/increase by one/i.test(size)) applied.push(...(changeSize(1, { stats: false, quiet: true }) ?? []).map((x) => `size up: ${x}`))
  else if (/decrease by one/i.test(size)) applied.push(...(changeSize(-1, { stats: false, quiet: true }) ?? []).map((x) => `size down: ${x}`))
  else if (size) review.push(`Size: ${size}`)
  const abil = templateField(t, "Abilities", "Ability Scores")
  if (abil) { const done = applyAbilityText(abil); done.length ? applied.push(...done) : review.push(`Ability scores: ${abil}`) }
  const ac = templateField(t, "Armor Class", "AC").replace(/[−–]/g, "-")
  if (ac) {
    let m
    if ((m = ac.match(/(?:increase|improve)s?\s+natural armor (?:bonus )?by\s*\+?(\d+)/i)) || (m = ac.match(/\+(\d+)\s+(?:bonus\s+to\s+)?natural armor/i) && !/whichever/i.test(ac) ? ac.match(/\+(\d+)\s+(?:bonus\s+to\s+)?natural armor/i) : null)) {
      addNaturalArmor(+m[1]); applied.push(`natural armor +${m[1]}`)
    } else if ((m = ac.match(/(?:reduce|decrease)s?\s+natural armor (?:bonus )?by\s*-?(\d+)(?:.*minimum\s*\+?(\d+))?/i))) {
      addNaturalArmor(-m[1], { min: m[2] != null ? +m[2] : null }); applied.push(`natural armor -${m[1]}`)
    } else if ((m = ac.match(/\+(\d+)\s+natural armor bonus or the base creature.s natural armor bonus, whichever is better/i))) {
      addNaturalArmor(+m[1], { atLeast: true }); applied.push(`natural armor at least +${m[1]}`)
    } else review.push(`Armor class: ${ac}`)
  }
  const type = f.Type ?? ""
  const newType = type.match(/type changes to (?:an? )?([a-z ]+?)(?:[.(,]| with|$)/i)
  if (newType && TYPE_RULES[newType[1].toLowerCase().trim()]) {
    mon.type = newType[1].toLowerCase().trim()
    applied.push(`type: ${mon.type}`)
    // undead use Charisma for hit points; constructs neither
    if (mon.type === "undead") mon.hpAbility = "cha"
    if (mon.type === "construct") mon.hpAbility = ""
    if (/do not recalculate/i.test(type)) review.push(`Type: ${type}`)
  } else if (type) review.push(`Type: ${type}`)
  const st = type.match(/\(([^)]+)\) subtype/i) || type.match(/gains? the ([a-z, ]+?) subtypes?/i)
  if (st) mon.subtypes = [...new Set([...mon.subtypes, ...st[1].split(/,\s*|\s+and\s+/).map((x) => x.trim()).filter(Boolean)])]
  // senses: "gains darkvision 60 ft." is added; anything else to review
  const senses = f.Senses ?? ""
  const gain = senses.match(/^(?:A [a-z ]+ )?gains? (.+?)\.?$/i)
  // (skipped when the monster has it already: "darkvision 60 ft.")
  const sense = gain?.[1].replace(/\.$/, "")
  if (gain && !new RegExp(sense.split(" ")[0], "i").test(mon.senses ?? "")) { mon.senses = [mon.senses, sense].filter(Boolean).join(", "); applied.push(`senses: ${sense}`) }
  else if (gain) applied.push(`senses: already has ${sense.split(" ")[0]}`)
  else if (senses) review.push(`Senses: ${senses}`)
  // DR and resistances from a table by Hit Dice (celestial, fiendish, ...)
  const tableKey = Object.keys(f).find((k) => /Defenses$/.test(k) && /Hit Dice/.test(f[k]))
  const tbl = tableKey ? applyDefenseTable(f[tableKey], hd) : null
  if (tbl) {
    if (tbl.resist) mon.resist = [mon.resist, tbl.resist].filter(Boolean).join(", ")
    if (tbl.dr) mon.dr = [mon.dr, tbl.dr].filter(Boolean).join("; ")
    applied.push(`resist ${tbl.resist}${tbl.dr ? `, DR ${tbl.dr}` : ""}`)
  }
  for (const [k, key] of [["Defensive Abilities", "defensive"], ["Special Attacks", "specialAttacks"], ["Special Qualities", "sq"],
    ["Weaknesses", "weaknesses"], ["Aura", "aura"]]) {
    if (!f[k] || (k === "Defensive Abilities" && tbl && /as noted on the table/i.test(f[k]))) continue
    review.push(`${k}: ${f[k]}`)
    mon[key] = [mon[key], `(${t.name.replace(/\s*\(CR[^)]*\)\s*$/, "")}: see template)`].filter(Boolean).join("; ")
  }
  // Hit Dice: "Change all of the creature's racial Hit Dice to d8s"; Charisma for bonus hit points
  const hdText = f["Hit Dice"] ?? ""
  const die = hdText.match(/racial Hit Dice to d(\d+)/i)
  const racialRow = state.classes.find((cl) => cl.racial)
  if (die && racialRow) { racialRow.hd = +die[1]; applied.push(`racial Hit Dice d${die[1]}`) }
  if (/Charisma modifiers? (?:to determine|for) bonus hit points/i.test(hdText)) mon.hpAbility = "cha"
  const keepAttacks = /increase|decrease/i.test(size) && /dice/i.test(f.Attacks ?? "")
  for (const k of [...(die ? [] : ["Hit Dice"]), "Speed", "Attacks", "Melee", "Damage", "Special Abilities", "Spell-Like Abilities", "Feats", "Skills", "Saves", "Languages", "Alignment", "BAB", "Quick Rules"])
    if (f[k] && !(k === "Attacks" && keepAttacks)) review.push(`${k}: ${f[k]}`)
  const entry = { name: t.name.replace(/\s*\(CR[^)]*\)\s*$/, ""), cr, applied, review, url: t.url }
  mon.templates.push(entry)
  // SR equal to the new CR + 5 (once the template's CR change is in)
  if (/SR equal to new CR \+\s*(\d+)/i.test(f.SR ?? "")) {
    const n = +(f.SR.match(/\+\s*(\d+)/)[1])
    const newCr = monsterCr().cr
    mon.sr = String((Number(newCr) || 0) + n)
    applied.push(`SR ${mon.sr}`)
  } else if (f.SR) review.push(`SR: ${f.SR}`)
  toast(`Applied ${entry.name}: CR ${signed(cr)}`)
  changed(true)
}
function removeTemplate(i) {
  // the numbers it changed stay (they may have been edited since): only the CR and notes go
  state.monster.templates.splice(i, 1)
  toast("Template removed from the CR. Changes it made to the stats stay; undo them by hand if needed.")
  changed(true)
}

// ---------- stat block ----------
function statBlockText() {
  const s = state, mon = s.monster, c = calc(), r = monsterCr()
  const al = Object.entries(ALIGN_KEYS).find(([, v]) => v === s.details.alignment)?.[0] ?? "N"
  const type = `${mon.type}${mon.subtypes.length ? ` (${mon.subtypes.join(", ")})` : ""}`
  const dice = s.classes.filter((cl) => num(cl.level) > 0).map((cl) => `${num(cl.level)}d${num(cl.hd)}`).join("+")
  const hpBonus = c.hp - Math.floor(c.classHp.reduce((a, b) => a + b, 0))
  // AC parts: armor, shield, Dex (capped by armor), natural, size, and whatever else the total holds
  const acParts = []
  const worn = s.gear.filter((g) => g.equipped && (g.kind === "armor" || g.kind === "shield"))
  const armor = worn.filter((g) => g.kind === "armor").reduce((a, g) => a + num(g.ac) + num(g.enh), 0)
  const shield = worn.filter((g) => g.kind === "shield").reduce((a, g) => a + num(g.ac) + num(g.enh), 0)
  const caps = worn.filter((g) => g.kind === "armor" && g.maxDex !== "" && g.maxDex != null).map((g) => num(g.maxDex))
  const dexAc = Math.min(c.abl.dex.mod, ...caps)
  const nat = state.features.flatMap((f) => (f.changes ?? []).filter((x) => x.target === "nac")).reduce((a, x) => a + num(x.formula), 0)
  if (armor) acParts.push(`${signed(armor)} armor`)
  if (dexAc) acParts.push(`${signed(dexAc)} Dex`)
  if (nat) acParts.push(`${signed(nat)} natural`)
  if (shield) acParts.push(`${signed(shield)} shield`)
  if (c.size) acParts.push(`${signed(c.size)} size`)
  const other = c.ac - 10 - armor - shield - dexAc - nat - c.size
  if (other) acParts.push(`${signed(other)} other`)
  const speeds = [`${num(s.race.speed)} ft.`, ...Object.entries(mon.speeds ?? {}).filter(([k, v]) => k !== "flyManeuver" && num(v))
    .map(([k, v]) => `${k} ${num(v)} ft.${k === "fly" && mon.speeds.flyManeuver ? ` (${mon.speeds.flyManeuver})` : ""}`)].join(", ")
  const melee = mon.attacks.filter((a) => a.range === "melee").map((a) => attackText(a, c)).join(", ")
  const ranged = mon.attacks.filter((a) => a.range === "ranged").map((a) => attackText(a, c)).join(", ")
  const skills = []
  for (const [k, [label]] of Object.entries(SKILLS)) {
    if (SUB_SKILLS.includes(k)) for (const sub of s.subSkills[k]) skills.push(`${label} (${sub.name}) ${signed(skillTotal(k, num(sub.rank), c, sub.ability || undefined))}`)
    else if (num(s.skills[k]) > 0) skills.push(`${label} ${signed(skillTotal(k, num(s.skills[k]), c))}`)
  }
  const feats = s.features.filter((f) => f.kind === "feat").map((f) => f.name)
  const talents = s.spheresModule ? s.talents.filter((t) => t.name).map((t) => `${t.name}${t.sphere ? ` (${label(t.sphere)})` : ""}`) : []
  const classLine = s.classes.filter((cl) => !cl.racial && num(cl.level) > 0).map((cl) => `${cl.name.toLowerCase()} ${num(cl.level)}`).join("/")
  const ab = (k) => (s.abilities[k] == null ? "—" : c.abl[k].total)
  const L = []
  L.push(`${s.name || mon.base.name}    CR ${r.cr}`)
  L.push(`XP ${xpOf(r.cr).toLocaleString("en-US")}`)
  if (classLine) L.push(`${mon.base.name} ${classLine}`)
  L.push(`${al} ${sizeName(s.race.size)} ${type}`)
  L.push(`Init ${signed(c.init)}; Senses ${[mon.senses, `Perception ${signed(skillTotal("per", num(s.skills.per), c))}`].filter(Boolean).join("; ")}`)
  if (mon.aura) L.push(`Aura ${mon.aura}`)
  L.push("", "DEFENSE")
  L.push(`AC ${c.ac}, touch ${c.touch}, flat-footed ${c.flat}${acParts.length ? ` (${acParts.join(", ")})` : ""}`)
  L.push(`hp ${c.hp} (${dice}${hpBonus ? signed(hpBonus) : ""})`)
  L.push(`Fort ${signed(c.saveTotals.fort)}, Ref ${signed(c.saveTotals.ref)}, Will ${signed(c.saveTotals.will)}`)
  const def = [mon.defensive && `Defensive Abilities ${mon.defensive}`, mon.dr && `DR ${mon.dr}`, mon.immune && `Immune ${mon.immune}`,
    mon.resist && `Resist ${mon.resist}`, mon.sr && `SR ${mon.sr}`].filter(Boolean)
  if (def.length) L.push(def.join("; "))
  if (mon.weaknesses) L.push(`Weaknesses ${mon.weaknesses}`)
  L.push("", "OFFENSE", `Speed ${speeds}`)
  if (melee) L.push(`Melee ${melee}`)
  if (ranged) L.push(`Ranged ${ranged}`)
  if (mon.space || mon.reach) L.push(`Space ${mon.space || "5 ft."}; Reach ${mon.reach || "5 ft."}`)
  if (mon.specialAttacks) L.push(`Special Attacks ${mon.specialAttacks}`)
  if (mon.sla) L.push(mon.sla)
  if (mon.spells) L.push(mon.spells)
  L.push("", "STATISTICS")
  L.push(`Str ${ab("str")}, Dex ${ab("dex")}, Con ${ab("con")}, Int ${ab("int")}, Wis ${ab("wis")}, Cha ${ab("cha")}`)
  L.push(`Base Atk ${signed(c.bab)}; CMB ${signed(c.cmb)}; CMD ${c.cmd}`)
  if (feats.length) L.push(`Feats ${feats.join(", ")}`)
  if (talents.length) L.push(`Sphere Talents ${talents.join(", ")}`)
  if (skills.length) L.push(`Skills ${skills.join(", ")}`)
  if (s.details.languages) L.push(`Languages ${s.details.languages}`)
  if (mon.sq) L.push(`SQ ${mon.sq}`)
  if (mon.gearText) L.push(`Gear ${mon.gearText}`)
  const special = s.features.filter((f) => f.kind === "misc" && f.monster && f.desc && !/\(stat block\)|Racial skill modifiers/.test(f.name))
  if (special.length) {
    L.push("", "SPECIAL ABILITIES")
    for (const f of special) L.push(`${f.name} ${f.desc}`)
  }
  return L.join("\n")
}
function exportStatBlock() {
  const textOut = statBlockText()
  const area = h("textarea", { rows: 24, style: "width:100%;font-family:ui-monospace,monospace;font-size:.85rem", readonly: true }, textOut)
  area.value = textOut
  const dlg = openDialog("Stat block", area,
    h("div", { class: "row add-row" },
      h("button", { class: "primary", onclick: async () => { try { await navigator.clipboard.writeText(textOut); toast("Copied") } catch { area.select() } } }, "Copy"),
      h("button", { onclick: () => { const b = new Blob([textOut], { type: "text/plain" }); const a = h("a", { href: URL.createObjectURL(b), download: `${fileSlug()}-statblock.txt` }); document.body.append(a); a.click(); a.remove() } }, "Download .txt"),
      h("button", { onclick: () => dlg.done() }, "Close")))
  dlg.classList.add("wide")
}

// the Monster Creator's own buttons
document.getElementById("btnPdf")?.replaceWith(h("button", { id: "btnStat", title: "The monster as a text stat block", onclick: () => (state.monster ? exportStatBlock() : toast("Load a monster first")) }, "Stat block"))
renderAll()
