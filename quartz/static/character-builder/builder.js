// Pathfinder 1e character builder that exports a Foundry VTT (pf1 system) actor file.
// Everything is typed in; nothing is pulled from compendiums. Classes still export as real
// class items (HD, BAB/save progressions, skill ranks) so Foundry derives BAB, saves and HP.
"use strict"

const STORAGE_KEY = "sop-character-builder"
const FLAG_SCOPE = "sop-builder"

const ABILITIES = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" }
const ABL = Object.keys(ABILITIES)
const SKILLS = {
  acr: ["Acrobatics", "dex", 0, 1], apr: ["Appraise", "int", 0, 0], art: ["Artistry", "int", 1, 0],
  blf: ["Bluff", "cha", 0, 0], clm: ["Climb", "str", 0, 1], crf: ["Craft", "int", 0, 0],
  dip: ["Diplomacy", "cha", 0, 0], dev: ["Disable Device", "dex", 1, 1], dis: ["Disguise", "cha", 0, 0],
  esc: ["Escape Artist", "dex", 0, 1], fly: ["Fly", "dex", 0, 1], han: ["Handle Animal", "cha", 1, 0],
  hea: ["Heal", "wis", 0, 0], int: ["Intimidate", "cha", 0, 0], kar: ["Knowledge (Arcana)", "int", 1, 0],
  kdu: ["Knowledge (Dungeoneering)", "int", 1, 0], ken: ["Knowledge (Engineering)", "int", 1, 0],
  kge: ["Knowledge (Geography)", "int", 1, 0], khi: ["Knowledge (History)", "int", 1, 0],
  klo: ["Knowledge (Local)", "int", 1, 0], kna: ["Knowledge (Nature)", "int", 1, 0],
  kno: ["Knowledge (Nobility)", "int", 1, 0], kpl: ["Knowledge (Planes)", "int", 1, 0],
  kre: ["Knowledge (Religion)", "int", 1, 0], lin: ["Linguistics", "int", 1, 0], lor: ["Lore", "int", 1, 0],
  per: ["Perception", "wis", 0, 0], prf: ["Perform", "cha", 0, 0], pro: ["Profession", "wis", 1, 0],
  rid: ["Ride", "dex", 0, 1], sen: ["Sense Motive", "wis", 0, 0], slt: ["Sleight of Hand", "dex", 1, 1],
  spl: ["Spellcraft", "int", 1, 0], ste: ["Stealth", "dex", 0, 1], sur: ["Survival", "wis", 0, 0],
  swm: ["Swim", "str", 0, 1], umd: ["Use Magic Device", "cha", 1, 0],
}
const SUB_SKILLS = ["crf", "prf", "pro"]
// PF1 "Background Skills" variant (pf1.config.backgroundSkills): 2 extra ranks per class level for these
const BG_SKILLS = ["apr", "art", "crf", "han", "ken", "kge", "khi", "kno", "lin", "lor", "prf", "pro", "slt"]
const BG_ONLY = ["art", "lor"]
const BG_PER_LEVEL = 2
const ALIGNMENTS = { lg: "Lawful Good", ng: "Neutral Good", cg: "Chaotic Good", ln: "Lawful Neutral", tn: "True Neutral", cn: "Chaotic Neutral", le: "Lawful Evil", ne: "Neutral Evil", ce: "Chaotic Evil" }
const SIZES = { fine: ["Fine", 8], dim: ["Diminutive", 4], tiny: ["Tiny", 2], sm: ["Small", 1], med: ["Medium", 0], lg: ["Large", -1], huge: ["Huge", -2], grg: ["Gargantuan", -4], col: ["Colossal", -8] }
const PROGRESSION = { high: "High", med: "Medium", low: "Low" }
const SAVE_PROG = { high: "Good", low: "Poor" }
const CASTER_PROG = { none: "None", high: "High-Caster", mid: "Mid-Caster", low: "Low-Caster" }
const TALENT_KINDS = { magic: ["magicTalent", "Magic talent"], combat: ["combatTalent", "Combat talent"], skill: ["skillTalent", "Skill talent"] }
const FEATURE_KINDS = { feat: "Feat", trait: "Trait", classFeat: "Class feature", racial: "Racial trait", misc: "Other" }
// the Feats & Features tab's add buttons (feats and traits can come from the compendium: openCompendiumChooser)
const FEATURE_ADDS = [["feat", "+ Add feat"], ["trait", "+ Add trait"], ["classFeat", "+ Add class feature"],
  ["racial", "+ Add racial trait"], ["misc", "+ Add other feature"]]
const FEATURE_PLACEHOLDERS = { feat: "Power Attack", trait: "Reactionary", classFeat: "Sneak Attack",
  racial: "Darkvision", misc: "Name" }
const SCHOOLS = { abj: "Abjuration", con: "Conjuration", div: "Divination", enc: "Enchantment", evo: "Evocation", ill: "Illusion", nec: "Necromancy", trs: "Transmutation", uni: "Universal", misc: "Other" }
const MAGIC_SPHERES = ["alteration", "bear", "blood", "conjuration", "creation", "dark", "death", "destruction", "divination", "enhancement", "fallenFey", "fate", "illusion", "life", "light", "mana", "mind", "nature", "protection", "telekinesis", "time", "war", "warp", "weather"]
const COMBAT_SPHERES = ["alchemy", "athletics", "barrage", "barroom", "beastmastery", "berserker", "boxing", "brute", "dualWielding", "duelist", "equipment", "fencing", "gladiator", "guardian", "lancer", "leadership", "openHand", "scoundrel", "scout", "shield", "sniper", "trap", "warleader", "wrestling"]
const SKILL_SPHERES = ["artifice", "bluster", "bodyControl", "communication", "faction", "herbalism", "infiltration", "investigation", "navigation", "performance", "spellhacking", "study", "subterfuge", "survivalism", "vocation"]
const sphereKind = (key) => (MAGIC_SPHERES.includes(key) ? "magic" : COMBAT_SPHERES.includes(key) ? "combat" : SKILL_SPHERES.includes(key) ? "skill" : null)
const GEAR_KINDS = { weapon: "Weapon", ammo: "Ammunition", armor: "Armor", shield: "Shield", equipment: "Wondrous / worn", consumable: "Consumable", loot: "Gear / loot" }
const ARMOR_TYPES = { lightArmor: "Light", mediumArmor: "Medium", heavyArmor: "Heavy" }
const SHIELD_TYPES = { lightShield: "Light", heavyShield: "Heavy", towerShield: "Tower", other: "Other" }
const DAMAGE_TYPES = { B: "bludgeoning", P: "piercing", S: "slashing" }
const POINT_COST = { 7: -4, 8: -2, 9: -1, 10: 0, 11: 1, 12: 2, 13: 3, 14: 5, 15: 7, 16: 10, 17: 13, 18: 17 }

const TABS = [
  ["details", "Details"], ["abilities", "Abilities"], ["race", "Race"], ["classes", "Classes"],
  ["skills", "Skills"], ["features", "Feats & Features"], ["buffs", "Buffs"], ["spheres", "Spheres"], ["spells", "Spells"],
  ["gear", "Gear"], ["notes", "Notes"], ["export", "Export"],
]

// ---------- state ----------

function blankClass(first) {
  return { name: "", level: 1, hd: 8, bab: "med", fort: "low", ref: "low", will: "low", skills: 2, classSkills: [], caster: "none", favored: !!first, fcbHp: 0, fcbSkill: 0, hpCustom: null }
}
function blankState() {
  return {
    v: 1,
    name: "",
    details: { player: "", alignment: "tn", gender: "", age: "", height: "", weight: "", deity: "", homeland: "", languages: "Common" },
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    pointBuy: 20,
    race: { ref: "", name: "", size: "med", speed: 30, mods: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, bonusFeats: 0, bonusSkillPerLevel: 0 },
    classes: [blankClass(true)],
    hpMode: "pfs",
    skills: {},
    subSkills: { crf: [], prf: [], pro: [] },
    skillAbility: {},
    bonusSkillFormula: "",
    bonusFeats: 0,
    portrait: "",
    features: [],
    buffs: [],
    talents: [],
    spheresModule: false,
    backgroundSkills: false,
    fractionalBonuses: false,
    tradeTraditions: false,
    sphere: { casting: "", practitioner: "", operative: "", tradition: "" },
    spellcasting: { cls: -1, ability: "int", type: "prepared", progression: "high" },
    spells: [],
    gear: [],
    currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
    bio: "",
    notes: "",
  }
}
// fill in any keys a saved state predates
function normalize(s) {
  const base = blankState()
  const out = { ...base, ...s }
  for (const k of ["details", "abilities", "race", "sphere", "spellcasting", "currency", "subSkills", "skillAbility"]) out[k] = { ...base[k], ...(s[k] || {}) }
  out.race.mods = { ...base.race.mods, ...(s.race?.mods || {}) }
  out.classes = (s.classes?.length ? s.classes : base.classes).map((c, i) => ({ ...blankClass(i === 0), ...c }))
  for (const k of ["features", "talents", "buffs", "spells", "gear"]) out[k] = Array.isArray(s[k]) ? s[k] : []
  return out
}

let state = load()
let tab = "details"

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return normalize(JSON.parse(raw))
  } catch {}
  return blankState()
}
let saveTimer
function save() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {}
  }, 250)
}

// ---------- derived numbers ----------

const num = (v) => (Number.isFinite(+v) ? +v : 0)
const mod = (score) => Math.floor((score - 10) / 2)
const signed = (n) => (n >= 0 ? `+${n}` : `${n}`)

// Preview numbers. Changes from features, talents and active buffs are evaluated against the
// unmodified character, then applied in a second pass (Foundry resolves them in priority order,
// so formulas that depend on other changes can differ slightly).
function calc() {
  const base = calcCore(() => 0)
  const { totals, skipped } = changeTotals(buildRollData(base))
  if (!Object.keys(totals).length) return Object.assign(base, { changeTotals: totals, changeSkipped: skipped })
  return Object.assign(calcCore((t) => totals[t] ?? 0), { changeTotals: totals, changeSkipped: skipped })
}

function calcCore(m) {
  const s = state
  const abl = {}
  for (const k of ABL) {
    const total = num(s.abilities[k]) + num(s.race.mods[k]) + m(k)
    abl[k] = { total, mod: mod(total) + m(`${k}Mod`) }
  }
  const classes = s.classes.filter((c) => num(c.level) > 0)
  const hd = classes.reduce((a, c) => a + num(c.level), 0)
  // matches pf1.config.classBABFormulas / classSavingThrowFormulas, or the Fractional Base Bonuses
  // variant: sum the fractions across classes, round down once, and add +2 once for any good save
  const frac = !!s.fractionalBonuses
  const babRate = { high: 1, med: 0.75, low: 0.5 }
  const bab = m("bab") + (frac
    ? Math.floor(classes.reduce((a, c) => a + babRate[c.bab] * num(c.level), 0))
    : classes.reduce((a, c) => a + Math.floor(babRate[c.bab] * num(c.level)), 0))
  const saves = {}
  for (const k of ["fort", "ref", "will"]) {
    if (frac) {
      const sum = classes.reduce((a, c) => a + num(c.level) / (c[k] === "high" ? 2 : 3), 0)
      saves[k] = Math.floor(sum) + (classes.some((c) => c[k] === "high") ? 2 : 0)
    } else saves[k] = classes.reduce((a, c) => a + (c[k] === "high" ? 2 + Math.floor(num(c.level) / 2) : Math.floor(num(c.level) / 3)), 0)
  }
  const classHp = s.classes.map((c, i) => classHpFor(c, i))
  const hp = classHp.reduce((a, b) => a + b, 0) + abl.con.mod * hd + classes.reduce((a, c) => a + num(c.fcbHp), 0) + m("mhp")
  const saveAbl = { fort: "con", ref: "dex", will: "wis" }
  const saveTotals = Object.fromEntries(Object.entries(saveAbl).map(([k, a]) => [k, saves[k] + abl[a].mod + m(k) + m("allSavingThrows")]))

  const size = SIZES[s.race.size]?.[1] ?? 0
  // as pf1's _applyArmorPenalties: each item's penalty is adjusted by the ACP (Armor/Shield) changes
  // (negative reduces it, floored at 0), then the worst armor and worst shield penalties are added
  let armor = 0, shield = 0, maxDex = Infinity, asf = 0
  const worstAcp = { armor: 0, shield: 0 }
  for (const g of s.gear) {
    if (!g.equipped) continue
    if (g.kind === "armor") {
      armor += num(g.ac) + num(g.enh)
      if (g.maxDex !== "" && g.maxDex != null) maxDex = Math.min(maxDex, num(g.maxDex) + m("mDexA"))
    }
    if (g.kind === "shield") shield += num(g.ac) + num(g.enh)
    if (g.kind === "armor" || g.kind === "shield") {
      const pen = Math.max(0, Math.abs(num(g.acp)) + m(g.kind === "armor" ? "acpA" : "acpS"))
      worstAcp[g.kind] = Math.max(worstAcp[g.kind], pen)
      asf += num(g.asf)
    }
  }
  // encumbrance: a medium or heavy load caps Dex to AC and sets a check penalty (the worse of it
  // and the armor's applies) and slows you down
  const enc = encumbrance(s, abl.str.total + m("carryStr"))
  if (enc.slow) maxDex = Math.min(maxDex, enc.maxDex)
  const acp = Math.max(worstAcp.armor + worstAcp.shield, enc.acp ?? 0)
  const dexAc = Math.min(abl.dex.mod, maxDex)
  const acMods = m("ac") + m("aac") + m("sac") + m("nac")
  const ac = 10 + armor + shield + dexAc + size + acMods
  const touch = 10 + dexAc + size + m("ac") + m("tac")
  const flat = 10 + armor + shield + Math.min(0, dexAc) + size + acMods + m("ffac")
  const cmb = bab + abl.str.mod - size + m("cmb")
  const cmd = 10 + bab + abl.str.mod + abl.dex.mod - size + m("cmd")
  const init = abl.dex.mod + m("init")
  const baseSpeed = num(s.race.speed) + m("landSpeed") + m("allSpeeds")
  const speed = enc.slow ? baseSpeed - 5 * Math.floor(baseSpeed / 15) : baseSpeed // 30 -> 20, 20 -> 15
  const attackMod = { melee: m("attack") + m("wattack") + m("mattack"), ranged: m("attack") + m("wattack") + m("rattack") }
  const damageMod = { melee: m("damage") + m("wdamage") + m("mwdamage") + m("mdamage"), ranged: m("damage") + m("wdamage") + m("rwdamage") + m("rdamage") }
  const skillExtra = (k, a, rank) => m("skills") + m(`${a}Skills`) + m(`skill.${k}`) + (rank ? 0 : m("unskills"))

  const classSkills = new Set(classes.flatMap((c) => c.classSkills))
  let skillBudget = 0
  for (const c of classes) skillBudget += Math.max(1, num(c.skills) + abl.int.mod) * num(c.level) + num(c.fcbSkill)
  skillBudget += num(s.race.bonusSkillPerLevel) * hd
  const bonusSkill = evalFormula(s.bonusSkillFormula, { attributes: { hd: { total: hd } }, abilities: { int: { mod: abl.int.mod } } })
  if (bonusSkill.value != null) skillBudget += Math.floor(bonusSkill.value)
  skillBudget += m("bonusSkillRanks")
  // background ranks overspent spill into the normal pool, as in the PF1 system
  let normalUsed = 0, bgUsed = 0
  for (const k of Object.keys(SKILLS)) {
    if (BG_ONLY.includes(k) && !s.backgroundSkills) continue
    let r = num(s.skills[k])
    if (SUB_SKILLS.includes(k)) r += s.subSkills[k].reduce((a, e) => a + num(e.rank), 0)
    if (s.backgroundSkills && BG_SKILLS.includes(k)) bgUsed += r
    else normalUsed += r
  }
  const bgBudget = s.backgroundSkills ? BG_PER_LEVEL * hd : 0
  const ranksUsed = normalUsed + Math.max(0, bgUsed - bgBudget)

  const featSlots = Math.ceil(hd / 2) + num(s.race.bonusFeats) + num(s.bonusFeats) + m("bonusFeats")
  const featsTaken = s.features.filter((f) => f.kind === "feat").length
  // pf1spheres: CL = sum of progression x level (capped at HD); MSB/MSD base = levels in casting classes
  const casters = s.spheresModule ? classes.filter((c) => c.caster !== "none") : []
  // pf1spheres rounds per class unless Fractional Base Bonuses is on
  const clPart = (c) => ({ low: 0.5, mid: 0.75, high: 1 }[c.caster] ?? 0) * num(c.level)
  const sm = (t) => (s.spheresModule ? m(t) : 0)
  const cl = Math.min(hd, Math.floor(casters.reduce((a, c) => a + (frac ? clPart(c) : Math.floor(clPart(c))), 0))) + sm("spherecl")
  const msb = casters.reduce((a, c) => a + num(c.level), 0) + sm("msb")
  const castMod = s.sphere.casting ? abl[s.sphere.casting].mod : 0
  const spheres = { cl, msb, msd: 11 + msb + sm("msd"), concentration: msb + castMod + sm("sphereConcentration"), talents: {} }
  for (const t of s.talents) if (t.sphere && !t.exclude) spheres.talents[t.sphere] = (spheres.talents[t.sphere] ?? 0) + 1
  const pointsSpent = ABL.reduce((a, k) => a + (POINT_COST[num(s.abilities[k])] ?? NaN), 0)
  return { abl, hd, bab, saves, saveTotals, hp, classHp, enc, ac, touch, flat, cmb, cmd, init, speed, attackMod, damageMod, skillExtra, acp, asf, classSkills, skillBudget, bonusSkill, ranksUsed, bgUsed, bgBudget, featSlots, featsTaken, cl, spheres, pointsSpent, size }
}

function classHpFor(c, i) {
  const lvl = num(c.level), hd = num(c.hd)
  if (lvl <= 0) return 0
  if (state.hpMode === "custom") return num(c.hpCustom ?? 0)
  if (state.hpMode === "max") return hd * lvl
  // PFS style: max at the character's first level, then half + 1
  const fixed = hd / 2 + 1
  return i === 0 ? hd + (lvl - 1) * fixed : lvl * fixed
}

// ---------- tiny DOM helpers ----------

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue
    if (k === "class") el.className = v
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v)
    else if (k === "value") el.value = v
    else if (k === "checked") el.checked = !!v
    else if (k === "html") el.innerHTML = v
    else el.setAttribute(k, v === true ? "" : v)
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : String(kid))
  return el
}
// replace an element's contents, skipping empty (null / false) parts (replaceChildren would print "null")
function fill(el, ...kids) {
  el.replaceChildren(...kids.flat().filter((k) => k != null && k !== false))
}
function getPath(obj, path) {
  return path.split(".").reduce((o, k) => o?.[k], obj)
}
function setPath(obj, path, v) {
  const keys = path.split(".")
  const last = keys.pop()
  keys.reduce((o, k) => o[k], obj)[last] = v
}
// input bound to a state path; numeric inputs store numbers
function input(path, attrs = {}, opts = {}) {
  const isNum = attrs.type === "number"
  const el = h("input", { ...attrs, value: getPath(state, path) ?? "" })
  el.addEventListener("input", () => {
    setPath(state, path, isNum ? (el.value === "" ? (opts.allowBlank ? "" : 0) : +el.value) : el.value)
    changed(opts.rerender)
  })
  return el
}
function select(path, options, attrs = {}, opts = {}) {
  const cur = getPath(state, path)
  const el = h("select", attrs, ...Object.entries(options).map(([v, label]) => h("option", { value: v, selected: String(v) === String(cur) }, label)))
  el.addEventListener("change", () => {
    setPath(state, path, opts.number ? +el.value : el.value)
    changed(opts.rerender ?? true)
  })
  return el
}
function textarea(path, attrs = {}) {
  const el = h("textarea", { ...attrs, value: getPath(state, path) ?? "" })
  el.addEventListener("input", () => {
    setPath(state, path, el.value)
    changed()
  })
  return el
}
function checkbox(path, label, opts = {}) {
  const el = h("input", { type: "checkbox", checked: getPath(state, path) })
  el.addEventListener("change", () => {
    setPath(state, path, el.checked)
    changed(opts.rerender ?? true)
  })
  return h("label", { class: "row", style: "gap:.3rem" }, el, label)
}
function field(label, control, hint) {
  return h("label", { class: "field" }, h("span", {}, label), control, hint ? h("span", { class: "note" }, hint) : null)
}

// ---------- class data (the site's compendium) ----------
// Spheres classes (compendium/classes.json) and Pathfinder classes from Archives of Nethys
// (compendium/pf1e/class-stats.json), so picking a class fills in its HD, BAB, saves, skills,
// class skills and caster progression. Loaded once; the class tab re-renders when it arrives.
const CLASS_DATA = { list: [], byKey: {}, loaded: false }
const CLASS_GROUP_ORDER = ["Spherecaster Classes", "Operative Classes", "Practitioner Classes", "Champion Classes",
  "Prestige Classes", "Pathfinder Classes", "Pathfinder Prestige Classes"]
async function loadClassData() {
  const get = (url) => fetch(url).then((r) => (r.ok ? r.json() : { classes: [] })).catch(() => ({ classes: [] }))
  const [spheres, pf] = await Promise.all([get("../compendium/classes.json"), get("../compendium/pf1e/class-stats.json")])
  // `key` identifies a listed class ("ref" is taken: it's the Reflex save progression)
  const list = [
    ...spheres.classes.map((c) => ({ ...c, key: `spheres:${c.name}`, label: c.name.replace(/ \(Prestige Class\).*$/, "") })),
    ...pf.classes.map((c) => ({ ...c, key: `pf1e:${c.name}`, label: c.name,
      group: c.prestige ? "Pathfinder Prestige Classes" : "Pathfinder Classes" })),
  ].filter((c) => c.hd)
  CLASS_DATA.list = list
  CLASS_DATA.byKey = Object.fromEntries(list.map((c) => [c.key, c]))
  CLASS_DATA.loaded = true
  if (tab === "classes") renderPanel()
}

