// Animal Companion Builder and Familiar Builder: pages built on the Monster Creator (builder.js in
// monster mode + monster.js), each with window.BUILDER_VARIANT ("companion" or "familiar") and its
// own save slot. The creature is kept as state.monster, so attacks, the stat block, the PDF sheet
// and the Foundry export all work as they do there; this file adds the companion rules on top.
"use strict"

// ---------- the master ----------
// What a companion's numbers come from. Typed in, or read from the character saved in the
// Character Builder on this browser (its own save slot).
const blankMaster = () => ({ name: "", level: 1, bab: 0, fort: 0, ref: 0, will: 0, hp: 0, han: 0, rid: 0, skills: {} })

function masterFromBuilder() {
  let raw = null
  try { raw = JSON.parse(localStorage.getItem(CHARACTER_KEY) || "null") } catch {}
  if (!raw || !(raw.classes ?? []).some((cl) => cl.name)) return toast("No character is saved in the Character Builder on this browser.")
  // work the saved character out with the builder's own maths: it becomes the state for a moment
  const keep = state
  let c, saved
  try {
    state = saved = normalize(raw)
    c = calc()
  } catch {
    state = keep
    return toast("Couldn't read the Character Builder's character.")
  }
  state = keep
  const ranks = {}
  for (const k of Object.keys(SKILLS)) {
    const r = num(saved.skills[k]) + (SUB_SKILLS.includes(k) ? Math.max(0, ...saved.subSkills[k].map((e) => num(e.rank))) : 0)
    if (r > 0) ranks[k] = r
  }
  state.master = { ...blankMaster(), name: saved.name || "", level: c.hd, bab: c.bab, fort: c.saves.fort, ref: c.saves.ref, will: c.saves.will,
    hp: c.hp, han: num(ranks.han), rid: num(ranks.rid), skills: ranks, cl: num(c.spheres?.cl) }
  // a Conjuration companion follows its caster's caster level
  if (state.conjuration && state.master.cl > 0) state.conjuration.cl = state.master.cl
  toast(`Master: ${saved.name || "the Character Builder's character"} (level ${c.hd})`)
  changed(true)
}

// a number field that commits when it's left: the panel re-renders on a change, which would take
// the focus away mid-number
function numField(path, attrs = {}) {
  const el = h("input", { type: "number", ...attrs, value: getPath(state, path) ?? 0 })
  el.addEventListener("change", () => { setPath(state, path, el.value === "" ? 0 : +el.value); changed(true) })
  return el
}

function masterCard(fields, note) {
  const m = (state.master ??= blankMaster())
  const inputs = { level: ["Character level", 1], bab: ["Base attack bonus", 0], han: ["Handle Animal ranks", 0], rid: ["Ride ranks", 0],
    fort: ["Base Fortitude", 0], ref: ["Base Reflex", 0], will: ["Base Will", 0], hp: ["Hit points", 0] }
  return h("div", { class: "card" },
    h("div", { class: "row" }, h("div", { class: "group-title", style: "margin:0" }, "Master"), h("div", { class: "spacer" }),
      h("button", { class: "small", title: "Fill these in from the character saved in the Character Builder on this browser", onclick: masterFromBuilder }, "From the Character Builder")),
    h("div", { class: "row" }, field("Name", input("master.name", { placeholder: "Master's name" })),
      ...fields.map((k) => field(inputs[k][0], numField(`master.${k}`, { min: inputs[k][1], style: "width:5.5rem" })))),
    note ? h("p", { class: "note" }, note) : null)
}

// ---------- archetypes (companion and familiar archetypes, Archives of Nethys) ----------
// An archetype's abilities are added as features to apply by hand; the standard abilities it
// replaces (share spells, evasion, ...) are listed beside it and stay on the sheet for the user to
// disregard.
const kindState = () => (VARIANT === "companion" ? state.companion : VARIANT === "conjuration" ? state.conjuration : state.familiar)
const ARCHETYPE_STACK_NOTE = "Tick as many as you want: archetypes can be combined as long as they don't replace or alter the same abilities, which isn't checked here. Each one's abilities are added as features. Nothing is taken off the sheet for you: what an archetype replaces is listed beside it, to apply by hand."
const baseName = (n) => String(n).replace(/\s*\((?:Ex|Su|Sp)\)/g, "").trim().toLowerCase()
// what the applied archetypes replace is shown beside each one, and left to the user: nothing comes
// off the sheet for an archetype (so this is always empty)
const replacedByArchetypes = () => new Set()
function addArchetype(a) {
  const k = kindState()
  k.archetypes = [...(k.archetypes ?? []).filter((x) => x.name !== a.name), { name: a.name, url: a.url, source: a.source, replaces: a.replaces }]
  state.features = state.features.filter((f) => f.archetype !== a.name)
  for (const ab of a.abilities) state.features.push(newFeature("misc", { name: ab.name, desc: ab.text, monster: true, archetype: a.name }))
  changed(true)
}
function removeArchetype(name) {
  const k = kindState()
  k.archetypes = (k.archetypes ?? []).filter((x) => x.name !== name)
  state.features = state.features.filter((f) => f.archetype !== name)
  changed(true)
}
async function openArchetypePicker() {
  const box = h("input", { type: "search", placeholder: "Search archetypes", "aria-label": "Search archetypes" })
  const results = h("div", { class: "picker-results", role: "list" }, h("p", { class: "muted" }, "Loading archetypes…"))
  const dlg = openDialog(VARIANT === "familiar" ? "Familiar archetypes" : "Companion archetypes",
    h("p", { class: "note" }, ARCHETYPE_STACK_NOTE), h("div", { class: "row picker-filters" }, box), results,
    h("div", { class: "row add-row" }, h("button", { class: "primary", onclick: () => dlg.done() }, "Done")))
  let all = []
  const render = () => {
    const q = box.value.trim().toLowerCase()
    const hits = all.filter((a) => !q || a.name.toLowerCase().includes(q) || a.intro.toLowerCase().includes(q))
    fill(results, ...hits.map((a) => {
      const cb = h("input", { type: "checkbox", checked: (kindState().archetypes ?? []).some((x) => x.name === a.name) })
      cb.addEventListener("change", () => (cb.checked ? addArchetype(a) : removeArchetype(a.name)))
      return h("label", { class: "picker-item", role: "listitem", style: "cursor:pointer" },
        h("span", { class: "pi-name" }, cb, " ", a.name, h("span", { class: "pi-meta" }, ` ${a.abilities.map((x) => baseName(x.name)).join(", ")}`)),
        h("span", { class: "pi-pre" }, `${a.replaces.length ? `Replaces ${a.replaces.join(", ")}. ` : ""}${a.source}`))
    }),
    hits.length ? null : h("p", { class: "muted" }, all.length ? "No archetypes match." : "Couldn't load the archetypes."))
  }
  box.addEventListener("input", render)
  // (the Conjuration Companion Builder lists the sphere's own companion archetypes: HOOKS.archetypeList)
  // this site's own archetypes (Martial Beast, ...) first, then the Archives of Nethys ones
  const listed = () => Promise.all([loadCompendium("companion-archetypes-spheres.json", { companion: [], familiar: [] }),
    loadCompendium("companion-archetypes.json", { companion: [], familiar: [] })])
    .then(([site, aon]) => [...(site[VARIANT] ?? []).map((a) => ({ ...a, url: `../../${a.url}`, abilities: a.abilities.map((x) => ({ ...x, text: mdToText(x.text) })) })), ...(aon[VARIANT] ?? [])])
  ;(HOOKS.archetypeList ? HOOKS.archetypeList() : listed())
    .then((list) => { all = list; render() })
  box.focus()
}
function archetypeCard() {
  const list = kindState().archetypes ?? []
  return h("div", { class: "card" },
    h("div", { class: "row" }, h("div", { class: "group-title", style: "margin:0" }, "Archetypes"), h("div", { class: "spacer" }),
      h("button", { class: "small", onclick: () => openArchetypePicker() }, "+ Add archetypes")),
    ...list.map((a) => h("div", { class: "row" }, h("b", {}, a.name), h("span", { class: "muted" }, a.source),
      a.replaces?.length ? h("span", { class: "note" }, `Replaces ${a.replaces.join(", ")}.`) : null, h("div", { class: "spacer" }),
      a.url ? h("a", { href: a.url, target: "_blank", rel: "noopener" }, /^https?:/.test(a.url) ? "On Archives of Nethys" : "On the wiki") : null,
      h("button", { class: "small danger", onclick: () => removeArchetype(a.name) }, "Remove"))),
    h("p", { class: "note" }, list.length
      ? "The archetypes' abilities are on the Feats & Features tab. Nothing has been taken off the sheet: disregard what each one replaces, and apply any numbers they change there or on this tab."
      : ARCHETYPE_STACK_NOTE))
}

