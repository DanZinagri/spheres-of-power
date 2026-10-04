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
const ALIGNMENTS = { lg: "Lawful Good", ng: "Neutral Good", cg: "Chaotic Good", ln: "Lawful Neutral", tn: "True Neutral", cn: "Chaotic Neutral", le: "Lawful Evil", ne: "Neutral Evil", ce: "Chaotic Evil" }
const SIZES = { fine: ["Fine", 8], dim: ["Diminutive", 4], tiny: ["Tiny", 2], sm: ["Small", 1], med: ["Medium", 0], lg: ["Large", -1], huge: ["Huge", -2], grg: ["Gargantuan", -4], col: ["Colossal", -8] }
const PROGRESSION = { high: "High", med: "Medium", low: "Low" }
const SAVE_PROG = { high: "Good", low: "Poor" }
const CASTER_PROG = { none: "None", low: "Low (½)", mid: "Mid (¾)", high: "High (full)" }
const FEATURE_KINDS = { feat: "Feat", trait: "Trait", classFeat: "Class feature", racial: "Racial trait", misc: "Other" }
const SCHOOLS = { abj: "Abjuration", con: "Conjuration", div: "Divination", enc: "Enchantment", evo: "Evocation", ill: "Illusion", nec: "Necromancy", trs: "Transmutation", uni: "Universal", misc: "Other" }
const MAGIC_SPHERES = ["alteration", "bear", "blood", "conjuration", "creation", "dark", "death", "destruction", "divination", "enhancement", "fallenFey", "fate", "illusion", "life", "light", "mana", "mind", "nature", "protection", "telekinesis", "time", "war", "warp", "weather"]
const COMBAT_SPHERES = ["alchemy", "athletics", "barrage", "barroom", "beastmastery", "berserker", "boxing", "brute", "dualWielding", "duelist", "equipment", "fencing", "gladiator", "guardian", "lancer", "leadership", "openHand", "scoundrel", "scout", "shield", "sniper", "trap", "warleader", "wrestling"]
const GEAR_KINDS = { weapon: "Weapon", armor: "Armor", shield: "Shield", equipment: "Wondrous / worn", consumable: "Consumable", loot: "Gear / loot" }
const ARMOR_TYPES = { lightArmor: "Light", mediumArmor: "Medium", heavyArmor: "Heavy" }
const SHIELD_TYPES = { lightShield: "Light", heavyShield: "Heavy", towerShield: "Tower", other: "Other" }
const DAMAGE_TYPES = { B: "bludgeoning", P: "piercing", S: "slashing" }
const POINT_COST = { 7: -4, 8: -2, 9: -1, 10: 0, 11: 1, 12: 2, 13: 3, 14: 5, 15: 7, 16: 10, 17: 13, 18: 17 }