// ---------- feats and traits (the site's compendium) ----------
// An index (feats-index.json, traits-index.json) lists every Spheres entry and every Pathfinder one
// from Archives of Nethys with a one-line summary; a picked entry's full text comes from its file
// (feats.json / pf1e/feats.json, ...), fetched when first needed.
const PICKERS = {
  feat: { noun: "feat", index: "feats-index.json", cats: (e) => e.types, catLabel: "All types",
    req: (e) => e.prerequisites, reqLabel: "Prerequisites" },
  trait: { noun: "trait", index: "traits-index.json", cats: (e) => e.categories, catLabel: "All categories",
    req: (e) => e.requirements, reqLabel: "Requirements" },
  // a race's own features (standard racial traits) and the alternate racial traits that replace them
  racial: { noun: "racial trait", index: "racial-traits-index.json", cats: (e) => [e.kind],
    catLabel: "Standard and alternate", req: (e) => e.replaces, reqLabel: "Replaces", byRace: true },
  // one sphere's talents (Spheres tab): its talent sections, packages and advanced / legendary /
  // exceptional talents from compendium/index.json; the picker is scoped to that sphere
  talent: { noun: "talent", index: "index.json", cats: (e) => [e.group || TALENT_ENTRY_KINDS[e.kind]],
    catLabel: "All talents", req: (e) => e.options?.join(", "), reqLabel: "Options", scoped: true,
    filter: (e, ctx) => e.sphere === label(ctx.sphere) && e.kind in TALENT_ENTRY_KINDS,
    title: (ctx) => `Add ${label(ctx.sphere)} talent`,
    meta: (e) => [TALENT_ENTRY_KINDS[e.kind], ...(e.tags ?? []).map((t) => `(${t})`), ...(e.talentTags ?? []).map((t) => `[${t}]`)].join(" "),
    custom: (ctx) => addTalent(ctx.sphere),
    onPick: (f, full, ctx) => addTalent(ctx.sphere, {
      name: f.name, tags: f.tags?.join(", ") ?? "", ref: f.id,
      desc: [mdToText(full?.md ?? f.summary), ...(full?.options ?? []).map((o) => `${o.name}\n${mdToText(o.md)}`)].filter(Boolean).join("\n\n"),
    }) },
}
// the compendium entry kinds a sphere's talent picker offers
const TALENT_ENTRY_KINDS = { talent: "Talent", package: "Package", "advanced talent": "Advanced talent",
  "legendary talent": "Legendary talent", "exceptional talent": "Exceptional talent" }
const COMPENDIUM_FILES = {}
function loadCompendium(file, empty) {
  COMPENDIUM_FILES[file] ??= fetch(`../compendium/${file}`).then((r) => (r.ok ? r.json() : empty))
    .catch(() => empty)
  return COMPENDIUM_FILES[file]
}