// features this file keeps up to date carry auto: <variant>; they are rebuilt, the rest are the user's
function setAutoFeatures(tag, list) {
  state.features = [...list.map((f) => ({ ...f, auto: tag })), ...state.features.filter((f) => f.auto !== tag)]
}
const cleanName = (t) => String(t).replace(/\*/g, "").trim()

// ---------- animal companions ----------
// Druid animal companion table (Core Rulebook): Hit Dice by effective druid level; the rest follows
// from the level (natural armor +2 and Str/Dex +1 per 3 levels, a bonus trick per 3 levels)
const COMPANION_HD = [2, 3, 3, 4, 5, 6, 6, 7, 8, 9, 9, 10, 11, 12, 12, 13, 14, 15, 15, 16]
const COMPANION_INCREASES = [4, 9, 14, 20]
const COMPANION_SPECIALS = [
  [1, "Link", "The master can handle the companion as a free action, or push it as a move action, even without ranks in Handle Animal, and gets a +4 circumstance bonus on wild empathy and Handle Animal checks made with it."],
  [1, "Share Spells", "The master may cast a spell with a target of \"You\" on the companion (as a touch spell) instead of on themself, and may cast spells on it even if they don't normally affect creatures of its type. Spells cast this way must come from a class that grants an animal companion."],
  [3, "Evasion", "On a successful Reflex save against an effect that deals half damage on a save, the companion takes none."],
  [6, "Devotion", "+4 morale bonus on Will saves against enchantment spells and effects."],
  [15, "Improved Evasion", "As evasion, and the companion takes only half damage on a failed Reflex save."],
]
const ANIMAL_SKILLS = ["acr", "clm", "esc", "fly", "int", "per", "ste", "sur", "swm"]
const COMPANION_TYPES = { Animal: "animal", Vermin: "vermin", Plant: "plant", Monstrous: "magical beast" }
const SENSE_WORDS = /vision|scent|blindsense|blindsight|tremorsense|see in darkness/i

function companionLevel() {
  const comp = state.companion, m = state.master ?? blankMaster()
  if (!comp) return 1
  const raw = comp.source === "class" ? num(comp.classLevel)
    : Math.max(num(m.bab), num(m.han), num(m.rid)) - (comp.source === "bm" ? 3 : 0)
  return Math.min(20, Math.max(1, Math.floor(raw)))
}
const companionRow = (L) => ({ hd: COMPANION_HD[L - 1], natural: 2 * Math.floor(L / 3), strDex: Math.floor(L / 3),
  tricks: 1 + Math.floor(L / 3), increases: COMPANION_INCREASES.filter((x) => x <= L).length })

function companionAttacks(list) {
  return list.map((a) => {
    const note = `${a.name} ${a.extra}`
    const secondary = /\*|secondary/i.test(note) || NATURAL_SECONDARY.test(a.name)
    const dice = a.damage || (a.extra.match(/\d+d\d+/) ?? [""])[0]
    const ranged = /ranged/i.test(a.extra)
    // what the attack does besides damage ("trip", "grab", "poison"): not the notes about how it's rolled
    const extra = a.damage ? a.extra : a.extra.replace(/\d+d\d+[^;,]*/, "").replace(/secondary (?:natural )?attack/i, "")
    // "2 claws": the data keeps the singular
    const name = cleanName(a.name) + (num(a.count) > 1 && !/s$/.test(cleanName(a.name)) ? "s" : "")
    return { group: 0, range: ranged ? "ranged" : "melee", name, count: a.count || 1, natural: !ranged, primary: !secondary,
      dice, crit: "", extra: extra.replace(/^[\s;,]+|[\s;,]+$/g, "").replace(/^plus\s+/i, ""), atkMisc: 0, dmgMisc: 0, finesse: false, enh: 0,
      printedBonus: null, printedIter: [], printedDamage: "" }
  })
}