const TABS = [
  ["details", "Details"], ["abilities", "Abilities"], ["race", "Race"], ["classes", "Classes"],
  ["skills", "Skills"], ["features", "Feats & Features"], ["spheres", "Spheres"], ["spells", "Spells"],
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
    race: { name: "", size: "med", speed: 30, mods: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, bonusFeats: 0, bonusSkillPerLevel: 0 },
    classes: [blankClass(true)],
    hpMode: "pfs",
    skills: {},
    subSkills: { crf: [], prf: [], pro: [] },
    features: [],
    talents: [],
    sphere: { casting: "", practitioner: "", tradition: "" },
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
  for (const k of ["details", "abilities", "race", "sphere", "spellcasting", "currency", "subSkills"]) out[k] = { ...base[k], ...(s[k] || {}) }
  out.race.mods = { ...base.race.mods, ...(s.race?.mods || {}) }
  out.classes = (s.classes?.length ? s.classes : base.classes).map((c, i) => ({ ...blankClass(i === 0), ...c }))
  for (const k of ["features", "talents", "spells", "gear"]) out[k] = Array.isArray(s[k]) ? s[k] : []
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

function calc() {
  const s = state
  const abl = {}
  for (const k of ABL) {
    const total = num(s.abilities[k]) + num(s.race.mods[k])
    abl[k] = { total, mod: mod(total) }
  }
  const classes = s.classes.filter((c) => num(c.level) > 0)
  const hd = classes.reduce((a, c) => a + num(c.level), 0)
  const babFor = { high: (l) => l, med: (l) => Math.floor(l * 0.75), low: (l) => Math.floor(l / 2) }
  const saveFor = { high: (l) => 2 + Math.floor(l / 2), low: (l) => Math.floor(l / 3) }
  const bab = classes.reduce((a, c) => a + babFor[c.bab](num(c.level)), 0)
  const saves = {}
  for (const k of ["fort", "ref", "will"]) saves[k] = classes.reduce((a, c) => a + saveFor[c[k]](num(c.level)), 0)
  const classHp = s.classes.map((c, i) => classHpFor(c, i))
  const hp = classHp.reduce((a, b) => a + b, 0) + abl.con.mod * hd + classes.reduce((a, c) => a + num(c.fcbHp), 0)

  const size = SIZES[s.race.size]?.[1] ?? 0
  let armor = 0, shield = 0, maxDex = Infinity, acp = 0, asf = 0
  for (const g of s.gear) {
    if (!g.equipped) continue
    if (g.kind === "armor") {
      armor += num(g.ac)
      if (g.maxDex !== "" && g.maxDex != null) maxDex = Math.min(maxDex, num(g.maxDex))
    }
    if (g.kind === "shield") shield += num(g.ac)
    if (g.kind === "armor" || g.kind === "shield") {
      acp += Math.abs(num(g.acp))
      asf += num(g.asf)
    }
  }
  const dexAc = Math.min(abl.dex.mod, maxDex)
  const ac = 10 + armor + shield + dexAc + size
  const touch = 10 + dexAc + size
  const flat = 10 + armor + shield + Math.min(0, dexAc) + size
  const cmb = bab + abl.str.mod - size
  const cmd = 10 + bab + abl.str.mod + abl.dex.mod - size

  const classSkills = new Set(classes.flatMap((c) => c.classSkills))
  let skillBudget = 0
  for (const c of classes) skillBudget += Math.max(1, num(c.skills) + abl.int.mod) * num(c.level) + num(c.fcbSkill)
  skillBudget += num(s.race.bonusSkillPerLevel) * hd
  let ranksUsed = Object.values(s.skills).reduce((a, r) => a + num(r), 0)
  for (const k of SUB_SKILLS) ranksUsed += s.subSkills[k].reduce((a, e) => a + num(e.rank), 0)

  const featSlots = Math.ceil(hd / 2) + num(s.race.bonusFeats)
  const featsTaken = s.features.filter((f) => f.kind === "feat").length
  const cl = Math.floor(classes.reduce((a, c) => a + ({ none: 0, low: 0.5, mid: 0.75, high: 1 }[c.caster] ?? 0) * num(c.level), 0))
  const pointsSpent = ABL.reduce((a, k) => a + (POINT_COST[num(s.abilities[k])] ?? NaN), 0)
  return { abl, hd, bab, saves, hp, classHp, ac, touch, flat, cmb, cmd, acp, asf, classSkills, skillBudget, ranksUsed, featSlots, featsTaken, cl, pointsSpent, size }
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

function changed(rerender) {
  save()
  renderSummary()
  renderHeader()
  renderTabs()
  if (rerender) renderPanel()
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
  const classes = state.classes.filter((c) => c.name && num(c.level) > 0).map((c) => `${c.name} ${c.level}`)
  const bits = [ALIGNMENTS[state.details.alignment], state.race.name, classes.join(" / ")].filter(Boolean)
  document.getElementById("charLine").textContent = bits.join(" · ") || "Pathfinder 1e character for Foundry VTT"
}

function renderTabs() {
  const counts = { features: state.features.length, spheres: state.talents.length, spells: state.spells.length, gear: state.gear.length }
  const nav = document.getElementById("tabs")
  nav.replaceChildren(
    ...TABS.map(([id, label]) =>
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
  document.getElementById("summary").replaceChildren(
    h("div", { class: "card" },
      h("div", { class: "stat-grid" },
        ...ABL.map((k) => stat(k.toUpperCase(), `${c.abl[k].total} (${signed(c.abl[k].mod)})`)),
      ),
    ),
    h("div", { class: "card" },
      h("div", { class: "stat-grid" }, stat("HP", c.hp), stat("AC", c.ac), stat("Init", signed(c.abl.dex.mod))),
      h("dl", { class: "kv", style: "margin-top:.6rem" },
        h("dt", {}, "Touch / flat-footed"), h("dd", {}, `${c.touch} / ${c.flat}`),
        h("dt", {}, "BAB"), h("dd", {}, signed(c.bab)),
        h("dt", {}, "CMB / CMD"), h("dd", {}, `${signed(c.cmb)} / ${c.cmd}`),
        h("dt", {}, "Fort"), h("dd", {}, signed(c.saves.fort + c.abl.con.mod)),
        h("dt", {}, "Ref"), h("dd", {}, signed(c.saves.ref + c.abl.dex.mod)),
        h("dt", {}, "Will"), h("dd", {}, signed(c.saves.will + c.abl.wis.mod)),
        h("dt", {}, "Speed"), h("dd", {}, `${num(state.race.speed)} ft.`),
        c.cl ? h("dt", {}, "Sphere caster level") : null, c.cl ? h("dd", {}, c.cl) : null,
        c.acp ? h("dt", {}, "Armor check penalty") : null, c.acp ? h("dd", {}, `−${c.acp}`) : null,
      ),
    ),
    h("div", { class: "card" },
      budget("Skill ranks", c.ranksUsed, c.skillBudget),
      budget("Feats", c.featsTaken, c.featSlots),
      h("div", { class: "budget" }, h("span", {}, "Character level"), h("span", {}, c.hd)),
      h("p", { class: "note", style: "margin:.4rem 0 0" }, "Preview only. Foundry recalculates everything when the file is imported."),
    ),
  )
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
        field("Race name", input("race.name", { placeholder: "Human, Elf, …" })),
        field("Size", select("race.size", Object.fromEntries(Object.entries(SIZES).map(([k, v]) => [k, v[0]])))),
        field("Land speed (ft.)", input("race.speed", { type: "number", min: 0, step: 5 })),
      ),
      h("h3", {}, "Racial ability adjustments"),
      h("div", { class: "grid" }, ABL.map((k) => field(ABILITIES[k], input(`race.mods.${k}`, { type: "number", step: 1 })))),
      h("h3", {}, "Racial bonuses"),
      h("div", { class: "grid" },
        field("Bonus feats", input("race.bonusFeats", { type: "number", min: 0 }), "Human: 1"),
        field("Bonus skill ranks per level", input("race.bonusSkillPerLevel", { type: "number", min: 0 }), "Human: 1"),
      ),
      h("p", { class: "note" }, "Racial traits like darkvision or weapon familiarity go on the Feats & Features tab as “Racial trait”."),
    ]
  },

  classes() {
    const c = calc()
    const rows = state.classes.map((cls, i) => {
      const p = `classes.${i}.`
      const csCount = cls.classSkills.length
      return h("div", { class: "class-row" },
        field("Class", input(p + "name", { placeholder: "Fighter, Incanter, …", style: "width:12rem" })),
        field("Level", input(p + "level", { type: "number", min: 0, max: 40 })),
        field("Hit die", select(p + "hd", { 4: "d4", 6: "d6", 8: "d8", 10: "d10", 12: "d12" }, {}, { number: true })),
        field("BAB", select(p + "bab", PROGRESSION)),
        field("Fort", select(p + "fort", SAVE_PROG)),
        field("Ref", select(p + "ref", SAVE_PROG)),
        field("Will", select(p + "will", SAVE_PROG)),
        field("Skills / level", input(p + "skills", { type: "number", min: 0 })),
        field("Sphere casting", select(p + "caster", CASTER_PROG)),
        state.hpMode === "custom"
          ? field("HP from class", input(p + "hpCustom", { type: "number", min: 0 }))
          : h("div", { class: "field" }, h("span", {}, "HP from class"), h("span", { style: "padding:.3rem 0" }, c.classHp[i])),
        h("div", { style: "flex-basis:100%" }),
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
      h("p", { class: "muted" }, "Each class exports as a Foundry class item, so BAB, saves, HP and skill ranks update when you level up there. Sphere casting progression is read by the Spheres for Pathfinder 1e module."),
      h("div", { class: "card" }, rows),
      h("div", { class: "row", style: "margin-top:.75rem" },
        h("button", { onclick: () => { state.classes.push(blankClass(false)); changed(true) } }, "+ Add class"),
        h("div", { class: "spacer" }),
        field("Hit points", select("hpMode", { pfs: "Max at 1st level, then half + 1", max: "Maximum every level", custom: "Enter per class" })),
      ),
    ]
  },

  skills() {
    const c = calc()
    const rankInput = (getter, setter, label) => {
      const el = h("input", { type: "number", min: 0, max: Math.max(c.hd, 1), value: getter() || 0, "aria-label": `${label} ranks` })
      el.addEventListener("input", () => {
        setter(el.value === "" ? 0 : +el.value)
        changed()
        const row = el.closest("tr")
        row.querySelector(".tot").textContent = signed(skillTotal(row.dataset.key, getter(), calc()))
        row.querySelector(".tot").classList.toggle("warn", getter() > c.hd)
      })
      return el
    }
    const rows = []
    for (const [k, [label, abl, trainedOnly, acp]] of Object.entries(SKILLS)) {
      const rank = num(state.skills[k])
      rows.push(h("tr", { class: c.classSkills.has(k) ? "cs" : "", "data-key": k },
        h("td", {}, label, trainedOnly ? h("span", { class: "note" }, " (trained)") : null),
        h("td", {}, abl.toUpperCase(), acp ? h("span", { class: "note" }, " ACP") : null),
        h("td", { class: "num" }, rankInput(() => num(state.skills[k]), (v) => (state.skills[k] = v), label)),
        h("td", { class: "num tot" }, signed(skillTotal(k, rank, c))),
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
            h("td", {}, abl.toUpperCase()),
            h("td", { class: "num" }, rankInput(() => num(sub.rank), (v) => (sub.rank = v), sub.name || label)),
            h("td", { class: "num tot" }, signed(skillTotal(k, num(sub.rank), c))),
          ))
        })
        rows.push(h("tr", {}, h("td", { colspan: 4, style: "padding-left:1.25rem" },
          h("button", { class: "small", onclick: () => { state.subSkills[k].push({ name: "", rank: 0 }); changed(true) } }, `+ ${label} specialty`))))
      }
    }
    return [
      h("h2", {}, "Skills"),
      h("p", { class: "muted" }, `● marks a class skill (set on the Classes tab). Max ranks per skill: ${c.hd}. Totals include ranks, ability modifier, +3 for trained class skills and armor check penalty.`),
      h("div", { class: "table-wrap card" },
        h("table", {},
          h("thead", {}, h("tr", {}, h("th", {}, "Skill"), h("th", {}, "Ability"), h("th", { class: "num" }, "Ranks"), h("th", { class: "num" }, "Total"))),
          h("tbody", {}, rows),
        ),
      ),
    ]
  },

  features() {
    return [
      h("h2", {}, "Feats & features"),
      h("p", { class: "muted" }, "Feats, traits, class features and racial traits. Each one exports as a feature item with your text as its description. Add mechanical effects (Changes) in Foundry if you want them automated."),
      entryList("features", () => ({ name: "", kind: "feat", desc: "" }), (e, p) => [
        field("Name", input(p + "name", { placeholder: "Power Attack" })),
        field("Type", select(p + "kind", FEATURE_KINDS)),
      ], "+ Add feat or feature", groupBy("kind", FEATURE_KINDS)),
    ]
  },

  spheres() {
    const abilityOpts = { "": "—", ...ABILITIES }
    const sphereOpts = (list) => ({ "": "—", ...Object.fromEntries(list.map((k) => [k, label(k)])) })
    return [
      h("h2", {}, "Spheres"),
      h("p", { class: "muted" }, "Magic and combat talents export as talent items for the Spheres for Pathfinder 1e module (pf1spheres). Without that module, Foundry shows them as ordinary features."),
      h("div", { class: "card grid" },
        field("Casting ability", select("sphere.casting", abilityOpts), "Spheres of Power"),
        field("Practitioner ability", select("sphere.practitioner", abilityOpts), "Spheres of Might"),
        field("Casting tradition", input("sphere.tradition", { placeholder: "Name (optional)" }), "Exported as a feature"),
        field("Caster level (preview)", h("span", { style: "padding:.3rem 0" }, String(calc().cl))),
      ),
      h("h3", {}, "Talents"),
      entryList("talents", () => ({ name: "", kind: "magic", sphere: "", desc: "" }), (e, p) => [
        field("Name", input(p + "name", { placeholder: "Destruction (base sphere)" })),
        field("Kind", select(p + "kind", { magic: "Magic talent", combat: "Combat talent" })),
        field("Sphere", select(p + "sphere", sphereOpts(e.kind === "combat" ? COMBAT_SPHERES : MAGIC_SPHERES))),
      ], "+ Add talent", (list) => {
        const groups = {}
        list.forEach((e, i) => {
          const key = e.sphere ? `${label(e.sphere)} (${e.kind === "combat" ? "combat" : "magic"})` : "No sphere set"
          ;(groups[key] ??= []).push(i)
        })
        return groups
      }),
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
      ], "+ Add spell", (list) => {
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
      h("h3", {}, "Items"),
      entryList("gear", () => ({ name: "", kind: "loot", qty: 1, weight: 0, price: 0, equipped: false, desc: "" }), (e, p) => {
        const out = [
          field("Name", input(p + "name", { placeholder: "Longsword" })),
          field("Type", select(p + "kind", GEAR_KINDS)),
          field("Qty", input(p + "qty", { type: "number", min: 0 })),
          field("Weight (lb.)", input(p + "weight", { type: "number", min: 0, step: 0.5 })),
          field("Price (gp)", input(p + "price", { type: "number", min: 0 })),
        ]
        if (["weapon", "armor", "shield", "equipment"].includes(e.kind)) out.push(h("div", { class: "field" }, h("span", {}, " "), checkbox(p + "equipped", "Equipped")))
        if (e.kind === "weapon") out.push(
          field("Attack", select(p + "attack", { melee: "Melee", ranged: "Ranged" })),
          field("Damage", input(p + "damage", { placeholder: "1d8", style: "width:5rem" })),
          field("Type", input(p + "dmgType", { placeholder: "S", style: "width:4rem" }), "B / P / S"),
          field("Crit range", input(p + "critRange", { type: "number", min: 2, max: 20, placeholder: "20" }, { allowBlank: true })),
          field("Crit ×", input(p + "critMult", { type: "number", min: 2, max: 6, placeholder: "2" }, { allowBlank: true })),
          field("Enhancement", input(p + "enh", { type: "number", min: 0, max: 10 })),
        )
        if (e.kind === "armor" || e.kind === "shield") out.push(
          field(e.kind === "armor" ? "Armor type" : "Shield type", select(p + "armorType", e.kind === "armor" ? ARMOR_TYPES : SHIELD_TYPES)),
          field("AC bonus", input(p + "ac", { type: "number", min: 0 })),
          e.kind === "armor" ? field("Max Dex", input(p + "maxDex", { type: "number", min: 0, placeholder: "—" }, { allowBlank: true })) : null,
          field("Check penalty", input(p + "acp", { type: "number", min: 0 })),
          field("Spell failure %", input(p + "asf", { type: "number", min: 0, step: 5 })),
        )
        return out
      }, "+ Add item", groupBy("kind", GEAR_KINDS)),
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
        h("p", { class: "note" }, "Built for the Pathfinder 1e system (v11) on Foundry v12–13. Sphere talents need the Spheres for Pathfinder 1e module to show as talents."),
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

function groupBy(key, labels) {
  return (list) => {
    const groups = {}
    for (const k of Object.keys(labels)) groups[labels[k]] = []
    list.forEach((e, i) => groups[labels[e[key]] ?? "Other"]?.push(i))
    return Object.fromEntries(Object.entries(groups).filter(([, v]) => v.length))
  }
}

// editable list of typed entries (feats, talents, spells, gear) with a description box each
function entryList(key, make, fields, addLabel, grouper) {
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
    )
  }
  if (!list.length) wrap.append(h("p", { class: "muted" }, "Nothing added yet."))
  else if (grouper) {
    for (const [title, idxs] of Object.entries(grouper(list))) {
      wrap.append(h("div", { class: "group-title" }, `${title} (${idxs.length})`))
      for (const i of idxs) wrap.append(renderEntry(i))
    }
  } else list.forEach((_, i) => wrap.append(renderEntry(i)))
  const add = h("button", {
    style: "margin-top:.75rem",
    onclick: () => {
      list.push(make())
      changed(true)
      // focus the new entry's name box
      const inputs = document.querySelectorAll(`#panel input[placeholder]`)
      const target = [...inputs].find((el) => el.value === "" && el.closest(".class-row"))
      target?.focus()
    },
  }, addLabel)
  return h("div", {}, wrap, add)
}

function skillTotal(k, rank, c) {
  const [, abl, , acp] = SKILLS[k]
  let t = rank + c.abl[abl].mod
  if (rank > 0 && c.classSkills.has(k)) t += 3
  if (acp) t -= c.acp
  return t
}

function renderPanel() {
  const panel = document.getElementById("panel")
  const scroll = window.scrollY
  panel.replaceChildren(...panels[tab]().filter(Boolean))
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
    const extra = cls.caster !== "none" ? { flags: { pf1spheres: { casterProgression: cls.caster } } } : {}
    items.push(item("class", cls.name || `Class ${i + 1}`, system, extra))
  })

  for (const f of s.features) items.push(item("feat", f.name, { subType: f.kind, description: { value: toHtml(f.desc) } }))
  if (s.sphere.tradition) items.push(item("feat", s.sphere.tradition, { subType: "classFeat", tags: ["Casting Tradition"], description: { value: "" } }))
  for (const t of s.talents) {
    const extra = t.sphere ? { flags: { pf1spheres: { sphere: t.sphere } } } : {}
    items.push(item("feat", t.name, { subType: t.kind === "combat" ? "combatTalent" : "magicTalent", description: { value: toHtml(t.desc) } }, extra))
  }

  const hasBook = s.spellcasting.cls >= 0 && tags[s.spellcasting.cls]
  for (const sp of s.spells)
    items.push(item("spell", sp.name, { level: num(sp.level), school: sp.school, spellbook: "primary", description: { value: toHtml(sp.desc) } }))

  for (const g of s.gear) items.push(gearItem(g))

  const skills = {}
  for (const k of Object.keys(SKILLS)) {
    const entry = { rank: num(s.skills[k]) }
    if (SUB_SKILLS.includes(k) && s.subSkills[k].length) {
      entry.subSkills = {}
      s.subSkills[k].forEach((sub, i) => {
        entry.subSkills[`${k}${i + 1}`] = { name: sub.name || `${SKILLS[k][0]} ${i + 1}`, ability: SKILLS[k][1], rt: !!SKILLS[k][2], acp: !!SKILLS[k][3], rank: num(sub.rank) }
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

  const flags = { [FLAG_SCOPE]: { state: JSON.parse(JSON.stringify(s)), version: 1 } }
  const sphereFlags = {}
  if (s.sphere.casting) sphereFlags.castingAbility = s.sphere.casting
  if (s.sphere.practitioner) sphereFlags.practitionerAbility = s.sphere.practitioner
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
      return item("weapon", g.name, { ...base, equipped: !!g.equipped, enh: num(g.enh) || null, masterwork: num(g.enh) > 0, actions: [action] })
    }
    case "armor":
      return item("equipment", g.name, {
        ...base, subType: "armor", equipmentSubtype: g.armorType || "lightArmor", slot: "armor", equipped: !!g.equipped,
        armor: { value: num(g.ac), dex: g.maxDex === "" || g.maxDex == null ? null : num(g.maxDex), acp: Math.abs(num(g.acp)) },
        spellFailure: num(g.asf),
      })
    case "shield":
      return item("equipment", g.name, {
        ...base, subType: "shield", equipmentSubtype: g.armorType || "lightShield", slot: "shield", equipped: !!g.equipped,
        armor: { value: num(g.ac), acp: Math.abs(num(g.acp)) },
        spellFailure: num(g.asf),
      })
    case "equipment":
      return item("equipment", g.name, { ...base, subType: "wondrous", slot: "slotless", equipped: !!g.equipped })
    case "consumable":
      return item("consumable", g.name, { ...base, subType: "potion" })
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