// compendium markdown -> the plain text the description box holds
function mdToText(md) {
  return (md || "")
    .replace(/^# [^\n]*\n+/, "") // Archives of Nethys entries repeat the name as a heading
    .replace(/\[\[(?:[^\]|]*\\?\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1$2")
    .replace(/\\\|/g, "|")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function newFeature(kind, extra = {}) {
  return { name: "", kind, desc: "", changes: [], notes: [], ...extra }
}
function addFeature(kind, extra = {}) {
  state.features.push(newFeature(kind, extra))
  changed(true)
  if (!extra.name) focusNewEntry()
}

// a modal on top of the builder; returns the <dialog>, which dlg.done() closes and removes
function openDialog(title, ...body) {
  const dlg = h("dialog", { class: "picker", "aria-label": title },
    h("div", { class: "picker-head" }, h("h3", {}, title),
      h("button", { class: "small ghost", "aria-label": "Close", onclick: () => dlg.done() }, "✕")),
    ...body)
  dlg.done = () => {
    if (dlg.open) dlg.close()
    dlg.remove()
  }
  dlg.addEventListener("close", () => dlg.remove()) // Escape
  // a click on the backdrop (the dialog element itself, outside its content) closes it
  dlg.addEventListener("click", (ev) => { if (ev.target === dlg) dlg.done() })
  document.body.append(dlg)
  dlg.showModal()
  return dlg
}

// "Add feat" / "Add trait" / "Add racial trait": from the compendium, or a blank one to fill in
// ctx: what the picker is for (a talent picker's sphere)
function openCompendiumChooser(kind, ctx = {}) {
  const P = PICKERS[kind]
  const { noun } = P
  const dlg = openDialog(P.title ? P.title(ctx) : `Add ${noun}`,
    h("p", { class: "muted" }, `Pick a ${noun} from the compendium to fill in its name and rules text, or add your own.`),
    h("div", { class: "row add-row" },
      h("button", { class: "primary", onclick: () => { dlg.done(); openCompendiumSearch(kind, ctx) } }, "From the compendium"),
      h("button", { onclick: () => { dlg.done(); P.custom ? P.custom(ctx) : addFeature(kind) } }, `Custom ${noun}`)))
}

function openCompendiumSearch(kind, ctx = {}) {
  const P = PICKERS[kind]
  const box = h("input", { type: "search", placeholder: `Search ${P.noun}s by name`, "aria-label": `Search ${P.noun}s` })
  const systems = { all: "All systems", "Pathfinder 1e": "Pathfinder" }
  if (state.spheresModule) Object.assign(systems, { spheres: "All Spheres", "Spheres of Power": "Spheres of Power",
    "Spheres of Might": "Spheres of Might", "Spheres of Guile": "Spheres of Guile", Champions: "Champions" })
  const sys = h("select", { "aria-label": "System" },
    ...Object.entries(systems).map(([v, label]) => h("option", { value: v }, label)))
  const cat = h("select", { "aria-label": P.catLabel }, h("option", { value: "" }, P.catLabel))
  // search the rules text as well as names (each entry's full text is fetched the first time)
  const fullText = h("input", { type: "checkbox" })
  // racial traits: only the chosen race's (and those any race can take)
  const raceName = currentRaceName()
  const onlyRace = h("input", { type: "checkbox", checked: !!raceName, disabled: !raceName })
  const results = h("div", { class: "picker-results", role: "list" }, h("p", { class: "muted" }, `Loading ${P.noun}s…`))
  const dlg = openDialog(`${P.title ? P.title(ctx) : `Add ${P.noun}`} from the compendium`,
    h("div", { class: "row picker-filters" }, box, P.scoped ? null : sys, cat),
    h("div", { class: "row picker-filters" },
      h("label", { class: "row", style: "gap:.3rem" }, fullText, "Search rules text too"),
      P.byRace ? h("label", { class: "row", style: "gap:.3rem" }, onlyRace,
        raceName ? `Only ${raceName} racial traits` : "Only my race's racial traits (pick a race on the Race tab)") : null),
    state.spheresModule || P.scoped ? null : h("p", { class: "note" }, `Spheres ${P.noun}s are listed when Spheres is turned on.`),
    results)
  let all = []
  let texts = null // entry id -> lowercased rules text, once loaded for the text search
  const pick = async (f) => {
    fill(results, h("p", { class: "muted" }, `Adding ${f.name}…`))
    const data = await loadCompendium(f.file, { entries: [] })
    const full = data.entries.find((x) => (f.ref ? x.name === f.ref : x.id === f.id))
    if (P.onPick) P.onPick(f, full, ctx)
    else addFeature(kind, { name: f.name, desc: mdToText(full?.md ?? f.summary), ref: f.id })
    dlg.done()
  }
  const loadTexts = async () => {
    const files = [...new Set(all.map((f) => f.file))]
    const datas = await Promise.all(files.map((file) => loadCompendium(file, { entries: [] })))
    const byId = {}, byName = {}
    datas.forEach((d, i) => d.entries.forEach((x) => {
      if (x.id) byId[`${files[i]}|${x.id}`] = x.md
      byName[`${files[i]}|${x.name}`] = x.md
    }))
    // an index entry finds its text by id, or (Archives of Nethys entries) by its file's own name for it
    const find = (f) => (f.ref ? byName[`${f.file}|${f.ref}`] : byId[`${f.file}|${f.id}`])
    texts = Object.fromEntries(all.map((f) => [f.id, mdToText(find(f) || f.summary || "").toLowerCase()]))
  }
  const raceMatch = (f) => !P.byRace || !onlyRace.checked || f.race === "Any"
    || f.race.toLowerCase() === raceName.toLowerCase()
  // a scoped picker (one sphere's talents) has already narrowed its list
  const inSystem = (f) => P.scoped || (state.spheresModule || isPf(f))
    && (sys.value === "all" || f.system === sys.value || (sys.value === "spheres" && !isPf(f)))
  // the type / category list follows the other filters (a category picked earlier stays if it still has entries)
  const fillCategories = () => {
    const counts = {}
    for (const f of all) if (inSystem(f) && raceMatch(f)) for (const c of P.cats(f)) counts[c] = (counts[c] || 0) + 1
    const keep = cat.value in counts ? cat.value : ""
    cat.replaceChildren(h("option", { value: "" }, P.catLabel),
      ...Object.keys(counts).sort((a, b) => a.localeCompare(b))
        .map((c) => h("option", { value: c, selected: c === keep }, `${c} (${counts[c]})`)))
    cat.value = keep
  }
  const render = () => {
    const q = box.value.trim().toLowerCase()
    const inText = fullText.checked && texts
    const hits = all.filter((f) => inSystem(f) && raceMatch(f) && (!cat.value || P.cats(f).includes(cat.value))
      && (!q || f.name.toLowerCase().includes(q) || (inText && texts[f.id]?.includes(q))))
    // names containing the search first (those starting with it before those), then alphabetical
    const rank = (f) => (!q ? 0 : f.name.toLowerCase().startsWith(q) ? 0 : f.name.toLowerCase().includes(q) ? 1 : 2)
    hits.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
    const shown = hits.slice(0, 60)
    fill(results, 
      ...shown.map((f) => h("button", { class: "picker-item", role: "listitem", onclick: () => pick(f) },
        h("span", { class: "pi-name" }, f.name,
          h("span", { class: "pi-meta" }, P.meta ? ` ${P.meta(f)}` : ` ${P.cats(f).join(", ")}${P.byRace ? ` · ${f.race}` : ""} · ${isPf(f) ? "Pathfinder" : f.system}`)),
        f.summary ? h("span", { class: "pi-sum" }, f.summary) : null,
        P.req(f) ? h("span", { class: "pi-pre" }, `${P.reqLabel}: ${mdToText(P.req(f))}`) : null)),
      hits.length > shown.length ? h("p", { class: "note" }, `Showing ${shown.length} of ${hits.length}; type more${cat.value ? "" : ` or pick ${kind === "feat" ? "a type" : "a category"}`} to narrow it down.`) : null,
      hits.length ? null : h("p", { class: "muted" }, all.length ? `No ${P.noun}s match.` : `Couldn't load the ${P.noun} list.`))
  }
  box.addEventListener("input", render)
  sys.addEventListener("change", () => { fillCategories(); render() })
  cat.addEventListener("change", render)
  onlyRace.addEventListener("change", () => { fillCategories(); render() })
  fullText.addEventListener("change", async () => {
    if (fullText.checked && !texts) {
      fill(results, h("p", { class: "muted" }, "Loading rules text…"))
      await loadTexts()
    }
    render()
  })
  loadCompendium(P.index, []).then((list) => {
    all = P.scoped ? list.filter((f) => P.filter(f, ctx)) : list
    fillCategories()
    render()
  })
  box.focus()
}
// a class's page: Spheres pages are on this site (the builder lives at static/character-builder/)
function classLink(d) {
  return d.system === "Pathfinder" ? d.url : `../../${d.url}`
}

function classPicker(cls) {
  const groups = {}
  // Spheres classes only when "Spheres for PF1e" is on (a row already set to one keeps it listed)
  for (const c of CLASS_DATA.list) {
    if (c.system === "Spheres" && !state.spheresModule && c.key !== cls.classRef) continue
    ;(groups[c.group] ??= []).push(c)
  }
  const order = [...CLASS_GROUP_ORDER, ...Object.keys(groups).filter((g) => !CLASS_GROUP_ORDER.includes(g))]
  const el = h("select", { style: "width:14rem" },
    h("option", { value: "", selected: !cls.classRef }, CLASS_DATA.loaded ? "Custom (enter below)" : "Loading classes…"),
    ...order.filter((g) => groups[g]).map((g) => h("optgroup", { label: g },
      ...groups[g].sort((a, b) => a.label.localeCompare(b.label)).map((c) =>
        h("option", { value: c.key, selected: c.key === cls.classRef }, c.label)))))
  el.addEventListener("change", () => {
    const d = CLASS_DATA.byKey[el.value]
    cls.classRef = el.value  // the listed class this row was filled from ("" = custom)
    if (d) {
      cls.name = d.label
      cls.hd = d.hd ?? cls.hd
      cls.bab = d.bab ?? cls.bab
      cls.fort = d.fort ?? cls.fort
      cls.ref = d.ref ?? cls.ref
      cls.will = d.will ?? cls.will
      cls.skills = d.skills ?? cls.skills
      // with trade traditions, class skills come from the tradition and multiclass trade talents
      if (!state.tradeTraditions) cls.classSkills = [...(d.classSkills ?? [])]
      cls.caster = d.caster ?? cls.caster
    }
    changed(true)
  })
  return el
}

// ---------- races (the site's compendium) ----------
// compendium/races.json: Pathfinder races (Archives of Nethys) and the Spheres races, with the size,
// speed, ability adjustments and bonus feat / skill rank picking one fills in.
const RACE_DATA = { list: [], byId: {}, loaded: false }
async function loadRaceData() {
  const data = await loadCompendium("races.json", { races: [] })
  RACE_DATA.list = data.races
  RACE_DATA.byId = Object.fromEntries(data.races.map((r) => [r.id, r]))
  RACE_DATA.loaded = true
  if (tab === "race") renderPanel()
}
const isPf = (e) => e.system === "Pathfinder 1e"

function racePicker() {
  const race = state.race
  // Spheres races only when "Spheres for PF1e" is on (a race already picked stays listed), as for classes
  const shown = RACE_DATA.list.filter((r) => isPf(r) || state.spheresModule || r.id === race.ref)
  const groups = { "Pathfinder Races": shown.filter(isPf), "Spheres Races": shown.filter((r) => !isPf(r)) }
  const el = h("select", { style: "width:100%" },
    h("option", { value: "", selected: !race.ref }, RACE_DATA.loaded ? "Custom (enter below)" : "Loading races…"),
    ...Object.entries(groups).filter(([, rs]) => rs.length).map(([g, rs]) => h("optgroup", { label: g },
      ...rs.sort((a, b) => a.name.localeCompare(b.name)).map((r) =>
        h("option", { value: r.id, selected: r.id === race.ref }, r.name)))))
  el.addEventListener("change", () => {
    const r = RACE_DATA.byId[el.value]
    race.ref = el.value // the listed race this was filled from ("" = custom)
    if (r) {
      race.name = r.name
      race.size = r.size
      race.speed = r.speed
      race.subrace = "" // ability adjustments are shown, not applied: see raceChoices()
      race.flexAbility = ""
      race.bonusFeats = r.bonusFeats
      race.bonusSkillPerLevel = r.bonusSkillPerLevel
    }
    changed(true)
  })
  return el
}
const fmtMods = (m) => ABL.filter((k) => num(m?.[k])).map((k) => `${signed(num(m[k]))} ${ABILITIES[k].slice(0, 3)}`).join(", ")

// a listed race's ability adjustments: shown, not applied (many races have a choice or alternate
// scores: a human's +2 to any one score, an aasimar's heritage), with its subraces / heritages and
// the adjustments the choices come to, which "Apply" copies into the boxes below
function raceChoices() {
  const r = RACE_DATA.byId[state.race.ref]
  if (!r) return null
  const race = state.race
  const sub = r.subraces?.find((s) => s.name === race.subrace)
  let result = sub?.mods ?? r.mods
  if (r.flexMod && !sub?.mods && race.flexAbility) result = { ...result, [race.flexAbility]: num(result[race.flexAbility]) + 2 }
  const choose = (key, options, blank) => {
    const el = h("select", { style: "width:100%" }, h("option", { value: "" }, blank),
      ...options.map(([v, label]) => h("option", { value: v, selected: v === race[key] }, label)))
    el.addEventListener("change", () => { race[key] = el.value; changed(true) })
    return el
  }
  const needsChoice = r.flexMod && !sub?.mods && !race.flexAbility
  return h("div", { class: "card", style: "margin:.5rem 0" },
    h("p", { class: "note", style: "margin-top:0" }, "Filled in from ",
      h("a", { href: isPf(r) ? r.url : `../../${r.url}`, target: "_blank" }, r.name),
      isPf(r) ? " (Archives of Nethys)" : "", ". Edit any field as needed; add its racial traits on the Feats & Features tab with “+ Add racial trait”."),
    h("p", { style: "margin:.25rem 0" }, h("strong", {}, "Default ability adjustments: "),
      [fmtMods(r.mods), r.flexMod ? "+2 to one ability score of your choice" : ""].filter(Boolean).join(", ") || "none"),
    h("div", { class: "grid" },
      r.subraces?.length ? field("Subrace / heritage", choose("subrace", r.subraces.map((s) => [s.name,
        s.mods ? `${s.name} (${fmtMods(s.mods)})` : s.name]), "None (standard)")) : null,
      r.flexMod && !sub?.mods ? field("+2 to", choose("flexAbility", ABL.map((k) => [k, ABILITIES[k]]), "Choose…")) : null),
    sub ? h("p", { class: "note" }, sub.summary) : null,
    h("div", { class: "row", style: "gap:.5rem;align-items:center;flex-wrap:wrap" },
      h("span", {}, h("strong", {}, "Comes to: "), needsChoice ? "choose the +2 above" : fmtMods(result) || "no adjustments"),
      h("button", { class: "small", disabled: needsChoice, onclick: () => { race.mods = { ...race.mods, ...Object.fromEntries(ABL.map((k) => [k, num(result[k])])) }; changed(true) } },
        "Apply to the ability adjustments below")),
    h("p", { class: "note", style: "margin-bottom:0" }, "These aren't applied automatically: some races have alternate ability scores or a choice (like an aasimar's heritage). Apply them, or set the adjustments below yourself."))
}

// the race whose racial traits the picker offers: the listed race, else the name typed in
function currentRaceName() {
  return (RACE_DATA.byId[state.race.ref]?.name ?? state.race.name ?? "").trim()
}

function changed(rerender) {
  save()
  renderSummary()
  renderHeader()
  renderTabs()
  if (rerender) renderPanel()
  else document.getElementById("carry-card")?.replaceWith(carryCard())
}

function toast(msg) {
  const t = document.getElementById("toast")
  t.textContent = msg
  t.hidden = false
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => (t.hidden = true), 3500)
}

// ---------- header, tabs, summary ----------

function renderHeader() {
  const nameEl = document.getElementById("charName")
  if (document.activeElement !== nameEl) nameEl.value = state.name
  document.getElementById("spheresToggle").checked = !!state.spheresModule
  const classes = state.classes.filter((c) => c.name && num(c.level) > 0).map((c) => `${c.name} ${c.level}`)
  const bits = [ALIGNMENTS[state.details.alignment], state.race.name, classes.join(" / ")].filter(Boolean)
  document.getElementById("charLine").textContent = bits.join(" · ") || "Pathfinder 1e character for Foundry VTT"
}

function visibleTabs() {
  return TABS.filter(([id]) => id !== "spheres" || state.spheresModule)
}
function renderTabs() {
  if (!visibleTabs().some(([id]) => id === tab)) tab = "details"
  const counts = { features: state.features.length, buffs: state.buffs.length, spheres: state.talents.length, spells: state.spells.length, gear: state.gear.length }
  const nav = document.getElementById("tabs")
  nav.replaceChildren(
    ...visibleTabs().map(([id, label]) =>
      h("button", { role: "tab", "aria-selected": String(id === tab), onclick: () => { tab = id; renderTabs(); renderPanel() } },
        label, counts[id] ? h("span", { class: "count" }, counts[id]) : null),
    ),
  )
}

function renderSummary() {
  const c = calc()
  const stat = (label, v) => h("div", { class: "stat" }, h("b", {}, v), h("span", {}, label))
  const budget = (label, used, total) =>
    h("div", { class: "budget" }, h("span", {}, label), h("span", { class: used > total ? "warn" : used === total ? "ok" : "" }, `${used} / ${total}`))
  document.getElementById("summary").replaceChildren(...[
    h("div", { class: "card" },
      h("div", { class: "stat-grid" },
        ...ABL.map((k) => stat(k.toUpperCase(), `${c.abl[k].total} (${signed(c.abl[k].mod)})`)),
      ),
    ),
    h("div", { class: "card" },
      h("div", { class: "stat-grid" }, stat("HP", c.hp), stat("AC", c.ac), stat("Init", signed(c.init))),
      h("dl", { class: "kv", style: "margin-top:.6rem" },
        h("dt", {}, "Touch / flat-footed"), h("dd", {}, `${c.touch} / ${c.flat}`),
        h("dt", {}, "BAB"), h("dd", {}, signed(c.bab)),
        h("dt", {}, "CMB / CMD"), h("dd", {}, `${signed(c.cmb)} / ${c.cmd}`),
        h("dt", {}, "Fort"), h("dd", {}, signed(c.saveTotals.fort)),
        h("dt", {}, "Ref"), h("dd", {}, signed(c.saveTotals.ref)),
        h("dt", {}, "Will"), h("dd", {}, signed(c.saveTotals.will)),
        h("dt", {}, "Speed"), h("dd", {}, `${c.speed} ft.`),
        c.acp ? h("dt", {}, "Armor check penalty") : null, c.acp ? h("dd", {}, `−${c.acp}`) : null,
      ),
    ),
    state.spheresModule
      ? h("div", { class: "card" },
          h("div", { class: "group-title", style: "margin-top:0" }, "Spheres"),
          h("div", { class: "stat-grid" }, stat("CL", c.spheres.cl), stat("MSB", signed(c.spheres.msb)), stat("MSD", c.spheres.msd)),
          h("dl", { class: "kv", style: "margin-top:.6rem" },
            h("dt", {}, "Concentration"), h("dd", {}, signed(c.spheres.concentration)),
            h("dt", {}, "Talents"), h("dd", {}, state.talents.filter((t) => !t.exclude).length),
          ),
        )
      : null,
    h("div", { class: "card" },
      budget("Skill ranks", c.ranksUsed, c.skillBudget),
      state.backgroundSkills ? budget("Background ranks", Math.min(c.bgUsed, c.bgBudget), c.bgBudget) : null,
      budget("Feats", c.featsTaken, c.featSlots),
      h("div", { class: "budget" }, h("span", {}, "Character level"), h("span", {}, c.hd)),
      Object.keys(c.changeTotals).length || c.changeSkipped.length
        ? h("p", { class: "note", style: "margin:.4rem 0 0" },
            `${Object.keys(c.changeTotals).length ? "Includes changes from features, talents and active buffs" : "No changes applied"}${c.changeSkipped.length ? `; ${c.changeSkipped.length} change${c.changeSkipped.length > 1 ? "s" : ""} only Foundry can work out` : ""}.`)
        : null,
      h("p", { class: "note", style: "margin:.4rem 0 0" }, "Preview only. Foundry recalculates everything when the file is imported."),
    ),
  ].filter(Boolean))
}

// ---------- panels ----------

const panels = {
  details() {
    return [
      h("h2", {}, "Details"),
      h("div", { class: "grid" },
        field("Player", input("details.player")),
        field("Alignment", select("details.alignment", ALIGNMENTS)),
        field("Deity", input("details.deity")),
        field("Homeland", input("details.homeland")),
        field("Gender", input("details.gender")),
        field("Age", input("details.age")),
        field("Height", input("details.height")),
        field("Weight", input("details.weight")),
      ),
      h("div", { style: "margin-top:.75rem" },
        field("Languages", input("details.languages", { placeholder: "Common, Elven, …" }), "Separate with commas."),
      ),
      h("h3", {}, "Portrait"),
      h("div", { class: "card row portrait-row" },
        state.portrait
          ? h("img", { class: "portrait-preview", src: state.portrait, alt: "Character portrait" })
          : h("div", { class: "portrait-preview empty" }, "No image"),
        h("div", { class: "field", style: "flex:1 1 220px" },
          h("span", {}, "Character image"),
          h("div", { class: "row" },
            h("label", { class: "button" }, state.portrait ? "Replace image" : "Choose image",
              h("input", { type: "file", accept: "image/png,image/jpeg,image/webp", hidden: true, onchange: (e) => e.target.files[0] && loadPortrait(e.target.files[0]) })),
            state.portrait ? h("button", { class: "danger", onclick: () => { state.portrait = ""; changed(true) } }, "Remove") : null,
          ),
          h("span", { class: "note" }, "Shown on the PDF sheet. It's resized and kept in this browser and in builder saves; it isn't put in the Foundry file."),
        ),
      ),
    ]
  },

  abilities() {
    const c = calc()
    const rows = ABL.map((k) => {
      const base = num(state.abilities[k]), racial = num(state.race.mods[k])
      const step = (d) => () => { state.abilities[k] = base + d; changed(true) }
      return h("div", { class: "card ability" },
        h("div", { class: "abbr" }, k.toUpperCase()),
        h("div", { class: "muted" }, ABILITIES[k]),
        h("div", { class: "stepper" },
          h("button", { class: "small", onclick: step(-1), "aria-label": `Lower ${ABILITIES[k]}` }, "−"),
          input(`abilities.${k}`, { type: "number", min: 1, max: 40, "aria-label": `${ABILITIES[k]} base score` }, { rerender: false }),
          h("button", { class: "small", onclick: step(1), "aria-label": `Raise ${ABILITIES[k]}` }, "+"),
        ),
        h("div", { class: "total" }, c.abl[k].total),
        h("div", { class: "mod" }, signed(c.abl[k].mod)),
        h("div", { class: "parts" }, racial ? `base ${base}, racial ${signed(racial)}` : ""),
      )
    })
    const spent = Number.isNaN(c.pointsSpent) ? "—" : c.pointsSpent
    return [
      h("h2", {}, "Ability scores"),
      h("p", { class: "muted" }, "Enter base scores before racial adjustments; those are set on the Race tab. Level-up increases and items can go here too, or be added in Foundry later."),
      h("div", { class: "abilities" }, rows),
      h("div", { class: "card row", style: "margin-top:1rem" },
        h("strong", {}, "Point buy"),
        h("span", { class: Number.isNaN(c.pointsSpent) || c.pointsSpent > num(state.pointBuy) ? "warn" : "" }, `${spent} spent of`),
        input("pointBuy", { type: "number", min: 0, "aria-label": "Point buy budget" }),
        h("span", { class: "note" }, "Scores outside 7–18 can't be bought, so they show as —."),
      ),
    ]
  },

  race() {
    return [
      h("h2", {}, "Race"),
      h("div", { class: "grid" },
        field("Race", racePicker()),
        field(state.race.ref ? "Name" : "Race name", input("race.name", { placeholder: "Human, Elf, …" })),
        field("Size", select("race.size", Object.fromEntries(Object.entries(SIZES).map(([k, v]) => [k, v[0]])))),
        field("Land speed (ft.)", input("race.speed", { type: "number", min: 0, step: 5 })),
      ),
      raceChoices(),
      h("h3", {}, "Racial ability adjustments"),
      h("div", { class: "grid" }, ABL.map((k) => field(ABILITIES[k], input(`race.mods.${k}`, { type: "number", step: 1 })))),
      h("h3", {}, "Racial bonuses"),
      h("div", { class: "grid" },
        field("Bonus feats", input("race.bonusFeats", { type: "number", min: 0 }), "Human: 1"),
        field("Bonus skill ranks per level", input("race.bonusSkillPerLevel", { type: "number", min: 0 }), "Human: 1"),
      ),
      h("p", { class: "note" }, "Racial traits like darkvision or weapon familiarity go on the Feats & Features tab with “+ Add racial trait”, which lists the chosen race's standard and alternate racial traits."),
    ]
  },

  classes() {
    const c = calc()
    const rows = state.classes.map((cls, i) => {
      const p = `classes.${i}.`
      const csCount = cls.classSkills.length
      return h("div", { class: "class-row" },
        field("Class", classPicker(cls)),
        field(cls.classRef ? "Name" : "Class name", input(p + "name", { placeholder: "Fighter, Incanter, …", style: "width:12rem" })),
        field("Level", input(p + "level", { type: "number", min: 0, max: 40 })),
        field("Hit die", select(p + "hd", { 4: "d4", 6: "d6", 8: "d8", 10: "d10", 12: "d12" }, {}, { number: true })),
        field("BAB", select(p + "bab", PROGRESSION)),
        field("Fort", select(p + "fort", SAVE_PROG)),
        field("Ref", select(p + "ref", SAVE_PROG)),
        field("Will", select(p + "will", SAVE_PROG)),
        field("Skills / level", input(p + "skills", { type: "number", min: 0 })),
        state.spheresModule ? field("Caster level progression", select(p + "caster", CASTER_PROG)) : null,
        state.hpMode === "custom"
          ? field("HP from class", input(p + "hpCustom", { type: "number", min: 0 }))
          : h("div", { class: "field" }, h("span", {}, "HP from class"), h("span", { style: "padding:.3rem 0" }, c.classHp[i])),
        h("div", { style: "flex-basis:100%" }),
        cls.classRef && CLASS_DATA.byKey[cls.classRef]
          ? h("p", { class: "note", style: "flex-basis:100%;margin:0" },
              "Filled in from ", h("a", { href: classLink(CLASS_DATA.byKey[cls.classRef]), target: "_blank" }, CLASS_DATA.byKey[cls.classRef].label),
              CLASS_DATA.byKey[cls.classRef].system === "Pathfinder" ? " (Archives of Nethys)" : "",
              ". Archetypes can change these; edit any field as needed.")
          : null,
        checkbox(p + "favored", "Favored class"),
        cls.favored ? field("FCB: HP", input(p + "fcbHp", { type: "number", min: 0 })) : null,
        cls.favored ? field("FCB: skill ranks", input(p + "fcbSkill", { type: "number", min: 0 })) : null,
        h("div", { class: "spacer" }),
        state.classes.length > 1
          ? h("button", { class: "small danger", onclick: () => { state.classes.splice(i, 1); changed(true) } }, "Remove class")
          : null,
        h("details", { style: "flex-basis:100%" },
          h("summary", {}, `Class skills (${csCount})`),
          h("div", { class: "grid", style: "grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:.15rem .75rem;margin-top:.4rem" },
            Object.entries(SKILLS).map(([k, [label]]) => {
              const box = h("input", { type: "checkbox", checked: cls.classSkills.includes(k) })
              box.addEventListener("change", () => {
                cls.classSkills = box.checked ? [...cls.classSkills, k] : cls.classSkills.filter((x) => x !== k)
                changed()
                box.closest("details").querySelector("summary").textContent = `Class skills (${cls.classSkills.length})`
              })
              return h("label", { class: "row", style: "gap:.3rem;font-size:.92em" }, box, label)
            }),
          ),
        ),
      )
    })
    return [
      h("h2", {}, "Classes"),
      h("p", { class: "muted" }, "Each class exports as a Foundry class item, so BAB, saves, HP and skill ranks update when you level up there. With Spheres enabled, each class also gets a sphere caster level progression."),
      h("div", { class: "card" }, rows),
      h("div", { class: "row", style: "margin-top:.75rem" },
        h("button", { onclick: () => { if (state.tradeTraditions) addClassWithTrade(); else { state.classes.push(blankClass(false)); changed(true) } } }, "+ Add class"),
        h("div", { class: "spacer" }),
        field("Hit points", select("hpMode", { pfs: "Max at 1st level, then half + 1", max: "Maximum every level", custom: "Enter per class" })),
      ),
      h("div", { class: "card row", style: "margin-top:.75rem" },
        checkbox("tradeTraditions", h("strong", {}, "Using trade traditions")),
        h("span", { class: "note", style: "flex:1 1 260px" }, "Class skills come from a trade tradition (Spheres tab) instead of your classes: picking a class no longer fills in its class skills, and each class added after the first offers a Vocation trade talent for multiclassing."),
      ),
      h("div", { class: "card row", style: "margin-top:.75rem" },
        checkbox("fractionalBonuses", h("strong", {}, "Fractional base bonuses")),
        h("span", { class: "note", style: "flex:1 1 260px" }, "Pathfinder Unchained variant for multiclassing: BAB and saves add up fractions across classes and round down once, with a single +2 for any good save. Turn on the matching world setting in Foundry too (Game Settings → System Settings → Variant Rules → Fractional Base Bonuses)."),
      ),
    ]
  },

  skills() {
    const c = calc()
    const rankInput = (getter, setter, label, ablOf) => {
      const el = h("input", { type: "number", min: 0, max: Math.max(c.hd, 1), value: getter() || 0, "aria-label": `${label} ranks` })
      el.addEventListener("input", () => {
        setter(el.value === "" ? 0 : +el.value)
        changed()
        const row = el.closest("tr")
        row.querySelector(".tot").textContent = signed(skillTotal(row.dataset.key, getter(), calc(), ablOf()))
        row.querySelector(".tot").classList.toggle("warn", getter() > c.hd)
        refreshSkillCounters()
      })
      return el
    }
    // per-skill ability override, like the ability dropdown on Foundry's skill rows
    const ablSelect = (cur, def, onPick, label) => {
      const el = h("select", { class: "abl-select" + (cur !== def ? " changed" : ""), "aria-label": `${label} ability`, title: cur !== def ? `Default: ${def.toUpperCase()}` : null },
        ...ABL.map((a) => h("option", { value: a, selected: a === cur }, a.toUpperCase())))
      el.addEventListener("change", () => { onPick(el.value === def ? undefined : el.value); changed(true) })
      return el
    }
    const bg = state.backgroundSkills
    const isBg = (k) => bg && BG_SKILLS.includes(k)
    const keys = Object.keys(SKILLS).filter((k) => bg || !BG_ONLY.includes(k))
    const rowsFor = (list) => {
    const rows = []
    for (const k of list) {
      const [label, abl, trainedOnly, acp] = SKILLS[k]
      const rank = num(state.skills[k])
      rows.push(h("tr", { class: c.classSkills.has(k) ? "cs" : "", "data-key": k },
        h("td", {}, label, trainedOnly ? h("span", { class: "note" }, " (trained)") : null),
        h("td", {}, ablSelect(skillAbl(k), abl, (v) => (v ? (state.skillAbility[k] = v) : delete state.skillAbility[k]), label), acp ? h("span", { class: "note" }, " ACP") : null),
        h("td", { class: "num" }, rankInput(() => num(state.skills[k]), (v) => (state.skills[k] = v), label, () => skillAbl(k))),
        h("td", { class: "num tot" }, signed(skillTotal(k, rank, c, skillAbl(k)))),
      ))
      if (SUB_SKILLS.includes(k)) {
        state.subSkills[k].forEach((sub, i) => {
          rows.push(h("tr", { class: c.classSkills.has(k) ? "cs" : "", "data-key": k },
            h("td", { style: "padding-left:1.25rem" },
              (() => {
                const el = h("input", { value: sub.name, placeholder: "Specialty", "aria-label": `${label} specialty`, style: "width:10rem" })
                el.addEventListener("input", () => { sub.name = el.value; changed() })
                return el
              })(),
              " ",
              h("button", { class: "small danger", "aria-label": "Remove specialty", onclick: () => { state.subSkills[k].splice(i, 1); changed(true) } }, "×"),
            ),
            h("td", {}, ablSelect(sub.ability || abl, abl, (v) => (v ? (sub.ability = v) : delete sub.ability), sub.name || label)),
            h("td", { class: "num" }, rankInput(() => num(sub.rank), (v) => (sub.rank = v), sub.name || label, () => sub.ability || abl)),
            h("td", { class: "num tot" }, signed(skillTotal(k, num(sub.rank), c, sub.ability || abl))),
          ))
        })
        rows.push(h("tr", {}, h("td", { colspan: 4, style: "padding-left:1.25rem" },
          h("button", { class: "small", onclick: () => { state.subSkills[k].push({ name: "", rank: 0 }); changed(true) } }, `+ ${label} specialty`))))
      }
    }
    return rows
    }
    const table = (title, list, counter) => h("section", { class: "skill-table" },
      title ? h("div", { class: "row", style: "margin:1rem 0 .4rem" }, h("h3", { style: "margin:0" }, title), h("div", { class: "spacer" }), counter) : null,
      h("div", { class: "table-wrap card" },
        h("table", {},
          h("thead", {}, h("tr", {}, h("th", {}, "Skill"), h("th", {}, "Ability"), h("th", { class: "num" }, "Ranks"), h("th", { class: "num" }, "Total"))),
          h("tbody", {}, rowsFor(list)),
        ),
      ),
    )
    return [
      h("h2", {}, "Skills"),
      h("div", { class: "card row", style: "margin-bottom:.75rem" },
        field("Bonus skill ranks", (() => {
          const el = input("bonusSkillFormula", { placeholder: "Formula, e.g. 2 or @attributes.hd.total", style: "width:18rem" })
          el.addEventListener("input", refreshSkillCounters)
          return el
        })()),
        h("span", { class: "note", style: "flex:1 1 220px", "data-counter": "bonus" }),
      ),
      h("div", { class: "card row", style: "margin-bottom:.75rem" },
        checkbox("backgroundSkills", h("strong", {}, "Background skills")),
        h("span", { class: "note", style: "flex:1 1 260px" }, `Pathfinder Unchained variant: +${BG_PER_LEVEL} ranks per class level that only go into background skills (their own table below), and Artistry and Lore become available. Turn on the matching world setting in Foundry too (Game Settings → System Settings → Variant Rules → Background Skills).`),
      ),
      h("p", { class: "muted" }, `● marks a class skill (set on the Classes tab). Max ranks per skill: ${c.hd}. Change a skill's ability with its dropdown (e.g. Acrobatics on STR); changed ones are highlighted. Totals include ranks, ability modifier, +3 for trained class skills and armor check penalty.`),
      bg
        ? [
            table("Adventuring skills", keys.filter((k) => !isBg(k)), h("span", { "data-counter": "adv" })),
            table("Background skills", keys.filter(isBg), h("span", { "data-counter": "bg" })),
          ]
        : table(null, keys),
    ]
  },

  features() {
    return [
      h("h2", {}, "Feats & features"),
      h("div", { class: "card row", style: "margin-bottom:.75rem" },
        field("Bonus feats", input("bonusFeats", { type: "number", min: 0 })),
        h("span", { class: "note", style: "flex:1 1 220px" }, "Extra feats beyond level and race, such as fighter or class bonus feats. Exported to the Bonus Feats box on Foundry's Features tab."),
      ),
      h("p", { class: "muted" }, "Feats, traits, class features and racial traits. Each one exports as a feature item with your text as its description. Give it changes (e.g. Toughness: Hit Points +3) and Foundry applies them automatically."),
      entryList("features", () => newFeature("feat"), (e, p) => [
        h("span", { class: `kind-badge kind-${e.kind}`, title: "Type" }, FEATURE_KINDS[e.kind] ?? "Other"),
        field("Name", input(p + "name", { placeholder: FEATURE_PLACEHOLDERS[e.kind] ?? "Name" })),
        e.ref ? h("span", { class: "note", style: "align-self:center" }, "From the compendium") : null,
      ], () => h("div", { class: "row add-row" },
        ...FEATURE_ADDS.map(([kind, label]) => h("button", {
          onclick: () => (PICKERS[kind] ? openCompendiumChooser(kind) : addFeature(kind)),
        }, label))), groupBy("kind", FEATURE_KINDS), changesEditor),
    ]
  },

  buffs() {
    return [
      h("h2", {}, "Buffs"),
      h("p", { class: "muted" }, "Spells, rages, auras and other effects you switch on and off. Each one exports as a Foundry buff item with its changes. Tick Active to include it in the preview; it's also switched on when imported."),
      entryList("buffs", () => ({ name: "", kind: "temp", active: false, level: "", duration: "", units: "", desc: "", changes: [], notes: [] }), (e, p) => [
        field("Name", input(p + "name", { placeholder: "Bless" })),
        field("Type", select(p + "kind", BUFF_KINDS)),
        h("div", { class: "field" }, h("span", {}, " "), checkbox(p + "active", "Active")),
        field("Level", input(p + "level", { type: "number", min: 0, placeholder: "CL", style: "width:4.5rem" }, { allowBlank: true })),
        field("Duration", attachAutocomplete(input(p + "duration", { placeholder: "e.g. @attributes.hd.total", style: "width:11rem" })), "Number or formula"),
        field("Units", select(p + "units", DURATION_UNITS)),
      ], "+ Add buff", groupBy("kind", BUFF_KINDS), changesEditor),
    ]
  },

  // mirrors the Spheres tab pf1spheres adds to the actor sheet: attribute header, then one block per sphere
  spheres() {
    const c = calc()
    const abilityOpts = { "": "None", ...ABILITIES }
    const attr = (label, value) => h("div", { class: "stat" }, h("b", {}, value), h("span", {}, label))
    const bySphere = {}
    state.talents.forEach((t, i) => (bySphere[t.sphere || ""] ??= []).push(i))
    const order = Object.keys(bySphere).sort((x, y) => (x === "" ? 1 : y === "" ? -1 : label(x).localeCompare(label(y))))

    const talentRow = (i) => {
      const t = state.talents[i]
      const p = `talents.${i}.`
      const desc = textarea(p + "desc", { rows: 3, placeholder: "Description or rules text (optional)" })
      return h("div", { class: "card class-row", style: "margin:0" },
        field("Talent", input(p + "name", { placeholder: "Talent name", style: "width:14rem" })),
        field("Tags", input(p + "tags", { placeholder: "e.g. Blast Type", style: "width:10rem" }), "Comma separated"),
        t.sphere ? null : field("Kind", select(p + "kind", Object.fromEntries(Object.entries(TALENT_KINDS).map(([k, v]) => [k, v[1]])))),
        field("Sphere", sphereSelect(p + "sphere")),
        h("div", { class: "field" }, h("span", {}, " "), checkbox(p + "exclude", "Exclude from talent count")),
        t.ref ? h("span", { class: "note", style: "align-self:center" }, "From the compendium") : null,
        h("div", { class: "spacer" }),
        h("button", { class: "small danger", "aria-label": `Remove ${t.name || "talent"}`, onclick: () => { state.talents.splice(i, 1); changed(true) } }, "Remove"),
        h("details", { style: "flex-basis:100%" }, h("summary", { class: "note" }, t.desc ? "Description" : "Add description"), desc),
        changesEditor(t),
      )
    }

    const blocks = order.map((key) => {
      const kind = sphereKind(key)
      const idxs = bySphere[key]
      const counted = idxs.filter((i) => !state.talents[i].exclude).length
      const level = kind === "magic" ? ["CL", c.spheres.cl] : kind === "combat" ? ["BAB", signed(c.bab)] : null
      return h("section", { class: "card sphere-block" },
        h("div", { class: "row sphere-head" },
          h("h3", { style: "margin:0" }, key ? label(key) : "No sphere set"),
          kind ? h("span", { class: `chip ${kind}` }, { magic: "Power", combat: "Might", skill: "Guile" }[kind]) : null,
          h("span", { class: "muted" }, `Talents: ${counted}${counted !== idxs.length ? ` (${idxs.length - counted} excluded)` : ""}`),
          h("div", { class: "spacer" }),
          level ? h("span", { class: "sphere-level" }, h("span", { class: "muted" }, level[0] + " "), h("b", {}, level[1])) : null,
        ),
        h("div", { class: "picked-list" }, idxs.map(talentRow)),
        h("button", { class: "small", style: "margin-top:.5rem", onclick: () => addSphereTalent(key) }, `+ Add ${key ? label(key) : ""} talent`.replace("  ", " ")),
      )
    })

    const adder = h("select", { "aria-label": "Sphere to add" },
      h("option", { value: "" }, "Choose a sphere…"),
      ...[["Spheres of Power", MAGIC_SPHERES], ["Spheres of Might", COMBAT_SPHERES], ["Spheres of Guile", SKILL_SPHERES]].map(([g, list]) =>
        h("optgroup", { label: g }, list.filter((k) => !bySphere[k]).map((k) => h("option", { value: k }, label(k))))),
    )
    return [
      h("h2", {}, "Spheres"),
      h("p", { class: "muted" }, "Laid out like the Spheres tab the Spheres for Pathfinder 1e module adds in Foundry. Talents export as talent items in their sphere; CL, MSB, MSD and concentration are worked out by the module from your classes' caster level progression."),
      h("div", { class: "sphere-attrs" },
        h("div", { class: "card" },
          h("div", { class: "group-title", style: "margin-top:0" }, "Spheres of Power"),
          h("div", { class: "stat-grid four" }, attr("CL", c.spheres.cl), attr("MSB", signed(c.spheres.msb)), attr("Concentration", signed(c.spheres.concentration)), attr("MSD", c.spheres.msd)),
        ),
        h("div", { class: "card" },
          h("div", { class: "group-title", style: "margin-top:0" }, "Spheres of Might"),
          h("div", { class: "stat-grid one" }, attr("BAB", signed(c.bab))),
        ),
      ),
      h("h3", {}, "Spheres settings"),
      h("div", { class: "card grid" },
        field("Casting ability", select("sphere.casting", abilityOpts), "Added to sphere DCs and concentration"),
        field("Practitioner ability", select("sphere.practitioner", abilityOpts), "Spheres of Might DCs"),
        field("Operative ability", select("sphere.operative", abilityOpts), "Spheres of Guile"),
        field("Casting tradition", input("sphere.tradition", { placeholder: "Name (optional)" }), "Exported as a class feature"),
      ),
      !state.classes.some((cl) => cl.caster !== "none")
        ? h("p", { class: "note" }, "No class has a caster level progression yet, so CL and MSB are 0. Set one on the Classes tab.")
        : null,
      h("h3", {}, "Spheres and talents"),
      blocks.length ? h("div", { class: "picked-list" }, blocks) : h("p", { class: "muted" }, "No talents yet. Pick a sphere below to start."),
      h("div", { class: "row", style: "margin-top:.75rem" },
        adder,
        h("button", { onclick: () => adder.value && addSphereTalent(adder.value) }, "+ Add sphere"),
        h("button", { onclick: () => openTraditionPicker() }, "+ Add martial tradition"),
        h("button", { onclick: () => openCastingTradition() }, "+ Add casting tradition"),
        h("button", { onclick: () => openTradeTradition() }, "+ Add trade tradition"),
      ),
    ]
  },

  spells() {
    const sc = state.spellcasting
    const classOpts = { "-1": "— none —", ...Object.fromEntries(state.classes.map((c, i) => [i, c.name || `Class ${i + 1}`])) }
    return [
      h("h2", {}, "Spells"),
      h("p", { class: "muted" }, "For classes that cast PF1 spells (wizard, cleric, …). Spells go into the actor's primary spellbook. Sphere casters can leave this empty."),
      h("div", { class: "card grid" },
        field("Spellcasting class", select("spellcasting.cls", classOpts, {}, { number: true })),
        field("Casting ability", select("spellcasting.ability", ABILITIES)),
        field("Preparation", select("spellcasting.type", { prepared: "Prepared", spontaneous: "Spontaneous", hybrid: "Hybrid (arcanist)" })),
        field("Progression", select("spellcasting.progression", { high: "Full (9th level)", med: "Medium (6th)", low: "Low (4th)" })),
      ),
      sc.cls < 0 && state.spells.length ? h("p", { class: "warn" }, "Pick a spellcasting class so Foundry knows which spellbook these belong to.") : null,
      h("h3", {}, "Known / prepared spells"),
      entryList("spells", () => ({ name: "", level: 1, school: "evo", desc: "" }), (e, p) => [
        field("Name", input(p + "name", { placeholder: "Magic Missile" })),
        field("Level", input(p + "level", { type: "number", min: 0, max: 9 })),
        field("School", select(p + "school", SCHOOLS)),
      ], () => h("button", { style: "margin-top:.75rem", onclick: () => openSpellChooser() }, "+ Add spell"), (list) => {
        const groups = {}
        list.map((e, i) => [num(e.level), i]).sort((a, b) => a[0] - b[0]).forEach(([lvl, i]) => (groups[lvl === 0 ? "Cantrips / orisons" : `Level ${lvl}`] ??= []).push(i))
        return groups
      }),
    ]
  },

  gear() {
    return [
      h("h2", {}, "Gear"),
      h("div", { class: "card grid" }, ["pp", "gp", "sp", "cp"].map((k) => field(k.toUpperCase(), input(`currency.${k}`, { type: "number", min: 0 })))),
      carryCard(),
      h("h3", {}, "Items"),
      entryList("gear", () => ({ name: "", kind: "loot", qty: 1, weight: 0, price: 0, equipped: false, desc: "" }), (e, p) => {
        const out = [
          field("Name", input(p + "name", { placeholder: "Longsword" })),
          field("Type", select(p + "kind", GEAR_KINDS)),
          field("Qty", input(p + "qty", { type: "number", min: 0 })),
          field("Weight (lb.)", input(p + "weight", { type: "number", min: 0, step: "any" })),
          field("Price (gp)", input(p + "price", { type: "number", min: 0, step: "any" })),
          h("div", { class: "field" }, h("span", {}, " "), carriedBox(p)),
        ]
        if (["weapon", "armor", "shield", "equipment"].includes(e.kind)) out.push(h("div", { class: "field" }, h("span", {}, " "), checkbox(p + "equipped", "Equipped")))
        if (e.kind === "weapon") out.push(
          field("Attack", select(p + "attack", { melee: "Melee", ranged: "Ranged" })),
          field("Damage", input(p + "damage", { placeholder: "1d8", style: "width:5rem" })),
          field("Type", input(p + "dmgType", { placeholder: "S", style: "width:4rem" }), "B / P / S"),
          field("Crit range", input(p + "critRange", { type: "number", min: 2, max: 20, placeholder: "20" }, { allowBlank: true })),
          field("Crit ×", input(p + "critMult", { type: "number", min: 2, max: 6, placeholder: "2" }, { allowBlank: true })),
        )
        if (e.kind === "armor" || e.kind === "shield") out.push(
          field(e.kind === "armor" ? "Armor type" : "Shield type", select(p + "armorType", e.kind === "armor" ? ARMOR_TYPES : SHIELD_TYPES)),
          field("AC bonus", input(p + "ac", { type: "number", min: 0 })),
          e.kind === "armor" ? field("Max Dex", input(p + "maxDex", { type: "number", min: 0, placeholder: "—" }, { allowBlank: true })) : null,
          field("Check penalty", input(p + "acp", { type: "number", min: 0 })),
          field("Spell failure %", input(p + "asf", { type: "number", min: 0, step: 5 })),
        )
        if (MAGIC_KINDS.includes(e.kind)) out.push(magicBlock(e, +p.split(".")[1]))
        return out
      }, () => h("button", { style: "margin-top:.75rem", onclick: () => openGearChooser() }, "+ Add item"), groupBy("kind", GEAR_KINDS)),
    ]
  },

  notes() {
    return [
      h("h2", {}, "Notes"),
      field("Biography / appearance", textarea("bio", { rows: 8 }), "Goes to the Biography tab in Foundry."),
      h("div", { style: "height:.75rem" }),
      field("Other notes", textarea("notes", { rows: 6 }), "Appended to the biography under a Notes heading."),
    ]
  },

  export() {
    return [
      h("h2", {}, "Export to Foundry"),
      h("div", { class: "card" },
        h("ol", { class: "steps" },
          h("li", {}, "Click ", h("strong", {}, "Export for Foundry"), " (top right). You get a ", h("code", {}, ".json"), " file."),
          h("li", {}, "In Foundry, open the Actors sidebar and create a new ", h("strong", {}, "Character"), " (any name)."),
          h("li", {}, "Right-click that actor and choose ", h("strong", {}, "Import Data"), ", then pick the file. This replaces the actor with your character."),
        ),
        h("p", { class: "note" }, "Built for the Pathfinder 1e system (v11) on Foundry v12–13. Turn on “Spheres for PF1e” (top right) if your world uses the Spheres for Pathfinder 1e module; leave it off otherwise, and sphere talents and settings are left out of the file."),
      ),
      h("h3", {}, "Saving your work"),
      h("p", {}, "The builder keeps your current character in this browser automatically. The exported file also carries a copy of the builder's data, so you can open it again with ", h("strong", {}, "Load"), " and keep editing."),
      h("div", { class: "row" },
        h("button", { class: "primary", onclick: exportActor }, "Export for Foundry"),
        h("button", { onclick: () => download(`${fileSlug()}-builder.json`, { [FLAG_SCOPE]: state }) }, "Download builder save only"),
      ),
    ]
  },
}

const label = (key) => key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())

function sphereSelect(path) {
  const cur = getPath(state, path)
  const el = h("select", {},
    h("option", { value: "", selected: !cur }, "None"),
    ...[["Spheres of Power", MAGIC_SPHERES], ["Spheres of Might", COMBAT_SPHERES], ["Spheres of Guile", SKILL_SPHERES]].map(([g, list]) =>
      h("optgroup", { label: g }, list.map((k) => h("option", { value: k, selected: k === cur }, label(k))))),
  )
  el.addEventListener("change", () => {
    setPath(state, path, el.value)
    const t = getPath(state, path.replace(/\.sphere$/, ""))
    if (el.value) t.kind = sphereKind(el.value)
    changed(true)
  })
  return el
}

// ---------- martial traditions ----------
// compendium/martial-traditions.json: each tradition's bonus talents (base spheres with their
// packages / drawbacks, named talents, bonus feats) and its choices. "Add martial tradition" walks
// through the choices, then adds an "Other" feature for the tradition and every talent to its sphere.
// (Nothing marks a tradition as taken: adding one twice adds its talents twice.)
const sphereKey = (name) => name.replace(/\s+(\w)/g, (_, c) => c.toUpperCase()).replace(/^./, (c) => c.toLowerCase())

function openTraditionPicker() {
  const box = h("input", { type: "search", placeholder: "Search martial traditions", "aria-label": "Search martial traditions" })
  const results = h("div", { class: "picker-results", role: "list" }, h("p", { class: "muted" }, "Loading martial traditions…"))
  const dlg = openDialog("Add martial tradition",
    h("p", { class: "muted" }, "Pick a martial tradition; you'll make its choices next."),
    h("div", { class: "row picker-filters" }, box), results)
  let all = []
  const render = () => {
    const q = box.value.trim().toLowerCase()
    const hits = all.filter((t) => !q || t.name.toLowerCase().includes(q) || t.md.toLowerCase().includes(q))
    fill(results, ...hits.map((t) => h("button", { class: "picker-item", role: "listitem", onclick: () => { dlg.done(); openTradition(t) } },
      h("span", { class: "pi-name" }, t.name),
      h("span", { class: "pi-sum" }, t.summary),
      h("span", { class: "pi-pre" }, traditionLine(t)))),
      hits.length ? null : h("p", { class: "muted" }, all.length ? "No traditions match." : "Couldn't load the martial traditions."))
  }
  box.addEventListener("input", render)
  loadCompendium("martial-traditions.json", { traditions: [] }).then((d) => { all = d.traditions; render() })
  box.focus()
}

// one line of what a tradition grants, for the picker list
function traditionLine(t) {
  const g = t.grants.map((x) => (x.type === "sphere" ? `${x.sphere} sphere` : x.type === "talent" ? x.name
    : x.type === "feat" ? `${x.name} (feat)` : `${x.name} (${x.type})`))
  return [...g, ...t.choices.map(() => "+ a choice")].join(", ")
}

async function openTradition(t) {
  const index = await loadCompendium("index.json", [])
  const talentKinds = new Set(["talent", "advanced talent", "legendary talent", "exceptional talent"])
  const talentsOf = (sphere, filter) => index.filter((e) => e.sphere === sphere && talentKinds.has(e.kind)
    && (!filter || (e.tags ?? []).includes(filter))).sort((a, b) => a.name.localeCompare(b.name))
  // per choice: the chosen option, and per pick the selected talents ("sphere|name")
  const picked = t.choices.map((c) => ({ option: c.options.length === 1 ? 0 : -1, picks: {} }))
  const describe = (x) => (x.type === "sphere" ? `${x.sphere} sphere${x.note ? ` ${x.note}` : ""}` : x.type === "talent" ? `${x.name} (${x.sphere})`
    : x.type === "feat" ? `${x.name} (bonus feat)` : `${x.name} (${x.sphere} ${x.type})`)
  const pickSelect = (ci, oi, pi, n, pick) => {
    const el = h("select", { "aria-label": `Talent choice ${n + 1}` }, h("option", { value: "" }, "Choose a talent…"),
      ...pick.from.map((s) => h("optgroup", { label: `${s}${pick.filter ? ` (${pick.filter})` : ""}` },
        ...talentsOf(s, pick.filter).map((e) => h("option", { value: `${s}|${e.name}`, selected: picked[ci].picks[`${oi}.${pi}.${n}`] === `${s}|${e.name}` }, e.name)))))
    el.addEventListener("change", () => { picked[ci].picks[`${oi}.${pi}.${n}`] = el.value })
    return el
  }
  const optionBody = (ci, oi, o) => h("div", { class: "trad-option" },
    ...o.picks.flatMap((p, pi) => Array.from({ length: p.count }, (_, n) => pickSelect(ci, oi, pi, n, p))),
    o.free ? h("p", { class: "note" }, "Not read automatically: add what this allows on the Spheres tab yourself.") : null)
  const choiceBlock = (c, ci) => h("fieldset", { class: "card trad-choice" },
    h("legend", {}, c.text),
    c.options.length === 1
      ? optionBody(ci, 0, c.options[0])
      : c.options.map((o, oi) => h("div", {},
          h("label", { class: "row", style: "gap:.4rem" },
            h("input", { type: "radio", name: `choice-${ci}`, checked: picked[ci].option === oi, onchange: () => { picked[ci].option = oi } }),
            [o.grants.map(describe).join(" + "), o.picks.map((p) => `${p.count} talent${p.count > 1 ? "s" : ""} from ${p.from.join(" or ")}${p.filter ? ` (${p.filter})` : ""}`).join(" + ")].filter(Boolean).join(" + ") || o.label),
          o.picks.length ? optionBody(ci, oi, o) : null)))
  const error = h("p", { class: "warn", hidden: true })
  const dlg = openDialog(`Martial tradition: ${t.name}`,
    h("details", { class: "cmp-text" }, h("summary", {}, "Tradition text"), h("div", { style: "white-space:pre-wrap" }, mdToText(t.md))),
    h("p", {}, h("strong", {}, "Grants: "), t.grants.map(describe).join(", ") || "nothing fixed (all choices)"),
    t.notes.length ? h("ul", { class: "note" }, t.notes.map((n) => h("li", {}, n))) : null,
    t.choices.length ? h("div", { class: "trad-choices" }, t.choices.map(choiceBlock)) : null,
    error,
    h("div", { class: "row add-row" },
      h("button", { class: "primary", onclick: async () => {
        const grants = [...t.grants]
        for (const [ci, c] of t.choices.entries()) {
          const oi = picked[ci].option
          if (oi < 0) return showError(`Choose an option for: ${c.text}`)
          const o = c.options[oi]
          grants.push(...o.grants)
          for (const [pi, p] of o.picks.entries()) for (let n = 0; n < p.count; n++) {
            const v = picked[ci].picks[`${oi}.${pi}.${n}`]
            if (!v && !o.free) return showError(`Choose the talent${p.count > 1 ? "s" : ""} for: ${c.text}`)
            if (v) { const [sphere, name] = v.split("|"); grants.push({ type: "talent", sphere, name }) }
          }
        }
        await applyTradition(t, grants, index)
        dlg.done()
        toast(`Added the ${t.name} martial tradition`)
      } }, "Add tradition"),
      h("button", { onclick: () => dlg.done() }, "Cancel")))
  function showError(msg) { error.textContent = msg; error.hidden = false }
}

async function applyTradition(t, grants, index) {
  state.features.push(newFeature("misc", { name: `Martial tradition: ${t.name}`, desc: mdToText(t.md), ref: t.id }))
  for (const g of grants) {
    if (g.type === "feat") { state.features.push(newFeature("feat", { name: g.name })); continue }
    const key = sphereKey(g.sphere)
    const row = { name: "", kind: sphereKind(key) ?? "combat", sphere: key, tags: "", exclude: false, desc: "" }
    // a package or drawback's own text, when the compendium has it ("(run) package" is Athletics' "Run")
    const textOf = async (kind, name) => {
      const want = name.replace(/^\((.+)\) package$/i, "$1").toLowerCase()
      const e = index.find((x) => x.sphere === g.sphere && x.kind === kind
        && [x.name.toLowerCase(), x.name.toLowerCase().replace(/ package$/, "")].includes(want))
      const full = e ? (await loadCompendium(e.file, { entries: [] })).entries.find((x) => x.id === e.id) : null
      return { ref: e?.id, desc: full ? mdToText(full.md) : "" }
    }
    if (g.type === "sphere") Object.assign(row, { name: `${g.sphere} sphere`, tags: ["base sphere", g.note].filter(Boolean).join(", "),
      desc: `Base sphere from the ${t.name} martial tradition.` })
    else if (g.type === "package") Object.assign(row, { name: `${g.name} (${g.sphere})`, tags: "package", exclude: true }, await textOf("package", g.name))
    else if (g.type === "drawback") Object.assign(row, { name: `${g.name} (drawback)`, tags: "drawback", exclude: true }, await textOf("drawback", g.name))
    else {
      const e = index.find((x) => x.sphere === g.sphere && x.name.toLowerCase() === g.name.toLowerCase() && x.kind !== "drawback" && x.kind !== "feat")
      const full = e ? (await loadCompendium(e.file, { entries: [] })).entries.find((x) => x.id === e.id) : null
      Object.assign(row, { name: e?.name ?? g.name, tags: e?.tags?.join(", ") ?? "", ref: e?.id,
        desc: [mdToText(full?.md ?? e?.summary ?? ""), ...(full?.options ?? []).map((o) => `${o.name}\n${mdToText(o.md)}`)].filter(Boolean).join("\n\n") })
    }
    state.talents.push(row)
  }
  changed(true)
}

// ---------- casting traditions ----------
// compendium/casting-traditions.json: the general drawbacks (points, taken-twice, incompatibilities),
// boons (cost 2 drawback points; requirements), the bonus spell point table and the sample traditions
// as templates. "Add casting tradition" builds one: drawbacks give points, boons spend 2 each, and the
// points left become bonus spell points, added to the tradition's "Other" feature as a spellPoints
// change Foundry works out from the levels in casting classes.
const CT_ABILITIES = { int: "Intelligence", wis: "Wisdom", cha: "Charisma", con: "Constitution" }
// "+1, +1 per 6 levels in casting classes" etc. as a formula over L (levels in casting classes)
const CT_FORMULAS = { 1: (L) => `1 + floor(${L} / 6)`, 2: (L) => `1 + floor(${L} / 3)`, 3: (L) => `ceil(${L} / 2)`,
  4: (L) => `1 + floor(${L} * 2 / 3)`, 5: (L) => `${L}` }

// levels in casting classes, as Foundry roll data: the classes with a caster level progression
function castingLevelsFormula() {
  const parts = state.classes.filter((c) => c.caster && c.caster !== "none" && num(c.level) > 0)
    .map((c, i) => `@classes.${tagFor(c.name || `Class ${i + 1}`)}.level`)
  return parts.length ? (parts.length > 1 ? `(${parts.join(" + ")})` : parts[0]) : null
}

async function openCastingTradition() {
  const [data, feats] = await Promise.all([
    loadCompendium("casting-traditions.json", { drawbacks: [], boons: [], spellPoints: {}, templates: [] }),
    loadCompendium("feats-index.json", []),
  ])
  const drawbackFeats = feats.filter((f) => !isPf(f) && f.types.includes("Drawback")).sort((a, b) => a.name.localeCompare(b.name))
  const D = Object.fromEntries(data.drawbacks.map((d) => [d.name, d]))
  const B = Object.fromEntries(data.boons.map((b) => [b.name, b]))
  // the tradition being built
  const sel = { name: "", ability: state.sphere.casting || "cha", drawbacks: {}, boons: {}, feats: [], template: "", filter: "" }
  const taken = (n) => sel.drawbacks[n]?.count > 0
  const pointsOf = (n) => {
    const d = D[n], s = sel.drawbacks[n]
    if (!s?.count) return 0
    return (s.value ?? d.points[0]) + (s.count > 1 ? d.points[1] ?? d.points[0] : 0)
  }
  const total = () => Object.keys(sel.drawbacks).reduce((a, n) => a + pointsOf(n), 0)
  const boonCount = () => Object.values(sel.boons).reduce((a, c) => a + c, 0)
  const left = () => total() - 2 * boonCount()
  const blockedBy = (n) => D[n].incompatible.find(taken) || Object.keys(sel.boons).find((b) => sel.boons[b] && B[b].excludes.includes(n))
  const boonProblem = (b) => {
    const need = B[b].requires.filter((r) => !taken(r))
    if (need.length) return `needs ${need.join(", ")}`
    const ex = B[b].excludes.filter(taken)
    if (ex.length) return `not with ${ex.join(", ")}`
    return null
  }
  const applyTemplate = (name) => {
    const t = data.templates.find((x) => x.name === name)
    sel.template = name
    sel.drawbacks = {}
    sel.boons = {}
    sel.feats = []
    if (!t) { sel.name = ""; return }
    sel.name = t.name
    const ab = Object.entries(CT_ABILITIES).find(([, l]) => (t.ability ?? "").startsWith(l))
    if (ab) sel.ability = ab[0]
    for (const d of t.drawbacks) if (D[d.name]) sel.drawbacks[d.name] = { count: Math.min(d.count, D[d.name].points.length) }
    for (const b of t.boons) if (B[b]) sel.boons[b] = (sel.boons[b] ?? 0) + 1
    sel.feats = t.feats.map((f) => drawbackFeats.find((x) => x.name.toLowerCase() === f.toLowerCase())?.name ?? "")
  }
  const body = h("div", { class: "ct-body" })
  const dlg = openDialog("Add casting tradition", body)
  dlg.classList.add("wide")
  const render = () => {
    const pts = total(), boons = boonCount(), rest = left()
    const L = castingLevelsFormula()
    const sp = Math.min(Math.max(rest, 0), 5)
    const spLine = sp ? `${sp} left: ${data.spellPoints[sp]} spell points` : "No points left for bonus spell points"
    const templateSel = h("select", { "aria-label": "Template" }, h("option", { value: "" }, "Custom (start from nothing)"),
      ...["Standard", "Sample"].map((g) => h("optgroup", { label: g === "Standard" ? "Standard traditions (classes)" : "Sample traditions" },
        ...data.templates.filter((t) => t.group === g).map((t) => h("option", { value: t.name, selected: sel.template === t.name }, t.name)))))
    templateSel.addEventListener("change", () => { applyTemplate(templateSel.value); render() })
    const nameBox = h("input", { value: sel.name, placeholder: "Tradition name", "aria-label": "Tradition name" })
    nameBox.addEventListener("input", () => { sel.name = nameBox.value })
    const abil = h("select", { "aria-label": "Casting ability" }, ...Object.entries(CT_ABILITIES).map(([k, l]) => h("option", { value: k, selected: sel.ability === k }, l)))
    abil.addEventListener("change", () => { sel.ability = abil.value })
    const tpl = data.templates.find((t) => t.name === sel.template)
    const filter = h("input", { type: "search", value: sel.filter, placeholder: "Filter drawbacks", "aria-label": "Filter drawbacks" })
    filter.addEventListener("input", () => { sel.filter = filter.value; const pos = filter.selectionStart; render(); const f = body.querySelector('input[aria-label="Filter drawbacks"]'); f.focus(); f.setSelectionRange(pos, pos) })
    const rules = (e) => h("details", { class: "cmp-text" }, h("summary", {}, "Rules"), h("div", { style: "white-space:pre-wrap" }, mdToText(e.md)))
    const drawbackRow = (d) => {
      const s = sel.drawbacks[d.name] ?? { count: 0 }
      const block = !taken(d.name) && blockedBy(d.name)
      const set = (count) => { if (count) sel.drawbacks[d.name] = { ...s, count }; else delete sel.drawbacks[d.name]; render() }
      const control = d.points.length > 1
        ? h("select", { "aria-label": `${d.name} times taken`, disabled: !!block, onchange: (e) => set(+e.target.value) },
            ...[0, 1, 2].map((n) => h("option", { value: n, selected: s.count === n }, n === 0 ? "—" : n === 1 ? "Taken" : "Taken twice")))
        : h("input", { type: "checkbox", checked: s.count > 0, disabled: !!block, "aria-label": d.name, onchange: (e) => set(e.target.checked ? 1 : 0) })
      const value = d.values && s.count ? h("select", { "aria-label": `${d.name} worth`, onchange: (e) => { sel.drawbacks[d.name].value = +e.target.value; render() } },
        ...d.values.map((v) => h("option", { value: v, selected: (s.value ?? d.points[0]) === v }, `worth ${v}`))) : null
      const ptsLabel = d.points.length > 1 ? `${d.points[0]} pt${d.points[0] > 1 ? "s" : ""}, twice: ${d.points[0] + d.points[1]}` : `${d.points[0]} pt${d.points[0] > 1 ? "s" : ""}`
      return h("div", { class: `ct-row${block ? " ct-blocked" : ""}${s.count ? " ct-on" : ""}` },
        h("label", { class: "row", style: "gap:.4rem" }, control, h("b", {}, d.name)),
        h("span", { class: "pi-meta" }, ptsLabel + (d.values ? ` (or ${d.values.join("/")}, GM's call)` : "")),
        value,
        block ? h("span", { class: "note" }, `incompatible with ${block}`) : null,
        h("span", { class: "pi-sum ct-sum" }, d.summary), rules(d))
    }
    const boonRow = (b) => {
      const c = sel.boons[b.name] ?? 0
      const problem = boonProblem(b.name)
      const cantAfford = !c && rest < 2
      const disabled = !c && (problem || cantAfford)
      const set = (n) => {
        if (n > 0) sel.boons[b.name] = n; else delete sel.boons[b.name]
        if (b.feat) sel.feats = sel.feats.slice(0, n).concat(Array(Math.max(0, n - sel.feats.length)).fill(""))
        render()
      }
      const control = b.repeatable
        ? h("select", { "aria-label": `${b.name} times`, onchange: (e) => set(+e.target.value) },
            ...[0, 1, 2, 3, 4, 5].map((n) => h("option", { value: n, selected: c === n, disabled: n > c && (problem || rest < 2 * (n - c)) }, n ? `×${n}` : "—")))
        : h("input", { type: "checkbox", checked: c > 0, disabled: !!disabled, "aria-label": b.name, onchange: (e) => set(e.target.checked ? 1 : 0) })
      const featPickers = b.feat && c ? Array.from({ length: c }, (_, i) => {
        const s = h("select", { "aria-label": `Drawback feat ${i + 1}` }, h("option", { value: "" }, "Choose a (drawback) feat…"),
          ...drawbackFeats.map((f) => h("option", { value: f.name, selected: sel.feats[i] === f.name }, f.name)))
        s.addEventListener("change", () => { sel.feats[i] = s.value })
        return s
      }) : []
      return h("div", { class: `ct-row${disabled ? " ct-blocked" : ""}${c ? " ct-on" : ""}` },
        h("label", { class: "row", style: "gap:.4rem" }, control, h("b", {}, b.name)),
        h("span", { class: "pi-meta" }, "2 pts" + (b.repeatable ? " each, can be taken more than once" : "")),
        problem && !c ? h("span", { class: "note" }, problem) : cantAfford && !problem ? h("span", { class: "note" }, "needs 2 points") : null,
        ...featPickers,
        h("span", { class: "pi-sum ct-sum" }, b.summary), rules(b))
    }
    const q = sel.filter.trim().toLowerCase()
    fill(body, 
      h("div", { class: "row picker-filters" },
        field("Start from", templateSel), field("Name", nameBox), field("Casting ability", abil)),
      tpl ? h("p", { class: "note" }, tpl.summary, tpl.notes.length ? h("br") : null, tpl.notes.join(" · ")) : null,
      h("div", { class: `ct-points${rest < 0 ? " warn" : ""}` },
        h("b", {}, `Drawback points: ${pts}`), ` · Boons: ${boons} (−${2 * boons}) · `, h("b", {}, spLine),
        rest > 5 ? h("span", { class: "note" }, " (the table stops at 5: spend the rest on boons)") : null,
        rest < 0 ? h("span", {}, " — boons cost more than the drawbacks give") : null,
        sp && !L ? h("span", { class: "note" }, " No class has a caster level progression yet; the spell points formula needs one (Classes tab).") : null),
      h("h3", {}, "Drawbacks"), filter,
      h("div", { class: "ct-list" }, data.drawbacks.filter((d) => !q || d.name.toLowerCase().includes(q) || d.md.toLowerCase().includes(q)).map(drawbackRow)),
      h("h3", {}, "Boons"),
      h("div", { class: "ct-list" }, data.boons.map(boonRow)),
      h("div", { class: "row add-row" },
        h("button", { class: "primary", disabled: rest < 0 || !pts && !boons, onclick: async () => { await applyCastingTradition(sel, data, drawbackFeats, D, B); dlg.done(); toast(`Added the ${sel.name || "custom"} casting tradition`) } }, "Add casting tradition"),
        h("button", { onclick: () => dlg.done() }, "Cancel")))
  }
  render()

  async function applyCastingTradition() {
    const name = sel.name.trim() || "Custom tradition"
    const rest = left(), sp = Math.min(Math.max(rest, 0), 5)
    const L = castingLevelsFormula()
    const dList = Object.keys(sel.drawbacks).filter(taken)
    const bList = Object.keys(sel.boons).filter((b) => sel.boons[b])
    const lines = [
      `Casting ability: ${CT_ABILITIES[sel.ability]}`,
      `Drawbacks: ${dList.map((n) => `${n}${sel.drawbacks[n].count > 1 ? " ×2" : ""} (${pointsOf(n)})`).join(", ") || "none"}`,
      `Boons: ${bList.map((b) => `${b}${sel.boons[b] > 1 ? ` ×${sel.boons[b]}` : ""}`).join(", ") || "none"}`,
      `Bonus spell points: ${sp ? `${sp} drawback point${sp > 1 ? "s" : ""} left: ${data.spellPoints[sp]}` : "none"}`,
    ]
    const texts = [...dList.map((n) => `${n}${sel.drawbacks[n].count > 1 ? " (taken twice)" : ""}\n${mdToText(D[n].md)}`),
      ...bList.map((b) => `${b}${sel.boons[b] > 1 ? ` (×${sel.boons[b]})` : ""}\n${mdToText(B[b].md)}`)]
    const changes = sp && L ? [{ formula: CT_FORMULAS[sp](L), target: "spellPoints", type: "untyped", operator: "add" }] : []
    state.features.push(newFeature("misc", { name: `Casting tradition: ${name}`, desc: [lines.join("\n"), ...texts].join("\n\n"), changes }))
    for (const f of sel.feats.filter(Boolean)) {
      const e = drawbackFeats.find((x) => x.name === f)
      const full = e ? (await loadCompendium(e.file, { entries: [] })).entries.find((x) => x.id === e.id) : null
      state.features.push(newFeature("feat", { name: f, desc: mdToText(full?.md ?? e?.summary ?? ""), ref: e?.id }))
    }
    for (const b of bList) if (B[b].grantsSphere) {
      const key = sphereKey(B[b].grantsSphere)
      state.talents.push({ name: `${B[b].grantsSphere} sphere`, kind: sphereKind(key) ?? "magic", sphere: key, tags: "base sphere",
        exclude: false, desc: `Gained from the ${b} boon of the ${name} casting tradition.` })
    }
    state.sphere.casting = sel.ability
    // the tradition is now this "Other" feature: clear the settings' name field, which exports as its
    // own class feature, so Foundry doesn't get the tradition twice
    state.sphere.tradition = ""
    changed(true)
  }
}

// ---------- trade traditions ----------
// compendium/trade-traditions.json: the Vocation sphere's (trade) talents with the class skills each
// grants, plus the sample trade traditions as templates. A trade tradition replaces the first class's
// class skills: competent is two trade talents and a Guile sphere; adroit adds two more trade talents
// and another Guile sphere or a talent from the chosen one. A class skill granted by more than one
// trade talent gets +1 more once it has a rank (+4 instead of +3), as a change on that skill.
const skillLabel = (k) => SKILLS[k]?.[0] ?? k
const overlapChange = (k) => ({ formula: `min(1, @skills.${k}.rank)`, target: `skill.${k}`, type: "untyped", operator: "add" })

// a trade talent as a Spheres tab row (in the Vocation sphere), with its rules text
async function tradeTalentRow(t, extra = {}) {
  const index = await loadCompendium("index.json", [])
  const e = index.find((x) => x.id === t.id)
  const full = e ? (await loadCompendium(e.file, { entries: [] })).entries.find((x) => x.id === e.id) : null
  return { name: t.name, kind: "skill", sphere: "vocation", tags: (e?.tags ?? ["trade"]).join(", "), exclude: false, ref: t.id,
    desc: mdToText(full?.md ?? t.summary), ...extra }
}
// skills a set of trade talents grants more than once (each gets the +1 once)
function tradeOverlaps(talents) {
  const seen = new Set(), twice = new Set()
  for (const t of talents) for (const k of t.classSkills) (seen.has(k) ? twice : seen).add(k)
  return [...twice]
}
const tradeSelect = (list, value, label, onchange) => {
  const el = h("select", { "aria-label": label }, h("option", { value: "" }, "Choose a trade talent…"),
    ...list.map((t) => h("option", { value: t.name, selected: t.name === value }, `${t.name} — ${t.classSkills.map(skillLabel).join(", ") || t.classSkillsText}`)))
  el.addEventListener("change", () => onchange(el.value))
  return el
}

async function openTradeTradition() {
  const [data, index] = await Promise.all([
    loadCompendium("trade-traditions.json", { tradeTalents: [], automaticClassSkills: [], backgroundClassSkills: [], guileSpheres: [], templates: [] }),
    loadCompendium("index.json", []),
  ])
  const T = Object.fromEntries(data.tradeTalents.map((t) => [t.name, t]))
  const list = [...data.tradeTalents].sort((a, b) => a.name.localeCompare(b.name))
  const sel = { template: "", name: "", adroit: false, talents: ["", "", "", ""], sphere: "", bonusKind: "sphere", bonusSphere: "", bonusTalent: "" }
  const cls = state.classes[0]
  const body = h("div", { class: "ct-body" })
  const dlg = openDialog("Add trade tradition", body)
  dlg.classList.add("wide")
  const sphereTalents = (s) => index.filter((e) => e.sphere === s && /talent$/.test(e.kind)).sort((a, b) => a.name.localeCompare(b.name))
  const applyTemplate = (name) => {
    const t = data.templates.find((x) => x.name === name)
    sel.template = name
    if (!t) return
    sel.name = t.name
    sel.talents = [t.auto[0] ?? "", t.auto[1] ?? "", t.adroit[0] ?? "", t.adroit[1] ?? ""]
    sel.sphere = t.sphere ?? ""
    const o = t.bonus[0]
    sel.bonusKind = o?.talent ? "talent" : "sphere"
    sel.bonusSphere = o && !o.talent ? o.sphere : ""
    sel.bonusTalent = t.bonus.find((x) => x.talent)?.talent ?? ""
  }
  const chosen = () => sel.talents.slice(0, sel.adroit ? 4 : 2).filter(Boolean).map((n) => T[n])
  const render = () => {
    const picked = chosen()
    const auto = [...data.automaticClassSkills, ...(state.backgroundSkills ? data.backgroundClassSkills : [])]
    const skills = [...new Set([...auto, ...picked.flatMap((t) => t.classSkills)])]
    const overlaps = tradeOverlaps(picked)
    const templateSel = h("select", { "aria-label": "Template" }, h("option", { value: "" }, "Custom (start from nothing)"),
      ...data.templates.map((t) => h("option", { value: t.name, selected: sel.template === t.name }, t.name)))
    templateSel.addEventListener("change", () => { applyTemplate(templateSel.value); render() })
    const nameBox = h("input", { value: sel.name, placeholder: "Tradition name", "aria-label": "Tradition name" })
    nameBox.addEventListener("input", () => { sel.name = nameBox.value })
    const adroit = h("input", { type: "checkbox", checked: sel.adroit })
    adroit.addEventListener("change", () => { sel.adroit = adroit.checked; render() })
    const talentPick = (i) => tradeSelect(list, sel.talents[i], `Trade talent ${i + 1}`, (v) => { sel.talents[i] = v; render() })
    const sphereSel = (value, label, onchange) => {
      const el = h("select", { "aria-label": label }, h("option", { value: "" }, "Choose a Guile sphere…"),
        ...data.guileSpheres.filter((s) => s !== "Vocation").map((s) => h("option", { value: s, selected: s === value }, s)))
      el.addEventListener("change", () => onchange(el.value))
      return el
    }
    const tpl = data.templates.find((t) => t.name === sel.template)
    const problems = [
      picked.length < (sel.adroit ? 4 : 2) && `choose ${sel.adroit ? 4 : 2} trade talents`,
      !sel.sphere && "choose a Guile sphere",
      sel.adroit && (sel.bonusKind === "sphere" ? !sel.bonusSphere && "choose the adroit bonus sphere" : !sel.bonusTalent && "choose the adroit bonus talent"),
    ].filter(Boolean)
    fill(body, 
      h("div", { class: "row picker-filters" }, field("Start from", templateSel), field("Name", nameBox),
        h("label", { class: "row", style: "gap:.4rem;align-self:end" }, adroit, "Adroit (5 + Int or more skill ranks per level)")),
      tpl ? h("p", { class: "note" }, tpl.summary) : null,
      h("p", { class: "warn" }, `Warning: this erases ${cls?.name ? `${cls.name}'s` : "your first class's"} class skills. They'll be unchecked and replaced by the tradition's (more class skills from feats, traits and other sources still apply; add those back on the Classes tab).`),
      h("h3", {}, "Competent"),
      h("div", { class: "row picker-filters" }, field("Trade talent", talentPick(0)), field("Trade talent", talentPick(1)),
        field("Guile sphere", sphereSel(sel.sphere, "Guile sphere", (v) => { sel.sphere = v; render() }))),
      sel.adroit ? h("div", {},
        h("h3", {}, "Adroit"),
        h("div", { class: "row picker-filters" }, field("Trade talent", talentPick(2)), field("Trade talent", talentPick(3))),
        h("div", { class: "row picker-filters" },
          h("label", { class: "row", style: "gap:.4rem" }, h("input", { type: "radio", name: "tt-bonus", checked: sel.bonusKind === "sphere", onchange: () => { sel.bonusKind = "sphere"; render() } }), "Another Guile sphere"),
          sel.bonusKind === "sphere" ? sphereSel(sel.bonusSphere, "Bonus sphere", (v) => { sel.bonusSphere = v }) : null,
          h("label", { class: "row", style: "gap:.4rem" }, h("input", { type: "radio", name: "tt-bonus", checked: sel.bonusKind === "talent", onchange: () => { sel.bonusKind = "talent"; render() } }), `A talent from ${sel.sphere || "your chosen sphere"}`),
          sel.bonusKind === "talent" && sel.sphere ? (() => {
            const el = h("select", { "aria-label": "Bonus talent" }, h("option", { value: "" }, "Choose a talent…"),
              ...sphereTalents(sel.sphere).map((e) => h("option", { value: e.name, selected: e.name === sel.bonusTalent }, e.name)))
            el.addEventListener("change", () => { sel.bonusTalent = el.value })
            return el
          })() : null)) : null,
      h("div", { class: "ct-points" },
        h("b", {}, "Class skills: "), skills.map(skillLabel).join(", "),
        overlaps.length ? h("div", {}, h("b", {}, "Granted twice (+4 with a rank): "), overlaps.map(skillLabel).join(", ")) : null),
      problems.length ? h("p", { class: "note" }, `To add it: ${problems.join(", ")}.`) : null,
      h("div", { class: "row add-row" },
        h("button", { class: "primary", disabled: problems.length > 0, onclick: async () => {
          await applyTradeTradition(picked, skills, overlaps)
          dlg.done()
          toast(`Added the ${sel.name || "custom"} trade tradition`)
        } }, "Add trade tradition"),
        h("button", { onclick: () => dlg.done() }, "Cancel")))
  }
  render()

  async function applyTradeTradition(picked, skills, overlaps) {
    const name = sel.name.trim() || "Custom trade tradition"
    const rank = sel.adroit ? "Adroit" : "Competent"
    const bonus = !sel.adroit ? null : sel.bonusKind === "sphere" ? `${sel.bonusSphere} sphere` : `${sel.bonusTalent} (${sel.sphere})`
    state.features.push(newFeature("misc", { name: `Trade tradition: ${name} (${rank})`, changes: overlaps.map(overlapChange),
      desc: [`Trade rank: ${rank}`, `Trade talents: ${picked.map((t) => t.name).join(", ")}`, `Skill sphere: ${sel.sphere}`,
        bonus ? `Adroit bonus: ${bonus}` : "", `Class skills: ${skills.map(skillLabel).join(", ")}`,
        overlaps.length ? `Granted by more than one trade talent (+1 with a rank, so +4): ${overlaps.map(skillLabel).join(", ")}` : ""].filter(Boolean).join("\n") }))
    for (const t of picked) state.talents.push(await tradeTalentRow(t))
    const sphereRow = (s) => {
      const key = sphereKey(s)
      return { name: `${s} sphere`, kind: sphereKind(key) ?? "skill", sphere: key, tags: "base sphere", exclude: false,
        desc: `Skill sphere from the ${name} trade tradition.` }
    }
    state.talents.push(sphereRow(sel.sphere))
    if (sel.adroit && sel.bonusKind === "sphere") state.talents.push(sphereRow(sel.bonusSphere))
    if (sel.adroit && sel.bonusKind === "talent") {
      const e = index.find((x) => x.sphere === sel.sphere && x.name === sel.bonusTalent)
      const full = e ? (await loadCompendium(e.file, { entries: [] })).entries.find((x) => x.id === e.id) : null
      const key = sphereKey(sel.sphere)
      state.talents.push({ name: sel.bonusTalent, kind: sphereKind(key) ?? "skill", sphere: key, tags: (e?.tags ?? []).join(", "),
        exclude: false, ref: e?.id, desc: mdToText(full?.md ?? e?.summary ?? "") })
    }
    if (cls) cls.classSkills = skills
    state.tradeTraditions = true
    changed(true)
  }
}

// "+ Add class" with trade traditions on: the new class's class skills come from a trade talent
function addClassWithTrade() {
  const cls = blankClass(false)
  state.classes.push(cls)
  changed(true)
  const dlg = openDialog("Multiclassing with a trade tradition",
    h("p", {}, "You ignore a new class's class skills. Add a Vocation trade talent for multiclassing? Its class skills become this class's."),
    h("div", { class: "row add-row" },
      h("button", { class: "primary", onclick: () => { dlg.done(); pickMulticlassTrade(cls) } }, "Add a trade talent"),
      h("button", { onclick: () => dlg.done() }, "No")))
}

async function pickMulticlassTrade(cls) {
  const data = await loadCompendium("trade-traditions.json", { tradeTalents: [] })
  const list = [...data.tradeTalents].sort((a, b) => a.name.localeCompare(b.name))
  // skills an earlier trade talent already grants: a repeat gets the +1 (if it doesn't have it yet)
  const tradeRows = state.talents.filter((t) => t.sphere === "vocation" && /\btrade\b/.test(t.tags ?? ""))
  const granted = tradeRows.flatMap((t) => data.tradeTalents.find((x) => x.id === t.ref || x.name === t.name)?.classSkills ?? [])
  const boosted = new Set([...state.features, ...state.talents].flatMap((x) => (x.changes ?? [])
    .filter((ch) => /^min\(1, @skills\./.test(ch.formula ?? "")).map((ch) => ch.target.replace(/^skill\./, ""))))
  let choice = ""
  const info = h("p", { class: "note" })
  const pick = tradeSelect(list, "", "Trade talent", (v) => {
    choice = v
    const t = data.tradeTalents.find((x) => x.name === v)
    const repeats = (t?.classSkills ?? []).filter((k) => granted.includes(k) && !boosted.has(k))
    info.textContent = t ? `Class skills for this class: ${t.classSkills.map(skillLabel).join(", ") || t.classSkillsText}${repeats.length ? `. Already granted by a trade talent (+1 with a rank): ${repeats.map(skillLabel).join(", ")}` : ""}` : ""
  })
  const dlg = openDialog("Trade talent for multiclassing", field("Trade talent", pick), info,
    h("div", { class: "row add-row" },
      h("button", { class: "primary", onclick: async () => {
        const t = data.tradeTalents.find((x) => x.name === choice)
        if (!t) return
        const repeats = t.classSkills.filter((k) => granted.includes(k) && !boosted.has(k))
        state.talents.push(await tradeTalentRow(t, { changes: repeats.map(overlapChange) }))
        cls.classSkills = [...t.classSkills]
        changed(true)
        dlg.done()
        toast(`Added ${t.name} for multiclassing`)
      } }, "Add"),
      h("button", { onclick: () => dlg.done() }, "Cancel")))
}

// ---------- spells (Spells tab) ----------
// compendium/spells-index.json: every Pathfinder spell with its level per class. The picker filters by
// class first (a spell's level differs by class: holy sword is paladin 4), then by that class's spell
// level; a picked spell comes in at its level for the chosen class (or the spellcasting class).
const SCHOOL_KEYS = { abjuration: "abj", conjuration: "con", divination: "div", enchantment: "enc", evocation: "evo",
  illusion: "ill", necromancy: "nec", transmutation: "trs", universal: "uni" }
const schoolKey = (s) => SCHOOL_KEYS[(s ?? "").split(/[\s(\[]/)[0].toLowerCase()] ?? "misc"

function addSpell(extra = {}) {
  state.spells.push({ name: "", level: 1, school: "evo", desc: "", ...extra })
  changed(true)
  if (!extra.name) focusNewEntry()
}

function openSpellChooser() {
  const dlg = openDialog("Add spell",
    h("p", { class: "muted" }, "Pick a spell from the compendium to fill in its name, level, school and text, or add your own."),
    h("div", { class: "row add-row" },
      h("button", { class: "primary", onclick: () => { dlg.done(); openSpellSearch() } }, "From the compendium"),
      h("button", { onclick: () => { dlg.done(); addSpell() } }, "Custom spell")))
}

function openSpellSearch() {
  // the spellcasting class (Spells tab), when it's a class the spell lists name
  const castName = (state.classes[state.spellcasting.cls]?.name ?? "").trim().toLowerCase()
  const box = h("input", { type: "search", placeholder: "Search spells by name", "aria-label": "Search spells" })
  const fullText = h("input", { type: "checkbox" })
  const cls = h("select", { "aria-label": "Class" }, h("option", { value: "" }, "All classes"))
  const lvl = h("select", { "aria-label": "Spell level", disabled: true }, h("option", { value: "" }, "Any level"))
  const results = h("div", { class: "picker-results", role: "list" }, h("p", { class: "muted" }, "Loading spells…"))
  const dlg = openDialog("Add spell from the compendium",
    h("div", { class: "row picker-filters" }, box, cls, lvl),
    h("div", { class: "row picker-filters" }, h("label", { class: "row", style: "gap:.3rem" }, fullText, "Search spell text too")),
    results)
  let all = [], texts = null
  const levelOf = (f) => (cls.value ? f.levels[cls.value] : null)
  const fillLevels = () => {
    const keep = lvl.value
    const levels = cls.value ? [...new Set(all.filter((f) => cls.value in f.levels).map((f) => f.levels[cls.value]))].sort((a, b) => a - b) : []
    lvl.replaceChildren(h("option", { value: "" }, "Any level"),
      ...levels.map((n) => h("option", { value: n, selected: String(n) === keep }, n === 0 ? "0 (cantrips / orisons)" : `Level ${n}`)))
    lvl.disabled = !cls.value
    if (!levels.map(String).includes(keep)) lvl.value = ""
  }
  const render = () => {
    const q = box.value.trim().toLowerCase()
    const hits = all.filter((f) => (!cls.value || cls.value in f.levels) && (!lvl.value || String(f.levels[cls.value]) === lvl.value)
      && (!q || f.name.toLowerCase().includes(q) || (fullText.checked && texts?.[f.id]?.includes(q))))
    const rank = (f) => (!q ? 0 : f.name.toLowerCase().startsWith(q) ? 0 : f.name.toLowerCase().includes(q) ? 1 : 2)
    hits.sort((a, b) => rank(a) - rank(b) || (levelOf(a) ?? 0) - (levelOf(b) ?? 0) || a.name.localeCompare(b.name))
    const shown = hits.slice(0, 60)
    const levelText = (f) => cls.value ? `${cls.value} ${f.levels[cls.value]}`
      : Object.entries(f.levels).slice(0, 6).map(([c, n]) => `${c} ${n}`).join(", ") + (Object.keys(f.levels).length > 6 ? ", …" : "")
    fill(results, 
      ...shown.map((f) => h("button", { class: "picker-item", role: "listitem", onclick: () => pick(f) },
        h("span", { class: "pi-name" }, f.name, h("span", { class: "pi-meta" }, ` ${f.school} · ${levelText(f) || "no class level"}`)),
        f.summary ? h("span", { class: "pi-sum" }, f.summary) : null,
        h("span", { class: "pi-pre" }, [f.castingTime, f.range, f.duration, f.save && `Save ${f.save}`].filter(Boolean).join(" · ")))),
      hits.length > shown.length ? h("p", { class: "note" }, `Showing ${shown.length} of ${hits.length}; type more of the name${cls.value ? "" : " or pick a class"} to narrow it down.`) : null,
      hits.length ? null : h("p", { class: "muted" }, all.length ? "No spells match." : "Couldn't load the spells."))
  }
  const pick = async (f) => {
    fill(results, h("p", { class: "muted" }, `Adding ${f.name}…`))
    const data = await loadCompendium(f.file, { entries: [] })
    const full = data.entries.find((x) => x.id === f.id)
    const castLevel = Object.entries(f.levels).find(([c]) => c.toLowerCase() === castName)?.[1]
    const level = levelOf(f) ?? castLevel ?? Math.min(...Object.values(f.levels), 9)
    // the spell's own text: source, school and levels, casting, effect and description
    addSpell({ name: f.name, level: Number.isFinite(level) ? level : 1, school: schoolKey(f.school), ref: f.id,
      desc: mdToText(full?.md ?? f.summary) })
    dlg.done()
  }
  box.addEventListener("input", render)
  cls.addEventListener("change", () => { fillLevels(); render() })
  lvl.addEventListener("change", render)
  fullText.addEventListener("change", async () => {
    if (fullText.checked && !texts) {
      fill(results, h("p", { class: "muted" }, "Loading spell text…"))
      const data = await loadCompendium("spells.json", { entries: [] })
      texts = Object.fromEntries(data.entries.map((x) => [x.id, mdToText(x.md).toLowerCase()]))
    }
    render()
  })
  loadCompendium("spells-index.json", []).then((list) => {
    all = list
    const classes = [...new Set(list.flatMap((f) => Object.keys(f.levels)))].sort((a, b) => a.localeCompare(b))
    cls.replaceChildren(h("option", { value: "" }, "All classes"), ...classes.map((c) => h("option", { value: c, selected: c.toLowerCase() === castName }, c)))
    if (classes.some((c) => c.toLowerCase() === castName)) cls.value = classes.find((c) => c.toLowerCase() === castName)
    fillLevels()
    render()
  })
  box.focus()
}

// ---------- gear (the site's compendium) ----------
// compendium/gear-index-<cat>.json lists each category's items (Archives of Nethys and the Spheres
// pages) with price, weight and stats; gear-<cat>.json holds their text. Consumables can also be
// made from a spell (potion, scroll or wand), priced by the item creation rules.
const GEAR_PICK_CATS = { weapon: "Weapons", ammo: "Ammunition", armor: "Armor", shield: "Shields", gear: "Adventuring gear", consumable: "Consumables", magic: "Magic items" }
const COIN_CP = { pp: 1000, gp: 100, sp: 10, cp: 1 }
// spell-made consumables: highest spell level, price per spell level x caster level, weight (lb.)
const SPELL_ITEMS = {
  potion: { label: "Potion or oil", noun: "Potion", maxLevel: 3, rate: 50, weight: 0.0625, mat: 1 },
  scroll: { label: "Scroll", noun: "Scroll", maxLevel: 9, rate: 25, weight: 0, mat: 1 },
  wand: { label: "Wand (50 charges)", noun: "Wand", maxLevel: 4, rate: 750, weight: 0.0625, mat: 50 },
}
// a class's caster level when it first casts spells of a level: 9-level prepared casters 2n-1,
// spontaneous ones 2n, 6- and 4-level casters 3n-2 (Core Rulebook, Magic Items: potion and scroll costs)
const SPONTANEOUS_9 = ["Sorcerer", "Oracle", "Arcanist", "Psychic"]
const FULL_9 = ["Cleric", "Druid", "Wizard", "Witch", "Shaman"]
function minCasterLevel(cls, level) {
  if (level <= 0) return 1
  if (SPONTANEOUS_9.includes(cls)) return level === 1 ? 1 : 2 * level
  if (FULL_9.includes(cls) || !cls) return 2 * level - 1
  return 3 * level - 2
}
function spellItemPrice(type, level, cl, materialGp = 0) {
  const T = SPELL_ITEMS[type]
  return (level === 0 ? T.rate / 2 : T.rate * level) * cl + materialGp * T.mat
}
// "M (diamond dust worth 500 gp)" -> 500
const materialCost = (components) => [...(components ?? "").matchAll(/worth\s+([\d,]+)\s*gp/gi)].reduce((a, m) => a + +m[1].replace(/,/g, ""), 0)

const gp = (n) => (n == null ? "—" : n >= 1 || n === 0 ? `${(+n.toFixed(2)).toLocaleString("en-US")} gp` : n >= 0.1 ? `${+(n * 10).toFixed(1)} sp` : `${Math.round(n * 100)} cp`)
const lb = (n) => (n == null ? "" : n === 0 ? "—" : `${+n.toFixed(3)} lb.`)
// a magic item's slot as one of the body slots ("boots" -> feet, "neck or shoulder" -> neck)
const MAGIC_SLOTS = [[/^armor/, "armor"], [/^shield/, "shield"], [/^(belt|waist)/, "belt"], [/^(body|torso)/, "body"],
  [/^chest/, "chest"], [/^(eye|goggles)/, "eyes"], [/^(feet|boots)/, "feet"], [/^(hand|glove|gauntlet)/, "hands"],
  [/^headband/, "headband"], [/^(head|helm|mask|face)/, "head"], [/^(neck|amulet)/, "neck"], [/^ring/, "ring"],
  [/^(shoulder|cloak|mantle|back)/, "shoulders"], [/^wrist/, "wrist"], [/^weapon/, "weapon"]]
const magicSlot = (f) => { const s = (f.slot ?? "").toLowerCase().trim(); return MAGIC_SLOTS.find(([re]) => re.test(s))?.[1] ?? "none" }
// enhancement for a weapon, armor or shield bought from the compendium (priced by changeMagic)
// (a list: an object would put the number keys first)
const ENHANCEMENTS = [["", "Not magical"], ["mw", "Masterwork"], ...[1, 2, 3, 4, 5].map((n) => [n, `+${n}`])]

// the purse: the total in copper, and paying an amount (in gp) out of it, making change from a
// bigger coin when the smaller ones run out. Returns false (and pays nothing) when it can't.
const purseCp = () => Object.entries(COIN_CP).reduce((a, [k, v]) => a + num(state.currency[k]) * v, 0)
function pay(priceGp) {
  let due = Math.round(priceGp * 100)
  if (due <= 0) return true
  if (due > purseCp()) return false
  const coins = Object.fromEntries(Object.keys(COIN_CP).map((k) => [k, Math.max(0, Math.floor(num(state.currency[k])))]))
  for (const [k, v] of Object.entries(COIN_CP)) {
    const use = Math.min(coins[k], Math.floor(due / v))
    coins[k] -= use
    due -= use * v
  }
  if (due > 0) {
    // break the smallest coin worth more than what's left; the change comes back in smaller coins
    const [k, v] = Object.entries(COIN_CP).reverse().find(([k, v]) => coins[k] > 0 && v > due)
    coins[k] -= 1
    let change = v - due
    for (const [k2, v2] of Object.entries(COIN_CP)) {
      if (v2 >= v) continue
      coins[k2] += Math.floor(change / v2)
      change %= v2
    }
  }
  Object.assign(state.currency, coins)
  return true
}

function addGear(extra = {}) {
  state.gear.push({ name: "", kind: "loot", qty: 1, weight: 0, price: 0, equipped: false, desc: "", ...extra })
  changed(true)
  if (!extra.name) focusNewEntry()
}

function openGearChooser() {
  const dlg = openDialog("Add item",
    h("p", { class: "muted" }, "Pick an item from the compendium to fill in its price, weight, stats and text, or add your own."),
    h("div", { class: "row add-row" },
      ...Object.entries(GEAR_PICK_CATS).map(([cat, label]) =>
        h("button", { class: "primary", onclick: () => { dlg.done(); openGearSearch(cat) } }, label)),
      h("button", { onclick: () => { dlg.done(); addGear() } }, "Custom item")))
}

// a select of value -> label (the first option is "any")
const gearSelect = (aria, options) => h("select", { "aria-label": aria },
  ...(Array.isArray(options) ? options : Object.entries(options)).map(([v, l]) => h("option", { value: v }, l)))

// names and searches compare with curly quotes made straight ("Alchemist’s fire")
const fold = (t) => t.toLowerCase().replace(/[’‘]/g, "'")
function openGearSearch(cat) {
  const box = h("input", { type: "search", placeholder: `Search ${GEAR_PICK_CATS[cat].toLowerCase()} by name`, "aria-label": "Search items" })
  const fullText = h("input", { type: "checkbox" })
  const systems = { all: "All systems", pf: "Pathfinder", spheres: "Spheres" }
  const sys = gearSelect("System", systems)
  // the category's own filters: [key, select, test(entry, value)]
  const filters = {
    weapon: [
      ["prof", gearSelect("Proficiency", { "": "Any proficiency", Simple: "Simple", Martial: "Martial", Exotic: "Exotic" }), (f, v) => f.prof === v],
      ["attack", gearSelect("Melee or ranged", { "": "Melee or ranged", melee: "Melee", ranged: "Ranged" }),
        (f, v) => f.attack === v || (v === "ranged" && f.thrown)],
      ["hands", gearSelect("Hands", { "": "Any handedness", light: "Light", one: "One-handed", two: "Two-handed" }), (f, v) => f.hands === v],
      ["sub", gearSelect("Kind", { "": "All weapons", Weapon: "Weapons", Firearm: "Firearms", Explosive: "Explosives",
        "Siege engine": "Siege engines", Modification: "Modifications" }), (f, v) => f.sub === v],
    ],
    ammo: [["ammoFor", gearSelect("For", { "": "For any weapon", Bows: "Bows", Crossbows: "Crossbows", Firearms: "Firearms (and powder, gear)",
      Slings: "Slings", "Darts and blowguns": "Darts and blowguns", "Siege engines": "Siege engines" }), (f, v) => f.ammoFor === v]],
    armor: [["armorType", gearSelect("Armor type", { "": "Any armor", light: "Light", medium: "Medium", heavy: "Heavy",
      extra: "Extras (spikes, gauntlet)", mod: "Modifications" }), (f, v) => f.armorType === v]],
    shield: [
      ["shieldType", gearSelect("Shield type", { "": "Any shield", buckler: "Buckler", light: "Light", heavy: "Heavy", tower: "Tower" }), (f, v) => f.shieldType === v],
      ["material", gearSelect("Material", { "": "Any material", wood: "Wooden", steel: "Steel", leather: "Leather", other: "Other" }), (f, v) => f.material === v],
    ],
    gear: [["sub", gearSelect("Category", { "": "All categories" }), (f, v) => f.sub === v]],
    magic: [
      ["sub", gearSelect("Group", { "": "All groups" }), (f, v) => f.sub === v],
      ["slot", gearSelect("Slot", { "": "Any slot" }), (f, v) => magicSlot(f) === v],
    ],
    consumable: [["sub", gearSelect("Group", { "": "All groups" }), (f, v) => f.sub === v]],
  }[cat]
  // consumables: made from a spell, or picked from the list
  const mode = gearSelect("Consumable", { list: "Potions, compounds and scrolls (listed)",
    ...Object.fromEntries(Object.entries(SPELL_ITEMS).map(([k, T]) => [k, `${T.label} of a spell`])) })
  const spellCls = h("select", { "aria-label": "Class" }, h("option", { value: "" }, "Cheapest class"))
  const spellLvl = h("select", { "aria-label": "Spell level" }, h("option", { value: "" }, "Any level"))
  const clBox = h("input", { type: "number", min: 1, max: 20, placeholder: "min", style: "width:4.5rem", "aria-label": "Caster level" })
  const qty = h("input", { type: "number", min: 1, value: 1, style: "width:4rem", "aria-label": "Quantity" })
  const enh = gearSelect("Enhancement", ENHANCEMENTS)
  const buy = h("input", { type: "checkbox" })
  const purse = h("span", { class: "note" })
  const showPurse = () => purse.replaceChildren(`You have ${Object.keys(COIN_CP).map((k) => `${num(state.currency[k])} ${k}`).join(", ")}`)
  showPurse()
  const results = h("div", { class: "picker-results", role: "list" }, h("p", { class: "muted" }, "Loading…"))
  const spellRow = h("div", { class: "row picker-filters", style: "display:none" }, spellCls, spellLvl,
    h("label", { class: "row", style: "gap:.3rem" }, "Caster level", clBox))
  const filterRow = h("div", { class: "row picker-filters" }, ...(filters ?? []).map(([, el]) => el))
  const dlg = openDialog(`Add ${GEAR_PICK_CATS[cat].toLowerCase()} from the compendium`,
    cat === "consumable" ? h("div", { class: "row picker-filters" }, mode) : null,
    h("div", { class: "row picker-filters" }, box, state.spheresModule ? sys : null),
    filterRow, spellRow,
    h("div", { class: "row picker-filters" },
      h("label", { class: "row", style: "gap:.3rem" }, fullText, "Search item text too"),
      h("label", { class: "row", style: "gap:.3rem" }, "Qty", qty),
      ["weapon", "armor", "shield"].includes(cat) ? h("label", { class: "row", style: "gap:.3rem" }, "Enhancement", enh) : null),
    h("div", { class: "row picker-filters" },
      h("label", { class: "row", style: "gap:.3rem" }, buy, "Buy it (pay from your coins)"), purse),
    state.spheresModule ? null : h("p", { class: "note" }, "Spheres items are listed when Spheres is turned on."),
    results)
  let all = [], spells = null, texts = null, spellTexts = null
  const spellMode = () => cat === "consumable" && mode.value !== "list"
  const inSystem = (f) => (state.spheresModule || isPf(f)) && (sys.value === "all" || (sys.value === "pf") === isPf(f))
  // dropdowns that list what the data has (gear categories, magic item groups and slots)
  const fillOptions = () => {
    for (const [key, el] of filters ?? []) {
      if (el.options.length > 1 && key !== "sub" && key !== "slot") continue
      if (!["gear", "magic", "consumable"].includes(cat)) continue
      const counts = {}
      for (const f of all) if (inSystem(f)) { const v = key === "slot" ? magicSlot(f) : f[key]; if (v) counts[v] = (counts[v] || 0) + 1 }
      const keep = el.value
      el.replaceChildren(el.options[0], ...Object.keys(counts).sort((a, b) => a.localeCompare(b))
        .map((v) => h("option", { value: v }, `${v[0].toUpperCase()}${v.slice(1)} (${counts[v]})`)))
      el.value = keep in counts ? keep : ""
    }
  }
  const metaOf = (f) => {
    const bits = [gp(f.price ?? null) === "—" ? f.priceText || "no price" : gp(f.price), lb(f.weight)]
    if (cat === "weapon") bits.push([f.prof, f.attack === "ranged" ? "ranged" : f.thrown ? "melee, thrown" : f.attack,
      { light: "light", one: "one-handed", two: "two-handed" }[f.hands]].filter(Boolean).join(" "),
    [f.dmgM, f.critMult && `${f.critRange < 20 ? `${f.critRange}-20/` : ""}×${f.critMult}`, f.dmgType].filter(Boolean).join(" "))
    if (cat === "armor") bits.push(`${f.armorType}`, f.ac ? `AC +${f.ac}` : "", f.maxDex != null ? `max Dex +${f.maxDex}` : "", f.acp ? `ACP −${f.acp}` : "")
    if (cat === "shield") bits.push(f.shieldType, f.material !== "other" ? f.material : "", `AC +${f.ac}`, f.acp ? `ACP −${f.acp}` : "")
    if (cat === "gear" || cat === "consumable") bits.push(f.sub)
    if (cat === "ammo") bits.push(`for ${f.ammoFor.toLowerCase()}`)
    if (cat === "magic") bits.push(f.sub, f.slot && f.slot !== "none" ? `slot ${f.slot}` : "", f.base ? `+${f.enh} ${f.base.toLowerCase()}` : "")
    if (!isPf(f)) bits.push(f.system)
    return bits.filter(Boolean).join(" · ")
  }
  // a spell's item in the chosen form: the class and level it's made at, caster level and price
  const spellItem = (f) => {
    const T = SPELL_ITEMS[mode.value]
    const options = Object.entries(f.levels).filter(([c, n]) => (!spellCls.value || c === spellCls.value) && n <= T.maxLevel)
    if (!options.length) return null
    const mat = materialCost(f.components)
    const priced = options.map(([c, n]) => {
      const cl = Math.max(minCasterLevel(c, n), num(clBox.value) || 0)
      return { cls: c, level: n, cl, price: spellItemPrice(mode.value, n, cl, mat) }
    })
    return priced.sort((a, b) => a.price - b.price)[0]
  }
  const render = () => {
    const q = fold(box.value.trim())
    // (.row sets display, which beats the hidden attribute)
    filterRow.style.display = spellMode() ? "none" : ""
    spellRow.style.display = spellMode() ? "" : "none"
    sys.style.display = spellMode() ? "none" : ""
    if (spellMode()) return renderSpells(q)
    const hits = all.filter((f) => inSystem(f) && (filters ?? []).every(([, el, test]) => !el.value || test(f, el.value))
      && (!q || fold(f.name).includes(q) || (fullText.checked && texts?.[f.id]?.includes(q))))
    const rank = (f) => (!q ? 0 : fold(f.name).startsWith(q) ? 0 : fold(f.name).includes(q) ? 1 : 2)
    hits.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
    const shown = hits.slice(0, 60)
    fill(results, 
      ...shown.map((f) => h("button", { class: "picker-item", role: "listitem", onclick: () => pick(f) },
        h("span", { class: "pi-name" }, f.name, h("span", { class: "pi-meta" }, ` ${metaOf(f)}`)),
        f.summary ? h("span", { class: "pi-sum" }, f.summary) : null)),
      hits.length > shown.length ? h("p", { class: "note" }, `Showing ${shown.length} of ${hits.length}; type more of the name or narrow the filters.`) : null,
      hits.length ? null : h("p", { class: "muted" }, all.length ? "Nothing matches." : "Couldn't load the list."))
  }
  const renderSpells = (q) => {
    if (!spells) return
    const T = SPELL_ITEMS[mode.value]
    const hits = spells.map((f) => [f, spellItem(f)]).filter(([f, it]) => it && (!spellLvl.value || String(it.level) === spellLvl.value)
      && (!q || fold(f.name).includes(q) || (fullText.checked && spellTexts?.[f.id]?.includes(q))))
    const rank = (f) => (!q ? 0 : fold(f.name).startsWith(q) ? 0 : fold(f.name).includes(q) ? 1 : 2)
    hits.sort(([a, x], [b, y]) => rank(a) - rank(b) || x.level - y.level || a.name.localeCompare(b.name))
    const shown = hits.slice(0, 60)
    fill(results, 
      ...shown.map(([f, it]) => h("button", { class: "picker-item", role: "listitem", onclick: () => pickSpell(f) },
        h("span", { class: "pi-name" }, `${T.noun} of ${f.name}`,
          h("span", { class: "pi-meta" }, ` ${gp(it.price)} · ${it.cls} ${it.level}, CL ${it.cl}${materialCost(f.components) ? " · includes material cost" : ""}`)),
        f.summary ? h("span", { class: "pi-sum" }, f.summary) : null)),
      hits.length > shown.length ? h("p", { class: "note" }, `Showing ${shown.length} of ${hits.length}; type more of the name or pick a class and level.`) : null,
      hits.length ? null : h("p", { class: "muted" }, `No spells of level ${T.maxLevel} or lower match.`))
  }
  const fillSpellLevels = () => {
    const T = SPELL_ITEMS[mode.value]
    if (!T) return
    const keep = spellLvl.value
    spellLvl.replaceChildren(h("option", { value: "" }, "Any level"),
      ...Array.from({ length: T.maxLevel + 1 }, (_, n) => h("option", { value: n }, n === 0 ? "0 (cantrips / orisons)" : `Level ${n}`)))
    spellLvl.value = +keep <= T.maxLevel ? keep : ""
  }
  // buy (if asked) and add: false when the purse is short
  const acquire = (item, price) => {
    const n = Math.max(1, num(qty.value) || 1)
    const total = (price ?? 0) * n
    if (buy.checked && !pay(total)) {
      results.prepend(h("p", { class: "warn" }, `You can't afford ${item.name} (${gp(total)}); you have ${gp(purseCp() / 100)}. Uncheck "Buy it" to add it anyway.`))
      return false
    }
    addGear({ ...item, qty: n })
    if (buy.checked) toast(`Bought ${n > 1 ? `${n} × ` : ""}${item.name} for ${gp(total)}`)
    dlg.done()
    return true
  }
  const pick = async (f) => {
    const data = await loadCompendium(f.file ?? `gear-${cat}.json`, { entries: [] })
    const full = data.entries.find((x) => x.id === f.id)
    const small = ["sm", "tiny", "dim", "fine"].includes(state.race.size)
    const as = f.as ?? cat
    const e = Number(enh.value) || (enh.value === "mw" ? "mw" : 0)
    let name = f.name, price = f.price ?? 0
    const item = { kind: { weapon: "weapon", ammo: "ammo", armor: "armor", shield: "shield", gear: f.consumable ? "consumable" : "loot",
      consumable: "consumable", magic: "equipment" }[as] ?? "equipment",
    weight: (f.weight ?? 0) * (small && ["weapon", "armor", "shield"].includes(cat) ? 0.5 : 1), ref: f.id,
    desc: mdToText(full?.md ?? f.summary) }
    if (cat === "consumable") item.subType = /scroll/i.test(f.sub) ? "scroll" : "potion"
    else if (f.consumable) item.subType = "misc" // alchemical items, herbs, food
    if (as === "weapon") {
      Object.assign(item, { attack: f.attack === "ranged" ? "ranged" : "melee", damage: (small ? f.dmgS : f.dmgM) || f.dmgM || "",
        dmgType: (f.dmgType ?? "").match(/[BPS]/g)?.join("/") ?? "", critRange: f.critRange ?? 20, critMult: f.critMult ?? 2, enh: f.enh ?? 0 })
    }
    if (as === "armor" || as === "shield") {
      Object.assign(item, { ac: f.ac ?? 0, maxDex: f.maxDex ?? "", acp: f.acp ?? 0, asf: f.asf ?? 0, enh: f.enh ?? 0,
        armorType: as === "armor" ? `${["light", "medium", "heavy"].includes(f.armorType) ? f.armorType : "light"}Armor`
          : { buckler: "other", light: "lightShield", heavy: "heavyShield", tower: "towerShield" }[f.shieldType] ?? "other" })
    }
    if (as === "weapon") item.prof = f.prof ?? ""
    const row = { ...item, name, price, abilities: [], mods: [] }
    if (cat === "magic" && MAGIC_KINDS.includes(as)) {
      // a specific magic weapon or armor: its price already includes masterwork and its bonus
      row.masterwork = true
      if (as !== "weapon") row.acp = Math.max(0, num(row.acp) - 1)
    } else if (e && MAGIC_KINDS.includes(cat) && ["Weapon", "Firearm", undefined].includes(f.sub)) {
      row.enh = 0
      changeMagic(row, (x) => { if (e === "mw") x.masterwork = true; else x.enh = e })
    }
    acquire(row, row.price)
  }
  const pickSpell = async (f) => {
    const it = spellItem(f)
    const T = SPELL_ITEMS[mode.value]
    const data = await loadCompendium("spells.json", { entries: [] })
    const full = data.entries.find((x) => x.id === f.id)
    const name = `${T.noun} of ${f.name}${mode.value === "potion" ? "" : ` (CL ${it.cl})`}`
    acquire({ name, kind: "consumable", subType: mode.value, weight: T.weight, price: it.price, ref: f.id,
      desc: `${T.label}: ${f.name} (${it.cls} ${it.level}), caster level ${it.cl}, ${gp(it.price)}.\n\n${mdToText(full?.md ?? f.summary)}` }, it.price)
  }
  const loadSpells = async () => {
    if (spells) return
    fill(results, h("p", { class: "muted" }, "Loading spells…"))
    spells = await loadCompendium("spells-index.json", [])
    const classes = [...new Set(spells.flatMap((f) => Object.keys(f.levels)))].sort((a, b) => a.localeCompare(b))
    const castName = (state.classes[state.spellcasting.cls]?.name ?? "").trim().toLowerCase()
    spellCls.replaceChildren(h("option", { value: "" }, "Cheapest class"), ...classes.map((c) => h("option", { value: c }, c)))
    spellCls.value = classes.find((c) => c.toLowerCase() === castName) ?? ""
  }
  const loadTexts = async () => {
    if (spellMode()) {
      if (spellTexts) return
      const data = await loadCompendium("spells.json", { entries: [] })
      spellTexts = Object.fromEntries(data.entries.map((x) => [x.id, mdToText(x.md).toLowerCase()]))
    } else if (!texts) {
      const data = await loadCompendium(`gear-${cat}.json`, { entries: [] })
      texts = Object.fromEntries(data.entries.map((x) => [x.id, mdToText(x.md).toLowerCase()]))
    }
  }
  box.addEventListener("input", render)
  sys.addEventListener("change", () => { fillOptions(); render() })
  for (const [, el] of filters ?? []) el.addEventListener("change", render)
  for (const el of [spellCls, spellLvl]) el.addEventListener("change", render)
  clBox.addEventListener("input", render)
  mode.addEventListener("change", async () => {
    if (spellMode()) { await loadSpells(); fillSpellLevels() }
    if (fullText.checked) await loadTexts()
    render()
  })
  fullText.addEventListener("change", async () => {
    if (fullText.checked) {
      fill(results, h("p", { class: "muted" }, "Loading item text…"))
      await loadTexts()
    }
    render()
  })
  loadCompendium(`gear-index-${cat}.json`, []).then((list) => {
    all = list.map((f) => ({ ...f, file: `gear-${cat}.json` }))
    fillOptions()
    render()
  })
  box.focus()
}

// ---------- magic weapons, armor and shields ----------
// A weapon, armor or shield row carries its enhancement bonus, masterwork, special abilities
// (compendium/gear-index-ability.json: a +N bonus or a flat gp cost each) and modifications
// (gear-index-mod.json: Adventurer's Armory 2 and Spheres weapon modifications). Its price moves by
// what each change costs (Core Rulebook: weapons 2,000 gp x bonus squared, armor and shields 1,000;
// masterwork 300 / 150; flat-cost abilities and modifications added on), so a price typed in by hand
// is kept and only adjusted.
const MAGIC_KINDS = ["weapon", "armor", "shield"]
const MAX_ENHANCEMENT = 5
const MAX_TOTAL_BONUS = 10
const abilityBonus = (g) => (g.abilities ?? []).reduce((a, x) => a + num(x.bonus), 0)
const totalBonus = (g) => num(g.enh) + abilityBonus(g)
// masterwork comes with any magic (the enhancement bonus or a special ability)
const isMasterwork = (g) => !!g.masterwork || totalBonus(g) > 0 || (g.abilities ?? []).length > 0
function magicCost(g) {
  const [mw, per] = g.kind === "weapon" ? [300, 2000] : [150, 1000]
  const bonus = totalBonus(g)
  const flat = (g.abilities ?? []).reduce((a, x) => a + num(x.gp), 0)
  const mods = (g.mods ?? []).reduce((a, x) => a + num(x.price), 0)
  return (isMasterwork(g) ? mw : 0) + per * bonus * bonus + flat + mods
}
// "+1 longsword" / "Masterwork longsword": the prefix the row's name gets from its enhancement
const magicPrefix = (g) => (num(g.enh) ? `+${num(g.enh)} ` : isMasterwork(g) ? "Masterwork " : "")
// apply a change to a row and move its price (and masterwork armor's check penalty) with it;
// returns the price difference (what buying the change costs)
function changeMagic(g, mutate, { dryRun = false } = {}) {
  const before = { cost: magicCost(g), mw: isMasterwork(g), prefix: magicPrefix(g) }
  const copy = dryRun ? structuredClone(g) : g
  mutate(copy)
  const delta = Math.round((magicCost(copy) - before.cost) * 100) / 100
  if (dryRun) return delta
  g.price = Math.round((num(g.price) + delta) * 100) / 100
  if (g.kind !== "weapon" && before.mw !== isMasterwork(g)) g.acp = Math.max(0, num(g.acp) + (isMasterwork(g) ? -1 : 1))
  // rename "+1 longsword" -> "+2 longsword" (a name without the prefix is left alone)
  const name = g.name ?? ""
  if (before.prefix && name.startsWith(before.prefix)) {
    const rest = name.slice(before.prefix.length)
    g.name = magicPrefix(g) ? magicPrefix(g) + rest : rest.charAt(0).toUpperCase() + rest.slice(1)
  } else if (!before.prefix && magicPrefix(g) && name) g.name = magicPrefix(g) + (g.ref ? name.charAt(0).toLowerCase() + name.slice(1) : name)
  return delta
}
// what a special ability goes on, for this row
const abilitySlot = (g) => (g.kind === "weapon" ? (g.attack === "ranged" ? "ranged" : "melee") : g.kind)
// Armor Adept: ignore two armor modifications' drawbacks per feat; Weapon Adept: one weapon modification per feat
function adeptAllowance() {
  const count = (re) => state.features.filter((f) => re.test(f.name ?? "")).length
  const ignored = (kinds) => new Set(state.gear.filter((g) => kinds.includes(g.kind))
    .flatMap((g) => (g.mods ?? []).filter((m) => m.ignored).map((m) => m.name.toLowerCase())))
  return {
    armor: { feats: count(/^armor adept/i), allowed: 2 * count(/^armor adept/i), used: ignored(["armor", "shield"]).size },
    weapon: { feats: count(/^weapon adept/i), allowed: count(/^weapon adept/i), used: ignored(["weapon"]).size },
  }
}
const PROF_STEPS = ["Simple", "Martial", "Exotic"]

// the row's "Magic and modifications" block
function magicBlock(g, i) {
  g.abilities ??= []
  g.mods ??= []
  const set = (mutate) => { changeMagic(g, mutate); changed(true) }
  const enh = h("select", { "aria-label": "Enhancement bonus" },
    ...Array.from({ length: MAX_ENHANCEMENT + 1 }, (_, n) => h("option", { value: n, selected: num(g.enh) === n }, n ? `+${n}` : "None")))
  enh.addEventListener("change", () => set((x) => { x.enh = +enh.value }))
  const mw = h("input", { type: "checkbox", checked: isMasterwork(g), disabled: totalBonus(g) > 0 || g.abilities.length > 0 })
  mw.addEventListener("change", () => set((x) => { x.masterwork = mw.checked }))
  const bonus = totalBonus(g)
  const adept = adeptAllowance()
  const modKind = g.kind === "weapon" ? "weapon" : "armor"
  const warnings = [
    g.abilities.some((a) => a.bonus) && !num(g.enh) ? "Special abilities need at least a +1 enhancement bonus." : "",
    bonus > MAX_TOTAL_BONUS ? `The total bonus is +${bonus}; the most is +${MAX_TOTAL_BONUS}.` : "",
    adept[modKind].used > adept[modKind].allowed
      ? `${adept[modKind].used} ${modKind} modification${adept[modKind].used > 1 ? "s" : ""} ignored, but ${modKind === "weapon" ? "Weapon" : "Armor"} Adept (taken ${adept[modKind].feats} time${adept[modKind].feats === 1 ? "" : "s"}) covers ${adept[modKind].allowed}.` : "",
  ].filter(Boolean)
  // a modified weapon is one category harder to wield per modification without Weapon Adept for it
  let wield = null
  if (g.kind === "weapon" && g.mods.length) {
    const steps = g.mods.filter((m) => m.drawback && !m.ignored).length
    const base = PROF_STEPS.indexOf(g.prof ?? "")
    wield = steps ? (base < 0 ? `Wielded ${steps} categor${steps > 1 ? "ies" : "y"} harder than normal.`
      : base + steps < PROF_STEPS.length ? `Wielded as a${PROF_STEPS[base + steps] === "Exotic" ? "n" : ""} ${PROF_STEPS[base + steps].toLowerCase()} weapon (${g.prof.toLowerCase()} + ${steps} modification${steps > 1 ? "s" : ""}).`
        : `Harder to wield than exotic (${g.prof.toLowerCase()} + ${steps} modification${steps > 1 ? "s" : ""}): only with Weapon Adept.`) : null
  }
  const drawbacks = g.kind !== "weapon" ? g.mods.filter((m) => m.drawback && !m.ignored) : []
  const chip = (text, title, onRemove, extra) => h("span", { class: "mchip", title },
    text, extra ?? null, h("button", { class: "small ghost", "aria-label": `Remove ${text}`, onclick: onRemove }, "✕"))
  return h("div", { class: "magic-block" },
    h("div", { class: "row", style: "gap:.6rem;flex-wrap:wrap;align-items:center" },
      h("span", { class: "group-title", style: "margin:0" }, "Magic and modifications"),
      h("label", { class: "row", style: "gap:.3rem" }, "Enhancement", enh),
      h("label", { class: "row", style: "gap:.3rem" }, mw, "Masterwork"),
      h("button", { class: "small", onclick: () => openAbilityPicker(i) }, "+ Special ability"),
      h("button", { class: "small", onclick: () => openModPicker(i) }, "+ Modification")),
    g.abilities.length || g.mods.length ? h("div", { class: "row", style: "gap:.4rem;flex-wrap:wrap;margin-top:.4rem" },
      ...g.abilities.map((a, k) => chip(`${a.name}${a.label ? ` (${a.label})` : ""} ${a.bonus ? `+${a.bonus}` : gp(num(a.gp))}`, a.summary ?? "",
        () => set((x) => { x.abilities.splice(k, 1) }))),
      ...g.mods.map((m, k) => {
        const ign = h("input", { type: "checkbox", checked: !!m.ignored, title: "Ignore its drawback (Armor Adept / Weapon Adept)" })
        ign.addEventListener("change", () => { m.ignored = ign.checked; changed(true) })
        return chip(`${m.name} ${gp(num(m.price))}`, m.drawback ? `Drawback: ${m.drawback}` : "",
          () => set((x) => { x.mods.splice(k, 1); x.weight = Math.max(0, num(x.weight) - num(m.weight)) }),
          m.drawback ? h("label", { class: "row", style: "gap:.2rem;font-size:.85em" }, ign, "ignore drawback") : null)
      })) : null,
    h("p", { class: "note", style: "margin:.35rem 0 0" },
      `Total bonus +${bonus} of +${MAX_TOTAL_BONUS}${num(g.enh) ? ` (+${num(g.enh)} enhancement)` : ""}; magic, masterwork and modifications cost ${gp(magicCost(g))} of the price.`),
    wield ? h("p", { class: "note", style: "margin:.2rem 0 0" }, wield) : null,
    ...drawbacks.map((m) => h("p", { class: "note", style: "margin:.2rem 0 0" }, `${m.name}: ${m.drawback}`)),
    ...warnings.map((w) => h("p", { class: "warn", style: "margin:.2rem 0 0" }, w)))
}

// pick a special ability (or a modification) for row i; shows what each costs this item
function openUpgradePicker(i, which) {
  const g = state.gear[i]
  const isAbility = which === "ability"
  const slot = isAbility ? abilitySlot(g) : g.kind
  const slotName = { melee: "melee weapon", ranged: "ranged weapon", weapon: "weapon", armor: "armor", shield: "shield" }[slot]
  const box = h("input", { type: "search", placeholder: `Search ${isAbility ? "special abilities" : "modifications"} by name`, "aria-label": "Search" })
  const fullText = h("input", { type: "checkbox" })
  const cost = gearSelect("Cost", [["", "Any cost"], ...[1, 2, 3, 4, 5].map((n) => [String(n), `+${n} bonus`]), ["gp", "Flat gp cost"]])
  const buy = h("input", { type: "checkbox" })
  const results = h("div", { class: "picker-results", role: "list" }, h("p", { class: "muted" }, "Loading…"))
  const dlg = openDialog(`Add ${isAbility ? "a special ability" : "a modification"} to ${g.name || `this ${slotName}`}`,
    h("div", { class: "row picker-filters" }, box, isAbility ? cost : null),
    h("div", { class: "row picker-filters" },
      h("label", { class: "row", style: "gap:.3rem" }, fullText, "Search the text too"),
      h("label", { class: "row", style: "gap:.3rem" }, buy, "Buy it (pay the difference from your coins)")),
    h("p", { class: "note" }, isAbility ? `Special abilities for a ${slotName}. A +N ability counts toward the +${MAX_TOTAL_BONUS} limit; flat-cost ones don't.`
      : g.kind === "weapon" ? "Each Adventurer's Armory modification makes the weapon one category harder to wield (Weapon Adept ignores that for one modification)."
        : "Each modification has a drawback (Armor Adept ignores the drawbacks of two)."),
    results)
  let all = [], texts = null
  // one row per price option (Fortification: light / moderate / heavy)
  const options = (f) => (isAbility ? (f.prices?.length ? f.prices : [{ label: "", bonus: 0 }]) : [{}])
  const apply = (f, o) => (x) => {
    if (isAbility) x.abilities.push({ ref: f.id, name: f.name, label: o.label || "", bonus: o.bonus ?? 0, gp: o.gp ?? 0, summary: f.summary ?? "" })
    else {
      x.mods.push({ ref: f.id, name: f.name, price: f.price ?? 0, weight: f.weight ?? 0, drawback: f.drawback ?? "", ignored: false })
      x.weight = num(x.weight) + num(f.weight)
    }
  }
  const render = () => {
    const q = fold(box.value.trim())
    const rows = []
    for (const f of all) {
      if (!(state.spheresModule || isPf(f))) continue
      if (q && !fold(f.name).includes(q) && !(fullText.checked && texts?.[f.id]?.includes(q))) continue
      for (const o of options(f)) {
        if (cost.value && (cost.value === "gp" ? !o.gp : String(o.bonus) !== cost.value)) continue
        rows.push([f, o])
      }
    }
    const rank = (f) => (!q ? 0 : fold(f.name).startsWith(q) ? 0 : 1)
    rows.sort(([a], [b]) => rank(a) - rank(b) || a.name.localeCompare(b.name))
    const shown = rows.slice(0, 60)
    fill(results,
      ...shown.map(([f, o]) => {
        const delta = changeMagic(g, apply(f, o), { dryRun: true })
        const what = isAbility ? (o.bonus ? `+${o.bonus} bonus` : `${gp(o.gp)} flat`) : `${gp(f.price ?? 0)}${f.weight ? `, +${lb(f.weight)}` : ""}`
        const over = isAbility && totalBonus(g) + num(o.bonus) > MAX_TOTAL_BONUS
        return h("button", { class: "picker-item", role: "listitem", onclick: () => pick(f, o) },
          h("span", { class: "pi-name" }, `${f.name}${o.label ? ` (${o.label})` : ""}`,
            h("span", { class: "pi-meta" }, ` ${what} · this ${slotName}: +${gp(delta)}${over ? ` · over +${MAX_TOTAL_BONUS}` : ""}${isPf(f) ? "" : ` · ${f.system}`}`)),
          f.summary ? h("span", { class: "pi-sum" }, f.summary) : null,
          f.drawback ? h("span", { class: "pi-pre" }, `Drawback: ${f.drawback}`) : null)
      }),
      rows.length > shown.length ? h("p", { class: "note" }, `Showing ${shown.length} of ${rows.length}; type more of the name.`) : null,
      rows.length ? null : h("p", { class: "muted" }, all.length ? "Nothing matches." : `No ${isAbility ? "special abilities" : "modifications"} for a ${slotName}.`))
  }
  const pick = (f, o) => {
    const delta = changeMagic(g, apply(f, o), { dryRun: true })
    if (buy.checked && !pay(delta)) {
      results.prepend(h("p", { class: "warn" }, `You can't afford it (${gp(delta)}); you have ${gp(purseCp() / 100)}. Uncheck "Buy it" to add it anyway.`))
      return
    }
    changeMagic(g, apply(f, o))
    if (buy.checked) toast(`Paid ${gp(delta)} for ${f.name}`)
    dlg.done()
    changed(true)
  }
  box.addEventListener("input", render)
  cost.addEventListener("change", render)
  fullText.addEventListener("change", async () => {
    if (fullText.checked && !texts) {
      fill(results, h("p", { class: "muted" }, "Loading text…"))
      const data = await loadCompendium(`gear-${which}.json`, { entries: [] })
      texts = Object.fromEntries(data.entries.map((x) => [x.id, mdToText(x.md).toLowerCase()]))
    }
    render()
  })
  loadCompendium(`gear-index-${which}.json`, []).then((list) => {
    all = list.filter((f) => (f.applies ?? []).includes(slot))
    render()
  })
  box.focus()
}
const openAbilityPicker = (i) => openUpgradePicker(i, "ability")
const openModPicker = (i) => openUpgradePicker(i, "mod")

// carrying capacity (Core Rulebook table 7-4; x4 for every 10 points above 20), by size for a biped
const CARRY_TABLE = [100, 115, 130, 150, 175, 200, 230, 260, 300, 350]
const CARRY_SIZE = { fine: 0.125, dim: 0.25, tiny: 0.5, sm: 0.75, med: 1, lg: 2, huge: 4, grg: 8, col: 16 }
function carryCapacity(str, size) {
  str = Math.floor(str)
  if (str <= 0) return { light: 0, medium: 0, heavy: 0 }
  const heavy = (str <= 10 ? 10 * str : CARRY_TABLE[(str - 10) % 10] * 4 ** Math.floor((str - 10) / 10)) * (CARRY_SIZE[size] ?? 1)
  return { light: Math.floor(heavy / 3), medium: Math.floor((heavy * 2) / 3), heavy }
}
// what's carried (items not marked as left behind, and coins at 50 to the pound) and the load
function encumbrance(s, strTotal) {
  const items = s.gear.reduce((a, g) => a + (g.carried === false ? 0 : num(g.weight) * num(g.qty)), 0)
  const coins = Object.keys(COIN_CP).reduce((a, k) => a + num(s.currency[k]), 0) / 50
  const cap = carryCapacity(strTotal, s.race.size)
  const total = items + coins
  const load = total <= cap.light ? "light" : total <= cap.medium ? "medium" : total <= cap.heavy ? "heavy" : "overloaded"
  // medium: max Dex +3, check penalty -3; heavy: +1 / -6; both slow you down
  const effect = { light: {}, medium: { maxDex: 3, acp: 3, slow: true }, heavy: { maxDex: 1, acp: 6, slow: true },
    overloaded: { maxDex: 0, acp: 6, slow: true } }[load]
  return { items, coins, total, cap, load, ...effect }
}
// Gear tab: capacity and what's carried (refreshed in place as weights change; see changed())
function carryCard() {
  const c = calc()
  const e = c.enc
  const loads = { light: "Light", medium: "Medium", heavy: "Heavy", overloaded: "Over your heavy load" }
  return h("div", { class: "card", id: "carry-card" },
    h("div", { class: "group-title", style: "margin-top:0" }, "Carrying capacity"),
    h("dl", { class: "kv" },
      h("dt", {}, "Light / medium / heavy load"), h("dd", {}, `${e.cap.light} / ${e.cap.medium} / ${e.cap.heavy} lb.`),
      h("dt", {}, "Carried"), h("dd", {}, `${+e.total.toFixed(2)} lb. (items ${+e.items.toFixed(2)}, coins ${+e.coins.toFixed(2)})`),
      h("dt", {}, "Load"), h("dd", { class: e.load === "light" ? "" : "warn" }, loads[e.load] +
        (e.slow ? ` (max Dex +${e.maxDex}, check penalty −${e.acp}, slower speed)` : "")),
    ),
    h("p", { class: "note", style: "margin:.4rem 0 0" },
      `From Strength ${Math.floor(c.abl.str.total + (c.changeTotals.carryStr ?? 0))} and ${SIZES[state.race.size]?.[0] ?? "Medium"} size; 50 coins weigh a pound. Small characters' weapons and armor weigh half.`))
}
// an item can be left behind (on the mount, at the inn): it then doesn't count toward the load
function carriedBox(p) {
  const el = h("input", { type: "checkbox", checked: getPath(state, p + "carried") !== false })
  el.addEventListener("change", () => { setPath(state, p + "carried", el.checked); changed() })
  return h("label", { class: "row", style: "gap:.3rem" }, el, "Carried")
}

// adding to a sphere offers its talents from the compendium (or a custom one); a talent with no
// sphere set is just a blank row
function addSphereTalent(sphere) {
  if (sphere) openCompendiumChooser("talent", { sphere })
  else addTalent(sphere)
}

// a talent in a sphere: blank to fill in, or (extra) filled from the compendium
function addTalent(sphere, extra = {}) {
  state.talents.push({ name: "", kind: sphereKind(sphere) ?? "magic", sphere, tags: "", exclude: false, desc: "", ...extra })
  changed(true)
  if (extra.name) return
  const rows = [...document.querySelectorAll("#panel .sphere-block")]
  const block = rows.find((b) => b.querySelector("h3")?.textContent === (sphere ? label(sphere) : "No sphere set"))
  const inputs = block?.querySelectorAll('input[placeholder="Talent name"]')
  inputs?.[inputs.length - 1]?.focus()
}

function groupBy(key, labels) {
  return (list) => {
    const groups = {}
    for (const k of Object.keys(labels)) groups[labels[k]] = []
    list.forEach((e, i) => groups[labels[e[key]] ?? "Other"]?.push(i))
    return Object.fromEntries(Object.entries(groups).filter(([, v]) => v.length))
  }
}

// editable list of typed entries (feats, talents, spells, gear) with a description box each
function entryList(key, make, fields, addLabel, grouper, extras) {
  const list = state[key]
  const wrap = h("div", { class: "picked-list" })
  const renderEntry = (i) => {
    const e = list[i]
    const p = `${key}.${i}.`
    const desc = textarea(p + "desc", { rows: 3, placeholder: "Description or rules text (optional)" })
    const det = h("details", { style: "flex-basis:100%" }, h("summary", { class: "note" }, e.desc ? "Description" : "Add description"), desc)
    return h("div", { class: "card class-row", style: "margin:0" },
      ...fields(e, p),
      h("div", { class: "spacer" }),
      h("button", { class: "small danger", "aria-label": `Remove ${e.name || "entry"}`, onclick: () => { list.splice(i, 1); changed(true) } }, "Remove"),
      det,
      extras ? extras(e) : null,
    )
  }
  if (!list.length) wrap.append(h("p", { class: "muted" }, "Nothing added yet."))
  else if (grouper) {
    for (const [title, idxs] of Object.entries(grouper(list))) {
      wrap.append(h("div", { class: "group-title" }, `${title} (${idxs.length})`))
      for (const i of idxs) wrap.append(renderEntry(i))
    }
  } else list.forEach((_, i) => wrap.append(renderEntry(i)))
  // addLabel: one add button's label, or a function returning the tab's own add buttons
  const add = typeof addLabel === "function" ? addLabel() : h("button", {
    style: "margin-top:.75rem",
    onclick: () => {
      list.push(make())
      changed(true)
      focusNewEntry()
    },
  }, addLabel)
  return h("div", {}, wrap, add)
}

// focus a just-added entry's (empty) name box
function focusNewEntry() {
  const inputs = document.querySelectorAll(`#panel input[placeholder]`)
  const target = [...inputs].find((el) => el.value === "" && el.closest(".class-row"))
  target?.focus()
}

function refreshSkillCounters() {
  const c = calc()
  const bonus = document.querySelector('#panel [data-counter="bonus"]')
  if (bonus)
    bonus.textContent = c.bonusSkill.value == null
      ? "Foundry will calculate this formula; it isn't included in the preview count."
      : `Extra ranks on top of class, Intelligence, race and favored class: ${signed(c.bonusSkill.value)}. Same as the Bonus Skill Ranks box on Foundry's Skills tab.`
  const over = c.bgUsed - c.bgBudget
  const adv = document.querySelector('#panel [data-counter="adv"]')
  const bg = document.querySelector('#panel [data-counter="bg"]')
  if (adv) {
    adv.textContent = `Ranks: ${c.ranksUsed} / ${c.skillBudget}`
    adv.className = c.ranksUsed > c.skillBudget ? "warn" : ""
  }
  if (bg) {
    bg.textContent = `Ranks: ${Math.min(c.bgUsed, c.bgBudget)} / ${c.bgBudget}${over > 0 ? ` (${over} taken from adventuring ranks)` : ""}`
    bg.className = over > 0 ? "warn" : ""
  }
}

const skillAbl = (k) => state.skillAbility[k] || SKILLS[k][1]

function skillTotal(k, rank, c, abl = skillAbl(k)) {
  const acp = SKILLS[k][3]
  let t = rank + c.abl[abl].mod
  if (rank > 0 && c.classSkills.has(k)) t += 3
  if (acp) t -= c.acp
  return t + (c.skillExtra ? c.skillExtra(k, abl, rank) : 0)
}

function renderPanel() {
  const panel = document.getElementById("panel")
  const scroll = window.scrollY
  panel.replaceChildren(...panels[tab]().flat().filter(Boolean))
  refreshSkillCounters()
  window.scrollTo(0, scroll)
}

// ---------- Foundry export ----------

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
function randomId(len = 16) {
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  return [...bytes].map((b) => ID_CHARS[b % ID_CHARS.length]).join("")
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])
const toHtml = (text) => (text || "").trim().split(/\n{2,}/).filter(Boolean).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("")
const tagFor = (name) => (name.trim().toLowerCase().replace(/[^a-z0-9]+(.)/g, (_, c) => c.toUpperCase()).replace(/[^a-zA-Z0-9]/g, "") || "class")

function item(type, name, system, extra = {}) {
  return { _id: randomId(), name: name || "Unnamed", type, system, ...extra }
}

function buildActor() {
  const s = state
  const c = calc()
  const items = []

  if (s.race.name) {
    const changes = ABL.filter((k) => num(s.race.mods[k])).map((k) => ({ _id: randomId(8).toLowerCase(), formula: String(num(s.race.mods[k])), target: k, type: "racial" }))
    if (num(s.race.bonusFeats)) changes.push({ _id: randomId(8).toLowerCase(), formula: String(num(s.race.bonusFeats)), target: "bonusFeats", type: "untyped" })
    if (num(s.race.bonusSkillPerLevel)) changes.push({ _id: randomId(8).toLowerCase(), formula: `${num(s.race.bonusSkillPerLevel)} * @attributes.hd.total`, target: "bonusSkillRanks", type: "untyped" })
    items.push(item("race", s.race.name, { size: s.race.size, speeds: { land: num(s.race.speed) }, changes }))
  }

  const tags = {}
  s.classes.forEach((cls, i) => {
    if (num(cls.level) <= 0) return
    let tag = tagFor(cls.name || `Class ${i + 1}`)
    while (Object.values(tags).includes(tag)) tag += "X"
    tags[i] = tag
    const system = {
      subType: "base",
      tag,
      level: num(cls.level),
      hd: num(cls.hd),
      hp: c.classHp[i],
      bab: cls.bab,
      skillsPerLevel: num(cls.skills),
      savingThrows: { fort: { value: cls.fort }, ref: { value: cls.ref }, will: { value: cls.will } },
      classSkills: Object.fromEntries(cls.classSkills.map((k) => [k, true])),
      fc: { hp: { value: cls.favored ? num(cls.fcbHp) : 0 }, skill: { value: cls.favored ? num(cls.fcbSkill) : 0 }, alt: { value: 0 } },
    }
    const extra = s.spheresModule && cls.caster !== "none" ? { flags: { pf1spheres: { casterProgression: cls.caster } } } : {}
    items.push(item("class", cls.name || `Class ${i + 1}`, system, extra))
  })

  for (const f of s.features)
    items.push(item("feat", f.name, { subType: f.kind, description: { value: toHtml(f.desc) }, changes: exportChanges(f), contextNotes: exportNotes(f) }))
  for (const b of s.buffs)
    items.push(item("buff", b.name, {
      subType: b.kind || "temp",
      active: !!b.active,
      level: b.level === "" || b.level == null ? 0 : num(b.level),
      duration: { value: String(b.duration ?? "").trim() || null, units: b.units || "", end: "" },
      description: { value: toHtml(b.desc) },
      changes: exportChanges(b),
      contextNotes: exportNotes(b),
    }))
  if (s.spheresModule && s.sphere.tradition) items.push(item("feat", s.sphere.tradition, { subType: "classFeat", tags: ["Casting Tradition"], description: { value: "" } }))
  // talents only make sense with the pf1spheres module, so they're left out when it's switched off
  if (s.spheresModule)
    for (const t of s.talents) {
      const flags = {}
      if (t.sphere) flags.sphere = t.sphere
      if (t.exclude) flags.countExcluded = true
      const tags = String(t.tags || "").split(",").map((x) => x.trim()).filter(Boolean)
      const system = { subType: (TALENT_KINDS[t.kind] ?? TALENT_KINDS.magic)[0], tags, description: { value: toHtml(t.desc) }, changes: exportChanges(t), contextNotes: exportNotes(t) }
      items.push(item("feat", t.name, system, Object.keys(flags).length ? { flags: { pf1spheres: flags } } : {}))
    }

  const hasBook = s.spellcasting.cls >= 0 && tags[s.spellcasting.cls]
  for (const sp of s.spells)
    items.push(item("spell", sp.name, { level: num(sp.level), school: sp.school, spellbook: "primary", description: { value: toHtml(sp.desc) } }))

  for (const g of s.gear) items.push(gearItem(g))

  const skills = {}
  for (const k of Object.keys(SKILLS)) {
    const entry = { rank: BG_ONLY.includes(k) && !s.backgroundSkills ? 0 : num(s.skills[k]) }
    if (s.skillAbility[k]) entry.ability = s.skillAbility[k]
    if (SUB_SKILLS.includes(k) && s.subSkills[k].length) {
      entry.subSkills = {}
      s.subSkills[k].forEach((sub, i) => {
        entry.subSkills[`${k}${i + 1}`] = { name: sub.name || `${SKILLS[k][0]} ${i + 1}`, ability: sub.ability || SKILLS[k][1], rt: !!SKILLS[k][2], acp: !!SKILLS[k][3], rank: num(sub.rank) }
      })
    }
    skills[k] = entry
  }

  const bio = toHtml(s.bio) + (s.notes.trim() ? `<h2>Notes</h2>${toHtml(s.notes)}` : "")
  const system = {
    abilities: Object.fromEntries(ABL.map((k) => [k, { value: num(s.abilities[k]) }])),
    details: {
      alignment: s.details.alignment,
      gender: s.details.gender,
      age: s.details.age,
      height: s.details.height,
      weight: s.details.weight,
      deity: s.details.deity,
      bonusSkillRankFormula: s.bonusSkillFormula.trim(),
      bonusFeatFormula: num(s.bonusFeats) ? String(num(s.bonusFeats)) : "",
      biography: { value: bio },
    },
    traits: {
      size: s.race.size,
      languages: s.details.languages.split(",").map((l) => l.trim().toLowerCase()).filter(Boolean),
    },
    attributes: { speed: { land: { base: num(s.race.speed) } } },
    skills,
    currency: Object.fromEntries(["pp", "gp", "sp", "cp"].map((k) => [k, num(s.currency[k])])),
  }
  if (hasBook) {
    const cls = s.classes[s.spellcasting.cls]
    system.attributes.spells = {
      spellbooks: {
        primary: {
          inUse: true,
          name: cls.name,
          class: tags[s.spellcasting.cls],
          ability: s.spellcasting.ability,
          casterType: s.spellcasting.progression,
          spellPreparationMode: s.spellcasting.type,
          autoSpellLevelCalculation: true,
        },
      },
    }
  }

  const { portrait, ...savedState } = s
  const flags = { [FLAG_SCOPE]: { state: JSON.parse(JSON.stringify(savedState)), version: 1 } }
  const sphereFlags = {}
  if (s.spheresModule) {
    if (s.sphere.casting) sphereFlags.castingAbility = s.sphere.casting
    if (s.sphere.practitioner) sphereFlags.practitionerAbility = s.sphere.practitioner
    if (s.sphere.operative) sphereFlags.operativeAbility = s.sphere.operative
  }
  if (Object.keys(sphereFlags).length) flags.pf1spheres = sphereFlags

  const name = s.name || "New Character"
  return {
    name,
    type: "character",
    img: "icons/svg/mystery-man.svg",
    system,
    prototypeToken: { name, actorLink: true, disposition: 1 },
    items,
    effects: [],
    flags,
  }
}

function gearItem(g) {
  const base = {
    quantity: num(g.qty),
    weight: { value: num(g.weight) },
    price: num(g.price),
    carried: g.carried !== false,
    description: { value: toHtml(g.desc) },
  }
  switch (g.kind) {
    case "weapon": {
      const ranged = g.attack === "ranged"
      const types = [...new Set(String(g.dmgType || "").toUpperCase().match(/[BPS]/g) ?? [])].map((t) => DAMAGE_TYPES[t])
      const action = {
        _id: randomId(),
        name: "Attack",
        actionType: ranged ? "rwak" : "mwak",
        activation: { type: "attack", unchained: { type: "attack" } },
        ability: { attack: "_default", damage: ranged ? "" : "str", critRange: num(g.critRange) || 20, critMult: num(g.critMult) || 2 },
        damage: { parts: g.damage ? [{ formula: g.damage, types }] : [] },
        range: { units: ranged ? "ft" : "melee" },
        extraAttacks: { type: "standard" },
      }
      return item("weapon", g.name, { ...base, equipped: !!g.equipped, enh: num(g.enh) || null, masterwork: isMasterwork(g), actions: [action] })
    }
    case "armor":
      return item("equipment", g.name, {
        ...base, subType: "armor", equipmentSubtype: g.armorType || "lightArmor", slot: "armor", equipped: !!g.equipped,
        armor: { value: num(g.ac), enh: num(g.enh), dex: g.maxDex === "" || g.maxDex == null ? null : num(g.maxDex), acp: Math.abs(num(g.acp)) },
        spellFailure: num(g.asf),
      })
    case "shield":
      return item("equipment", g.name, {
        ...base, subType: "shield", equipmentSubtype: g.armorType || "lightShield", slot: "shield", equipped: !!g.equipped,
        armor: { value: num(g.ac), enh: num(g.enh), acp: Math.abs(num(g.acp)) },
        spellFailure: num(g.asf),
      })
    case "equipment":
      return item("equipment", g.name, { ...base, subType: "wondrous", slot: "slotless", equipped: !!g.equipped })
    case "consumable":
      return item("consumable", g.name, { ...base, subType: ["potion", "scroll", "wand"].includes(g.subType) ? g.subType : g.subType ? "misc" : "potion" })
    case "ammo":
      return item("loot", g.name, { ...base, subType: "ammo" })
    default:
      return item("loot", g.name, { ...base, subType: "gear" })
  }
}

function fileSlug() {
  return (state.name || "character").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "character"
}
function download(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const a = h("a", { href: URL.createObjectURL(blob), download: filename })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
// Shrink the chosen image so it fits comfortably in browser storage and the PDF
function loadPortrait(file) {
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => {
    const scale = Math.min(1, 600 / img.width, 750 / img.height)
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const ctx = canvas.getContext("2d")
    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(url)
    state.portrait = canvas.toDataURL("image/jpeg", 0.85)
    changed(true)
  }
  img.onerror = () => {
    URL.revokeObjectURL(url)
    toast("That image couldn't be read. Try a PNG or JPEG.")
  }
  img.src = url
}

const loadScript = (src) =>
  new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const el = h("script", { src })
    el.onload = resolve
    el.onerror = () => reject(new Error(`Couldn't load ${src}`))
    document.head.append(el)
  })

async function exportPdf() {
  const btn = document.getElementById("btnPdf")
  btn.disabled = true
  btn.textContent = "Building PDF…"
  try {
    await loadScript("vendor/pdf-lib.min.js")
    await loadScript("sheet-pdf.js")
    const bytes = await buildSheetPdf()
    const blob = new Blob([bytes], { type: "application/pdf" })
    const a = h("a", { href: URL.createObjectURL(blob), download: `${fileSlug()}-sheet.pdf` })
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    toast("PDF sheet downloaded.")
  } catch (err) {
    console.error(err)
    toast("Couldn't build the PDF. Try again, or reload the page.")
  } finally {
    btn.disabled = false
    btn.textContent = "PDF sheet"
  }
}

function exportActor() {
  const missing = state.classes.some((c) => num(c.level) > 0 && !c.name.trim())
  download(`fvtt-Actor-${fileSlug()}.json`, buildActor())
  toast(missing ? "Exported. Some classes have no name, so they were called “Class N”." : "Exported. In Foundry: right-click an actor → Import Data.")
}

function loadFile(file) {
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result)
      const saved = data.flags?.[FLAG_SCOPE]?.state ?? data[FLAG_SCOPE] ?? (data.v === 1 ? data : null)
      if (!saved) throw new Error("not a builder file")
      state = normalize(saved)
      save()
      renderAll()
      toast(`Loaded ${state.name || "character"}.`)
    } catch {
      toast("That file wasn't made by this builder, so it can't be loaded. Actors exported straight from Foundry aren't supported.")
    }
  }
  reader.readAsText(file)
}

// ---------- boot ----------

function renderAll() {
  renderHeader()
  renderTabs()
  renderPanel()
  renderSummary()
}

document.getElementById("charName").addEventListener("input", (e) => {
  state.name = e.target.value
  changed()
})
document.getElementById("btnExport").addEventListener("click", exportActor)
document.getElementById("btnPdf")?.addEventListener("click", exportPdf)
document.getElementById("spheresToggle").addEventListener("change", (e) => {
  state.spheresModule = e.target.checked
  if (state.spheresModule) tab = "spheres"
  changed(true)
})
document.getElementById("btnNew").addEventListener("click", () => {
  if (!confirm("Start a new character? The current one is only kept if you've exported or saved it.")) return
  state = blankState()
  tab = "details"
  save()
  renderAll()
})
document.getElementById("fileLoad").addEventListener("change", (e) => {
  if (e.target.files[0]) loadFile(e.target.files[0])
  e.target.value = ""
})

// follow the wiki's dark-mode toggle when embedded on the site
function applyTheme(theme) {
  if (theme === "dark" || theme === "light") document.documentElement.dataset.theme = theme
}
try {
  window.parent?.document?.addEventListener("themechange", (e) => applyTheme(e.detail?.theme))
} catch {}
window.addEventListener("storage", (e) => e.key === "theme" && applyTheme(e.newValue))

renderAll()
loadClassData()
loadRaceData()