// everything the companion's kind and level decide, worked out again whenever either changes
function syncCompanion() {
  const comp = state.companion, mon = state.monster
  if (!comp?.entry || !mon) return
  const e = comp.entry, L = companionLevel(), row = companionRow(L)
  const reached = (e.advances ?? []).filter((a) => L >= a.level)
  const adv = comp.altAdvance ? [] : reached
  const pick = (k) => [...adv].reverse().map((a) => a[k]).find((v) => v != null && (!Array.isArray(v) || v.length))

  let racial = state.classes.find((cl) => cl.racial)
  if (!racial) state.classes.unshift((racial = { ...blankClass(false), racial: true }))
  Object.assign(racial, { name: "Animal companion (Hit Dice)", level: row.hd, hd: 8, bab: comp.fullBab ? "high" : "med", fort: "high", ref: "high",
    will: "low", skills: 2, classSkills: [...new Set([...ANIMAL_SKILLS, ...(racial.classSkills ?? [])])], favored: false })

  comp.increases = (comp.increases ?? []).slice(0, row.increases)
  for (const k of ABL) {
    let v = e.start.abilities?.[k]
    if (v == null) { state.abilities[k] = null; continue }
    for (const a of adv) v += num(a.abilities?.[k])
    if (comp.altAdvance && reached.length && (k === "dex" || k === "con")) v += 2
    if (k === "str" || k === "dex") v += row.strDex
    v += comp.increases.filter((x) => x === k).length
    state.abilities[k] = v
  }
  state.race.size = SIZE_NAMES[pick("size") || e.start.size] ?? "med"
  const speeds = pick("speeds") || e.start.speeds || {}
  state.race.speed = num(speeds.land)
  mon.speeds = Object.fromEntries(Object.entries(speeds).filter(([k]) => k !== "land"))
  mon.space = SPACE[state.race.size]
  mon.reach = `${REACH[state.race.size]?.[0] ?? 5} ft.`

  // attacks: the kind's own list (the advancement replaces it); rebuilt only when that list changes,
  // so edits made on this tab stay
  const source = pick("attacks") || e.start.attacks || []
  const sig = JSON.stringify(source)
  if (comp.attackSig !== sig) {
    mon.attacks = companionAttacks(source)
    comp.attackSig = sig
  }
  const qualities = [...(e.start.sq ?? []), ...adv.flatMap((a) => a.sq ?? [])].map(cleanName).filter((q) => q && !/secondary|see Combat/i.test(q))
  mon.senses = qualities.filter((q) => SENSE_WORDS.test(q)).join(", ")
  const replaced = replacedByArchetypes()
  const specials = COMPANION_SPECIALS.filter(([lvl, name]) => L >= lvl && !replaced.has(name.toLowerCase()))
  const multi = L >= 9 && !replaced.has("multiattack")
  const naturals = mon.attacks.filter((a) => a.natural).reduce((n, a) => n + num(a.count), 0)
  mon.sq = [...qualities.filter((q) => !SENSE_WORDS.test(q)), ...specials.map(([, name]) => name.toLowerCase()), ...(multi ? ["multiattack"] : [])].join(", ")
  mon.specialAttacks = [...(e.start.sa ?? []), ...adv.flatMap((a) => a.sa ?? [])].map(cleanName).join(", ")

  const natural = num(e.start.natural) + adv.reduce((n, a) => n + num(a.natural), 0) + row.natural
  const auto = []
  if (natural) auto.push(newFeature("misc", { name: "Natural armor", monster: true,
    desc: `Natural armor +${natural}: +${num(e.start.natural) + adv.reduce((n, a) => n + num(a.natural), 0)} for its kind, +${row.natural} for its level.`,
    changes: [{ formula: String(natural), target: "nac", type: "untyped", operator: "add" }] }))
  for (const [, name, desc] of specials) auto.push(newFeature("misc", { name: `${name} (Ex)`, desc, monster: true }))
  if (multi) {
    if (naturals >= 3) auto.push(newFeature("feat", { name: "Multiattack", desc: "Bonus feat at 9th level: secondary natural attacks take a -2 penalty instead of -5." }))
    else auto.push(newFeature("misc", { name: "Multiattack (Ex)", monster: true,
      desc: "With fewer than three natural attacks, the companion instead gets a second attack with one primary natural weapon, at a -5 penalty." }))
  }
  // a mindless companion (vermin) learns tricks but has no skill ranks or feats
  if (state.abilities.int == null) auto.push(newFeature("misc", { name: "Mindless", monster: true,
    desc: "No Intelligence score: immune to mind-affecting effects, and it gains no skill ranks or feats. It can still be taught its tricks.",
    changes: [{ formula: String(-2 * row.hd), target: "bonusSkillRanks", type: "untyped", operator: "add" },
      { formula: String(-Math.ceil(row.hd / 2)), target: "bonusFeats", type: "untyped", operator: "add" }] }))
  setAutoFeatures("companion", auto)
  state.race.name = e.name
}

function chooseCompanion(entry) {
  const s = blankState()
  s.spheresModule = state.spheresModule
  s.hpMode = "average"
  s.details.languages = ""
  s.portrait = state.companion ? "" : state.portrait
  s.master = state.master ?? blankMaster()
  const prev = state.companion
  s.companion = { entry, source: prev?.source ?? "class", classLevel: prev?.classLevel ?? 1, altAdvance: false, fullBab: !!prev?.fullBab, increases: [], tricks: "" }
  s.classes = []
  s.monster = { base: { id: entry.id, name: entry.name, cr: "1", xp: 0, url: entry.url, source: entry.source },
    cr: "1", type: COMPANION_TYPES[entry.type] ?? "animal", subtypes: [], role: "combat", speeds: {}, senses: "", aura: "", defensive: "", dr: "",
    immune: "", resist: "", sr: "", weaknesses: "", sq: "", specialAttacks: "", sla: "", spells: "", space: "", reach: "", gearText: "",
    hpAbility: "con", baseHd: 0, baseCr: "1", templates: [], adjustments: [], addedHd: 0, attacks: [], printed: { skills: {} }, racialMods: "",
    monsterChanges: [], baseMr: 0, mr: 0, mythicTemplates: [], baseDr: "", baseSr: "", baseSpecialAttacks: "" }
  state = normalize(s)
  state.classes = []
  syncCompanion()
  save()
  tab = "monster"
  renderAll()
  toast(`${entry.name} chosen`)
}

async function openCompanionPicker() {
  const box = h("input", { type: "search", placeholder: "Search companions by name", "aria-label": "Search companions" })
  const typeSel = h("select", { "aria-label": "Companion type" }, h("option", { value: "" }, "Any type"), ...Object.keys(COMPANION_TYPES).map((t) => h("option", { value: t }, t)))
  const sizeSel = h("select", { "aria-label": "Starting size" }, h("option", { value: "" }, "Any starting size"), ...["Tiny", "Small", "Medium", "Large"].map((t) => h("option", { value: t }, t)))
  const results = h("div", { class: "picker-results", role: "list" }, h("p", { class: "muted" }, "Loading companions…"))
  const dlg = openDialog("Choose an animal companion", h("div", { class: "row picker-filters" }, box, typeSel, sizeSel), results)
  let all = []
  const render = () => {
    const q = box.value.trim().toLowerCase()
    const hits = all.filter((e) => (!q || e.name.toLowerCase().includes(q)) && (!typeSel.value || e.type === typeSel.value) && (!sizeSel.value || e.start.size === sizeSel.value))
    const shown = hits.slice(0, 80)
    fill(results, ...shown.map((e) => h("button", { class: "picker-item", role: "listitem", onclick: () => { dlg.done(); chooseCompanion(e) } },
      h("span", { class: "pi-name" }, e.name, h("span", { class: "pi-meta" }, ` ${e.start.size} ${e.type.toLowerCase()} · ${e.start.speedText ?? ""} · ${e.start.attackText ?? "no attacks"}${(e.advances ?? []).map((a) => ` · advances at ${a.level}th`).join("")}`)),
      h("span", { class: "pi-pre" }, e.source))),
    hits.length > shown.length ? h("p", { class: "note" }, `Showing ${shown.length} of ${hits.length}; type more of the name or filter.`) : null,
    hits.length ? null : h("p", { class: "muted" }, all.length ? "No companions match." : "Couldn't load the companions."))
  }
  box.addEventListener("input", render)
  for (const el of [typeSel, sizeSel]) el.addEventListener("change", render)
  loadCompendium("companions.json", { entries: [] }).then((d) => { all = d.entries; render() })
  box.focus()
}

function attackEditor(c) {
  const mon = state.monster
  return [
    h("h3", {}, "Attacks"),
    h("div", { class: "picked-list" }, ...mon.attacks.map((a, i) => {
      const p = `monster.attacks.${i}.`
      return h("div", { class: "card class-row", style: "margin:0" },
        field("Attack", input(p + "name", { style: "width:9rem" })),
        field("Count", numField(p + "count", { min: 1, style: "width:4rem" })),
        field("Range", select(p + "range", { melee: "Melee", ranged: "Ranged" })),
        h("div", { class: "field" }, h("span", {}, " "), checkbox(p + "natural", "Natural")),
        a.natural ? h("div", { class: "field" }, h("span", {}, " "), checkbox(p + "primary", "Primary")) : null,
        h("div", { class: "field" }, h("span", {}, " "), checkbox(p + "finesse", "Uses Dex")),
        field("Damage dice", input(p + "dice", { style: "width:5rem" })),
        field("Crit", input(p + "crit", { style: "width:5rem", placeholder: "19-20/x2" })),
        field("Plus", input(p + "extra", { style: "width:8rem", placeholder: "grab" })),
        field("Attack adj.", input(p + "atkMisc", { type: "number", style: "width:4rem" })),
        field("Damage adj.", input(p + "dmgMisc", { type: "number", style: "width:4rem" })),
        h("div", { class: "spacer" }),
        h("button", { class: "small danger", onclick: () => { mon.attacks.splice(i, 1); changed(true) } }, "Remove"),
        h("p", { class: "note", style: "flex-basis:100%;margin:0" }, attackText(a, c)))
    })),
    h("button", { style: "margin-top:.5rem", onclick: () => { mon.attacks.push({ group: 0, range: "melee", name: "claw", count: 1, natural: true, primary: true, dice: "1d4", crit: "", extra: "", atkMisc: 0, dmgMisc: 0, enh: 0, finesse: false, printedBonus: null, printedIter: [], printedDamage: "" }); changed(true) } }, "+ Add attack"),
  ]
}

function companionPanel() {
  const comp = state.companion, mon = state.monster
  if (!comp?.entry || !mon) return [
    h("h2", {}, "Animal companion"),
    h("p", { class: "muted" }, "Pick a companion from the druid's list (Archives of Nethys), then set its master's level. Hit Dice, base attack bonus, saves, natural armor, the Strength and Dexterity bonus, tricks and special abilities follow the animal companion table, and the 4th- or 7th-level advancement applies when the level reaches it."),
    h("button", { class: "primary", onclick: () => openCompanionPicker() }, "Choose a companion"),
  ]
  const c = calc(), e = comp.entry, L = companionLevel(), row = companionRow(L)
  const reached = (e.advances ?? []).filter((a) => L >= a.level)
  const next = (e.advances ?? []).find((a) => L < a.level)
  const incr = Array.from({ length: row.increases }, (_, i) => {
    const el = h("select", { "aria-label": `Ability score increase at level ${COMPANION_INCREASES[i]}` }, h("option", { value: "" }, "Choose…"),
      ...ABL.filter((k) => e.start.abilities?.[k] != null).map((k) => h("option", { value: k, selected: comp.increases[i] === k }, k.toUpperCase())))
    el.addEventListener("change", () => { comp.increases[i] = el.value; comp.increases = Array.from(comp.increases, (x) => x || ""); changed(true) })
    return field(`+1 at level ${COMPANION_INCREASES[i]}`, el)
  })
  const sourceNote = { class: "The level of the class that grants the companion (druid level; ranger level - 3, and so on).",
    bm: "Beastmastery sphere, Animal Companion talent: the highest of the master's base attack bonus, Handle Animal ranks and Ride ranks, less 3.",
    bm2: "Animal Companion talent taken twice: the highest of the master's base attack bonus, Handle Animal ranks and Ride ranks." }[comp.source]
  return [
    h("div", { class: "row" }, h("h2", { style: "margin:0" }, e.name), h("span", { class: "muted" }, e.source),
      h("div", { class: "spacer" }), h("a", { href: e.url, target: "_blank", rel: "noopener" }, "On Archives of Nethys"),
      h("button", { onclick: () => openCompanionPicker() }, "Choose another"),
      h("button", { onclick: () => exportStatBlock() }, "Stat block")),
    h("div", { class: "card" },
      h("div", { class: "row" },
        field("Companion from", select("companion.source", { class: "A class (druid level)", bm: "Beastmastery: Animal Companion", bm2: "Beastmastery: Animal Companion (taken twice)" })),
        comp.source === "class" ? field("Effective druid level", numField("companion.classLevel", { min: 1, max: 20, style: "width:5.5rem" })) : null,
        h("div", { class: "stat", style: "min-width:7rem" }, h("b", {}, String(L)), h("span", {}, "Effective druid level"))),
      h("p", { class: "note" }, sourceNote)),
    masterCard(comp.source === "class" ? ["level"] : ["level", "bab", "han", "rid"]),
    h("div", { class: "card" },
      h("div", { class: "group-title", style: "margin-top:0" }, `Level ${L} companion`),
      h("div", { class: "mon-compare" },
        ...[["Hit Dice", `${row.hd}d8`], ["BAB", signed(c.bab)], ["Fort", signed(c.saves.fort)], ["Ref", signed(c.saves.ref)], ["Will", signed(c.saves.will)],
          ["Skill ranks", String(c.skillBudget)], ["Feats", String(c.featSlots)], ["Natural armor", `+${row.natural}`], ["Str / Dex", `+${row.strDex}`], ["Bonus tricks", String(row.tricks)]]
          .map(([k, v]) => h("div", { class: "stat" }, h("b", {}, v), h("span", {}, k)))),
      h("div", { class: "row" }, checkbox("companion.fullBab", "Full base attack bonus (Beastmastery variant rule: base attack bonus equals Hit Dice)")),
      (e.advances ?? []).length ? h("div", { class: "row" },
        h("span", { class: "note" }, reached.length ? `${reached.map((a) => `${a.level}th`).join(", ")}-level advancement reached.` : `Advances at level ${next.level}.`),
        checkbox("companion.altAdvance", "Take +2 Dexterity and +2 Constitution instead of the advancement")) : null,
      incr.length ? h("div", { class: "row" }, h("span", { class: "note" }, "Ability score increases:"), ...incr) : null,
      num(c.abl.int.total) < 3 && state.abilities.int != null ? h("p", { class: "note" }, "With Intelligence 2 or lower, the companion's feats come from the animal feat list and its skill ranks from the animal skills (already its class skills).") : null),
    h("div", { class: "card grid" },
      field("Type", input("monster.type")), field("Size", h("input", { value: SIZES[state.race.size]?.[0] ?? "", disabled: true })),
      field("Speed", h("input", { value: [`${num(state.race.speed)} ft.`, ...Object.entries(mon.speeds).map(([k, v]) => `${k} ${v} ft.`)].join(", "), disabled: true })),
      field("Senses", h("input", { value: mon.senses, disabled: true })),
      field("Special attacks", h("input", { value: mon.specialAttacks, disabled: true })),
      field("Special qualities", h("input", { value: mon.sq, disabled: true }))),
    h("div", { class: "card" },
      h("div", { class: "group-title", style: "margin-top:0" }, `Tricks (${row.tricks} bonus trick${row.tricks > 1 ? "s" : ""}, plus those taught with Handle Animal)`),
      textarea("companion.tricks", { rows: 2, placeholder: "Attack, Come, Defend, Down, Guard, Heel…" })),
    archetypeCard(),
    ...attackEditor(c),
  ]
}

// ---------- familiars ----------
// Wizard familiar table (Core Rulebook), by the master's level: natural armor adjustment and
// Intelligence go up every two levels; the special abilities arrive at the listed levels.
// "full" ones are what a Beastmastery Pet does not get.
const FAMILIAR_SPECIALS = [
  [1, "Improved Evasion (Ex)", false, "No damage on a successful Reflex save against an effect that deals half damage on a save, and half on a failed one."],
  [1, "Share Spells", true, "The master may cast a spell with a target of \"You\" on the familiar (as a touch spell) instead of on themself, even if spells of that kind don't normally affect creatures of its type."],
  [1, "Empathic Link (Su)", false, "The master and familiar share emotions out to 1 mile, and the master has the same connection to a place or item that the familiar does."],
  [3, "Deliver Touch Spells (Su)", true, "When the master casts a touch spell while in contact with the familiar, the familiar can be the one to deliver it."],
  [5, "Speak with Master (Ex)", false, "The familiar and master can talk to each other as if sharing a language; others don't understand it without magic."],
  [7, "Speak with Animals of Its Kind (Ex)", true, "The familiar can communicate with animals of about its own kind (including dire versions)."],
  [11, "Spell Resistance (Ex)", true, "Spell resistance equal to the master's level + 5."],
  [13, "Scry on Familiar (Sp)", true, "Once per day the master can scry on the familiar, as the scrying spell."],
]
const FAMILIAR_SKILLS = ["acr", "clm", "fly", "per", "ste", "swm"]

function familiarLevel() {
  const fam = state.familiar, m = state.master ?? blankMaster()
  if (!fam) return 1
  const raw = fam.kind === "pet" ? Math.max(num(m.bab), num(m.han)) : num(fam.level)
  return Math.min(20, Math.max(1, Math.floor(raw)))
}
// a Pet keeps its animal type and Intelligence and misses some abilities, unless it's an Improved Pet
const familiarFull = () => state.familiar.kind !== "pet" || !!state.familiar.improved
const familiarHd = (c) => Math.max(num(state.master?.level), c.hd)
const ownBab = () => state.classes.filter((cl) => num(cl.level) > 0).reduce((a, cl) => a + Math.floor({ high: 1, med: 0.75, low: 0.5 }[cl.bab] * num(cl.level)), 0)
const ownSave = (k) => state.classes.filter((cl) => num(cl.level) > 0).reduce((a, cl) => a + (cl[k] === "high" ? 2 + Math.floor(num(cl.level) / 2) : Math.floor(num(cl.level) / 3)), 0)
function familiarSpecials() {
  const fam = state.familiar, L = familiarLevel(), full = familiarFull()
  const replaced = replacedByArchetypes()
  return FAMILIAR_SPECIALS.filter(([lvl, name, fullOnly]) => L >= lvl && (full || !fullOnly) && !(fam.improved && /of Its Kind/.test(name)) && !replaced.has(baseName(name)))
}

function syncFamiliar() {
  const fam = state.familiar, mon = state.monster, m = (state.master ??= blankMaster())
  if (!fam?.entry || !mon) return
  const L = familiarLevel(), step = Math.ceil(L / 2), full = familiarFull()
  // Intelligence and type: the table's Intelligence (a smarter creature keeps its own); an animal
  // becomes a magical beast (its Hit Dice, attack bonus, saves and skills stay as they were)
  if (fam.base.int != null || full) state.abilities.int = full ? Math.max(num(fam.base.int), 5 + step) : fam.base.int
  mon.type = full && fam.base.type === "animal" ? "magical beast" : fam.base.type
  mon.sr = full && L >= 11 && !replacedByArchetypes().has("spell resistance") ? String(num(m.level) + 5) : fam.base.sr
  // the master's skill ranks where they beat the creature's own
  for (const k of new Set([...Object.keys(fam.base.skills), ...Object.keys(m.skills ?? {})])) {
    if (!(k in SKILLS) || SUB_SKILLS.includes(k)) continue
    state.skills[k] = Math.max(num(fam.base.skills[k]), num(m.skills?.[k]))
  }
  const racial = state.classes.find((cl) => cl.racial) ?? state.classes[0]
  if (racial) racial.classSkills = [...new Set([...(racial.classSkills ?? []), ...FAMILIAR_SKILLS])]
  // melee attacks with natural weapons use the better of Strength and Dexterity
  const dexBetter = mod(num(state.abilities.dex)) > mod(num(state.abilities.str))
  for (const a of mon.attacks) if (a.natural && a.range === "melee" && dexBetter) a.finesse = true

  const changes = []
  const bab = num(m.bab) - ownBab()
  if (bab) changes.push({ formula: String(bab), target: "bab", type: "untyped", operator: "add" })
  for (const k of ["fort", "ref", "will"]) {
    const diff = num(m[k]) - ownSave(k)
    if (diff > 0) changes.push({ formula: String(diff), target: k, type: "untyped", operator: "add" })
  }
  const auto = replacedByArchetypes().has("natural armor adjustment") ? [] : [
    newFeature("misc", { name: "Natural armor adjustment", monster: true, desc: `+${step} to the creature's natural armor at master level ${L}.`,
      changes: [{ formula: String(step), target: "nac", type: "untyped", operator: "add" }] }),
  ]
  if (changes.length) auto.push(newFeature("misc", { name: "Master's base attack bonus and saves (stat block)", monster: true, changes,
    desc: "A familiar uses its master's base attack bonus, and for each saving throw the better of its own base bonus and its master's." }))
  for (const [, name, , desc] of familiarSpecials()) auto.push(newFeature("misc", { name, desc, monster: true }))
  setAutoFeatures("familiar", auto)
  state.race.name = fam.entry.name
}
// hit points: half the master's total, whatever its own Hit Dice
function familiarCalc(out, s) {
  if (!s.familiar?.entry) return
  const hp = num(s.master?.hp)
  out.ownHp = out.hp
  if (hp > 0) out.hp = Math.floor(hp / 2)
}

async function chooseFamiliar(entry, improved) {
  if (!entry.monsterId) return toast("That familiar has no stat block on Archives of Nethys to build from.")
  const master = state.master ?? blankMaster()
  const prev = state.familiar
  const portrait = prev ? "" : state.portrait
  await loadMonster({ id: entry.monsterId, file: entry.file })
  if (!state.monster) return
  state.portrait = portrait
  state.master = master
  state.familiar = { entry, kind: prev?.kind ?? "familiar", improved: !!improved, level: prev?.level ?? Math.max(1, num(master.level)),
    base: { int: state.abilities.int, type: state.monster.type, sr: state.monster.sr, skills: { ...state.skills } } }
  state.name = ""
  syncFamiliar()
  save()
  tab = "monster"
  renderAll()
}

async function openFamiliarPicker(startImproved) {
  const box = h("input", { type: "search", placeholder: "Search familiars by name", "aria-label": "Search familiars" })
  const listSel = h("select", { "aria-label": "List" }, h("option", { value: "" }, "Familiars"), h("option", { value: "improved", selected: !!startImproved }, "Improved familiars"))
  const results = h("div", { class: "picker-results", role: "list" }, h("p", { class: "muted" }, "Loading familiars…"))
  const dlg = openDialog("Choose a familiar", h("div", { class: "row picker-filters" }, box, listSel), results)
  let data = { familiars: [], improved: [] }
  const render = () => {
    const q = box.value.trim().toLowerCase(), imp = listSel.value === "improved"
    const hits = (imp ? data.improved : data.familiars).filter((e) => !q || e.name.toLowerCase().includes(q))
    fill(results, ...hits.map((e) => h("button", { class: "picker-item", role: "listitem", disabled: !e.monsterId, onclick: async () => { dlg.done(); await chooseFamiliar(e, imp) } },
      h("span", { class: "pi-name" }, e.name, h("span", { class: "pi-meta" }, imp
        ? ` ${e.alignment || "any alignment"} · master level ${e.levelText || e.level}`
        : ` ${e.special}`), e.monsterId ? null : h("span", { class: "pi-meta" }, " · no stat block to build from")),
      h("span", { class: "pi-pre" }, e.source))),
    hits.length ? null : h("p", { class: "muted" }, data.familiars.length ? "No familiars match." : "Couldn't load the familiars."))
  }
  box.addEventListener("input", render)
  listSel.addEventListener("change", render)
  loadCompendium("familiars.json", { familiars: [], improved: [] }).then((d) => { data = d; render() })
  box.focus()
}

function masterSkillsCard() {
  const m = (state.master ??= blankMaster())
  m.skills ??= {}
  const add = h("select", { "aria-label": "Add a skill" }, h("option", { value: "" }, "+ Add a skill the master has ranks in…"),
    ...Object.entries(SKILLS).filter(([k]) => !SUB_SKILLS.includes(k) && !(k in m.skills)).map(([k, v]) => h("option", { value: k }, v[0])))
  add.addEventListener("change", () => { if (add.value) { m.skills[add.value] = 1; changed(true) } })
  return h("div", { class: "card" },
    h("div", { class: "group-title", style: "margin-top:0" }, "Master's skill ranks"),
    h("p", { class: "note" }, "For each skill, the familiar uses the better of its own ranks and its master's (with its own ability modifiers)."),
    h("div", { class: "row" }, ...Object.keys(m.skills).filter((k) => k in SKILLS).sort((a, b) => SKILLS[a][0].localeCompare(SKILLS[b][0])).map((k) =>
      h("div", { class: "row", style: "gap:.25rem" }, field(SKILLS[k][0], numField(`master.skills.${k}`, { min: 0, style: "width:4.5rem" })),
        h("button", { class: "small danger", title: `Remove ${SKILLS[k][0]}`, onclick: () => { delete m.skills[k]; changed(true) } }, "×")))),
    add)
}

function familiarPanel() {
  const fam = state.familiar, mon = state.monster
  if (!fam?.entry || !mon) return [
    h("h2", {}, "Familiar"),
    h("p", { class: "muted" }, "Pick a familiar from the wizard's list or the Improved Familiar list (Archives of Nethys). It starts from the creature's own stat block, then takes its master's base attack bonus, saves, skill ranks and half their hit points, and gains the familiar abilities for the master's level. Switch it to a Beastmastery sphere Pet to drop what a pet doesn't get."),
    h("div", { class: "row" }, h("button", { class: "primary", onclick: () => openFamiliarPicker(false) }, "Choose a familiar"),
      h("button", { onclick: () => openFamiliarPicker(true) }, "Choose an improved familiar")),
  ]
  const c = calc(), e = fam.entry, L = familiarLevel(), step = Math.ceil(L / 2), full = familiarFull(), pet = fam.kind === "pet"
  const specials = familiarSpecials()
  const kindNote = pet
    ? (fam.improved
      ? "Improved Pet (legendary talent): the pet gets all the normal benefits of a familiar, as an improved familiar does (it does not learn to speak with animals of its kind, and a non-animal keeps its type)."
      : "Pet (Beastmastery sphere): effective level is the higher of the master's base attack bonus and Handle Animal ranks. It stays an animal, keeps its own Intelligence, and does not get deliver touch spells, scry on familiar, share spells, speak with animals of its kind or spell resistance.")
    : (fam.improved
      ? "Improved familiar: as a regular familiar, but it does not learn to speak with animals of its kind, and a creature that isn't an animal keeps its type."
      : "Familiar: an animal becomes a magical beast; its Hit Dice, base attack bonus, saves, skill ranks and feats come from the rules below, not from the new type.")
  return [
    h("div", { class: "row" }, h("h2", { style: "margin:0" }, e.name), h("span", { class: "muted" }, e.source),
      h("div", { class: "spacer" }), mon.base.url ? h("a", { href: mon.base.url, target: "_blank", rel: "noopener" }, "On Archives of Nethys") : null,
      h("button", { onclick: () => openFamiliarPicker(fam.improved) }, "Choose another"),
      h("button", { onclick: () => exportStatBlock() }, "Stat block")),
    h("div", { class: "card" },
      h("div", { class: "row" },
        (() => {
          const box = h("input", { type: "checkbox", checked: pet })
          box.addEventListener("change", () => { fam.kind = box.checked ? "pet" : "familiar"; changed(true) })
          return h("div", { class: "field" }, h("span", {}, " "), h("label", { class: "row", style: "gap:.3rem" }, box, "Pet (Beastmastery sphere)"))
        })(),
        h("div", { class: "field" }, h("span", {}, " "), checkbox("familiar.improved", pet ? "Improved Pet" : "Improved Familiar")),
        pet ? null : field("Master's familiar level", numField("familiar.level", { min: 1, max: 20, style: "width:5.5rem" }), "Levels of classes that grant a familiar"),
        h("div", { class: "stat", style: "min-width:7rem" }, h("b", {}, String(L)), h("span", {}, "Effective level"))),
      h("p", { class: "note" }, kindNote),
      e.alignment || e.level ? h("p", { class: "note" }, `Improved familiar requirements: ${e.alignment ? `alignment ${e.alignment}` : "any alignment"}; master level ${e.levelText || e.level}.`) : null),
    masterCard(pet ? ["level", "bab", "han", "fort", "ref", "will", "hp"] : ["level", "bab", "fort", "ref", "will", "hp"],
      "The familiar uses the master's base attack bonus, the better of its own and the master's base saves, and half the master's hit points."),
    masterSkillsCard(),
    h("div", { class: "card" },
      h("div", { class: "group-title", style: "margin-top:0" }, `Level ${L} ${pet ? "pet" : "familiar"}`),
      h("div", { class: "mon-compare" },
        ...[["Natural armor adj.", `+${step}`], ["Intelligence", state.abilities.int == null ? "—" : String(c.abl.int.total)], ["HD (for effects)", String(familiarHd(c))],
          ["Hit points", String(c.hp)], ["BAB", signed(c.bab)], ["Fort", signed(c.saveTotals.fort)], ["Ref", signed(c.saveTotals.ref)], ["Will", signed(c.saveTotals.will)],
          ["Spell resistance", mon.sr || "—"], ["Type", mon.type]]
          .map(([k, v]) => h("div", { class: "stat" }, h("b", {}, v), h("span", {}, k)))),
      num(state.master?.hp) > 0 ? null : h("p", { class: "note" }, "Enter the master's hit points for the familiar's (half of them); until then it shows the creature's own."),
      h("p", { class: "note" }, `Special abilities: ${specials.map(([, n]) => n.replace(/ \((?:Ex|Su|Sp)\)/, "")).join(", ")}.`),
      h("p", { class: "note" }, `The master gains: ${familiarMasterGains()}.`)),
    h("div", { class: "card grid" },
      field("Size", h("input", { value: SIZES[state.race.size]?.[0] ?? "", disabled: true })),
      field("Speed", h("input", { value: [`${num(state.race.speed)} ft.`, ...Object.entries(mon.speeds ?? {}).filter(([k, v]) => k !== "flyManeuver" && num(v)).map(([k, v]) => `${k} ${v} ft.`)].join(", "), disabled: true })),
      field("Senses", input("monster.senses")), field("Special attacks", input("monster.specialAttacks")), field("Special qualities", input("monster.sq"))),
    archetypeCard(),
    ...attackEditor(c),
  ]
}

// what the master gets: the familiar's own bonus, and Alertness (unless an archetype replaces it)
function familiarMasterGains() {
  const replaced = replacedByArchetypes()
  return [replaced.has("the variable familiar bonus") ? "" : state.familiar.entry.special,
    replaced.has("alertness") ? "" : "Alertness while the familiar is within arm's reach"].filter(Boolean).join("; ") || "nothing (replaced by its archetype)"
}

function familiarNotes(c) {
  const fam = state.familiar, L = familiarLevel()
  const what = fam.kind === "pet" ? (fam.improved ? "improved pet (Beastmastery sphere)" : "pet (Beastmastery sphere)") : fam.improved ? "improved familiar" : "familiar"
  return [`${state.master?.name ? `${state.master.name}'s ${what}` : what[0].toUpperCase() + what.slice(1)}: ${fam.entry.name}, effective level ${L}.`,
    `Counts as ${familiarHd(c)} Hit Dice for effects. Hit points are half the master's.`,
    `The master gains: ${familiarMasterGains()}.`, (fam.archetypes ?? []).length ? `Archetypes: ${fam.archetypes.map((a) => a.name).join(", ")}.` : ""].filter(Boolean).join("\n\n")
}

// ---------- hooks: the variant's rules over the Monster Creator's ----------
if (VARIANT === "companion" || VARIANT === "familiar") {
  const kindOf = () => (VARIANT === "companion" ? state.companion : state.familiar)
  const baseChanged = HOOKS.changed
  HOOKS.changed = () => {
    if (VARIANT === "companion") syncCompanion()
    else syncFamiliar()
    baseChanged?.()
  }
  const baseCalc = HOOKS.calc
  HOOKS.calc = (out, s, m) => {
    baseCalc?.(out, s, m)
    if (VARIANT === "familiar") familiarCalc(out, s, m)
  }
  HOOKS.summary = (c) => {
    if (!kindOf()?.entry) return []
    const stat = (v, label) => h("div", { class: "stat" }, h("b", {}, v), h("span", {}, label))
    return [h("div", { class: "card" }, h("div", { class: "stat-grid" },
      ...(VARIANT === "companion"
        ? [stat(String(companionLevel()), "Druid level"), stat(String(c.hd), "HD"), stat(String(companionRow(companionLevel()).tricks), "Bonus tricks")]
        : [stat(String(familiarLevel()), "Master level"), stat(String(familiarHd(c)), "HD (effects)"), stat(state.familiar.kind === "pet" ? "Pet" : state.familiar.improved ? "Improved" : "Familiar", "Kind")])))]
  }
  HOOKS.statHeader = () => {
    const owner = state.master?.name ? `${state.master.name}'s ` : ""
    return VARIANT === "companion"
      ? [state.name || state.companion.entry.name, `${owner}animal companion (${state.companion.entry.name}), effective druid level ${companionLevel()}`]
      : [state.name || state.familiar.entry.name, `${owner}${state.familiar.kind === "pet" ? "pet" : state.familiar.improved ? "improved familiar" : "familiar"} (${state.familiar.entry.name}), master level ${familiarLevel()}`]
  }
  const baseExport = HOOKS.exportActor
  HOOKS.exportActor = (actor, c) => {
    baseExport?.(actor, c)
    if (!kindOf()?.entry) return
    // an ally, tied to its own sheet; a companion has no challenge rating of its own
    actor.prototypeToken = { ...actor.prototypeToken, actorLink: true, disposition: 1 }
    actor.system.details.cr = { base: 0 }
    if (!state.name) actor.name = actor.prototypeToken.name = kindOf().entry.name
    const notes = VARIANT === "companion" ? companionNotes() : familiarNotes(c)
    // a familiar's hit points are half its master's: the difference from its own Hit Dice, as a change
    const hpDiff = VARIANT === "familiar" && c.ownHp != null ? c.hp - c.ownHp : 0
    actor.items.push(item("feat", VARIANT === "companion" ? "Animal companion" : "Familiar", { subType: "misc", description: { value: toHtml(notes) },
      changes: hpDiff ? [{ _id: randomId(8).toLowerCase(), formula: String(hpDiff), operator: "add", target: "mhp", type: "untyped", priority: 0 }] : [] }))
  }
  // the PDF sheet's identity block: master, kind and creature details in place of a character's
  HOOKS.pdfRows = (rows, c) => {
    const k = kindOf(), mon = state.monster
    if (!k?.entry || !mon) return rows
    const speeds = [`${num(state.race.speed)} ft.`, ...Object.entries(mon.speeds ?? {}).filter(([key, v]) => key !== "flyManeuver" && num(v)).map(([key, v]) => `${key} ${v} ft.`)].join(", ")
    const role = VARIANT === "companion" ? "Animal companion" : state.familiar.kind === "pet" ? (state.familiar.improved ? "Improved pet" : "Pet") : state.familiar.improved ? "Improved familiar" : "Familiar"
    const level = VARIANT === "companion" ? ["Druid level", String(companionLevel())] : ["Master level", String(familiarLevel())]
    return [
      [["Master", state.master?.name || state.details.player], ["Role", role], level],
      [["Kind", k.entry.name], ["Size", SIZES[state.race.size]?.[0]], ["Speed", speeds]],
      [["Type", mon.type], ["Alignment", ALIGNMENTS[state.details.alignment]], ["Hit Dice", VARIANT === "familiar" ? `${c.hd} (${familiarHd(c)} for effects)` : String(c.hd)]],
      [["Senses", mon.senses || "-"], ["Space", mon.space || "5 ft."], ["Reach", mon.reach || "5 ft."]],
    ]
  }
  HOOKS.pdfWide = () => {
    const k = kindOf(), mon = state.monster
    if (!k?.entry || !mon) return []
    const special = [mon.specialAttacks, mon.sq, mon.sr ? `SR ${mon.sr}` : "", mon.dr ? `DR ${mon.dr}` : ""].filter(Boolean).join("; ")
    return [["Special attacks & qualities", special || "-"],
      VARIANT === "companion" ? ["Tricks", `${companionRow(companionLevel()).tricks} bonus${state.companion.tricks ? `: ${state.companion.tricks}` : ""}`]
        : ["Master gains", familiarMasterGains()]]
  }
  HOOKS.skillLocked = (key, c) => {
    if (VARIANT !== "companion" || !state.companion?.entry) return ""
    if (state.abilities.int == null) return "A mindless companion has no skill ranks."
    return num(c.abl.int.total) < 3 && !ANIMAL_SKILLS.includes(key) ? "With Intelligence 2 or lower, a companion's ranks go in the animal skills: Acrobatics, Climb, Escape Artist, Fly, Intimidate, Perception, Stealth, Survival and Swim." : ""
  }
  panels.monster = () => (VARIANT === "companion" ? companionPanel() : familiarPanel())
  document.getElementById("btnNew")?.addEventListener("click", () => { tab = "monster" })
}

function companionNotes() {
  const comp = state.companion, L = companionLevel(), row = companionRow(L)
  return [`${state.master?.name ? `${state.master.name}'s animal companion` : "Animal companion"}: ${comp.entry.name}, effective druid level ${L}.`,
    `Bonus tricks: ${row.tricks}.${comp.tricks ? ` Tricks: ${comp.tricks}` : ""}`,
    comp.fullBab ? "Uses the Beastmastery variant rule: base attack bonus equals Hit Dice." : ""].filter(Boolean).join("\n\n")
}

// the first render (monster.js leaves it to the variant's script)
if (VARIANT === "companion" || VARIANT === "familiar") renderAll()
