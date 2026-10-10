// Conjuration Companion Builder: a page on the Monster Creator's engine (builder.js in monster mode,
// monster.js) with window.BUILDER_VARIANT = "conjuration", sharing the master card, attack editor
// and archetype picker with companions.js. A Conjuration sphere companion has a base form, grows
// by Table: Companion with its caster's caster level, and is shaped by (form) and (type) talents
// and companion archetypes (compendium/conjuration-companion.json and conjuration.json).
"use strict"

const CONJ = { data: null, talents: [], archetypes: [] }
const blankConjuration = () => ({ entry: null, cl: 1, small: false, size: "", increases: [], talents: [], archetypes: [], attackSig: "" })
const CONJ_SKILLS = ["clm", "fly", "kpl", "ste", "swm"]
// special abilities by Hit Dice (Companion Features)
const CONJ_SPECIALS = [
  [2, "Evasion (Ex)", "No damage on a successful Reflex save against an effect that deals half damage on a save."],
  [5, "Devotion (Ex)", "+4 morale bonus on Will saves against charm and enchantment effects."],
  [11, "Improved Evasion (Ex)", "As evasion, and only half damage on a failed Reflex save."],
]
const hasConjArchetype = (name) => (state.conjuration?.archetypes ?? []).some((a) => a.name === name)
// the companion's (form) and (type) talents: the ticked ones, and the avatar archetype's Otherworldly
// Paragon, which is treated as a (form) talent
const conjTalents = () => [...(state.conjuration?.talents ?? []),
  ...(hasConjArchetype("Avatar") ? [{ name: "Otherworldly Paragon", kind: "form", fromArchetype: "Avatar" }] : [])]

// the caster level its statistics use (a familiar-archetype companion counts half), and its Hit Dice
function conjLevel() {
  const co = state.conjuration
  const cl = Math.max(1, Math.floor(num(co?.cl)))
  return Math.min(40, hasConjArchetype("Familiar") ? Math.max(1, Math.floor(cl / 2)) : cl)
}
function conjRow() {
  const table = CONJ.data?.table ?? []
  const row = table[conjLevel() - 1] ?? { cl: 1, hd: 1, bab: 1, skills: 1, feats: 1, natural: 0, good: 2, bad: 0 }
  // mindless and unwilling companions gain a Hit Die at 4th caster level and every 4 after
  const extra = ["Mindless", "Unwilling"].filter(hasConjArchetype).length * Math.floor(Math.max(1, num(state.conjuration?.cl)) / 4)
  return { ...row, hd: row.hd + extra, extraHd: extra }
}

function conjAttacks(form, small) {
  return form.attacks.map((a) => ({ group: 0, range: "melee", name: a.name, count: a.count, natural: true, primary: a.primary,
    dice: small ? a.small || stepDice(a.medium, -1) : a.medium, crit: "", extra: "", atkMisc: 0, dmgMisc: 0, finesse: false, enh: 0,
    printedBonus: null, printedIter: [], printedDamage: "", note: a.note }))
}

function syncConjuration() {
  const co = state.conjuration, mon = state.monster
  if (!co?.entry || !mon) return
  const form = co.entry, row = conjRow(), avatar = hasConjArchetype("Avatar") ? CONJ.data?.avatar : null
  const mage = hasConjArchetype("Mage"), mindless = hasConjArchetype("Mindless")

  let racial = state.classes.find((cl) => cl.racial)
  if (!racial) state.classes.unshift((racial = { ...blankClass(false), racial: true }))
  const baseSkills = mage ? ["fly", "kpl", "ste", "kar", "spl"] : CONJ_SKILLS
  Object.assign(racial, { name: "Conjuration companion (Hit Dice)", level: row.hd, hd: mage ? 6 : 10, bab: mage ? "low" : "high",
    fort: form.saves.fort, ref: form.saves.ref, will: form.saves.will, skills: 2,
    classSkills: [...new Set([...baseSkills, ...(racial.classSkills ?? []).filter((k) => mage ? !["clm", "swm"].includes(k) : true)])], favored: false })

  const increases = Math.floor(row.hd / 4)
  co.increases = Array.from({ length: increases }, (_, i) => co.increases?.[i] ?? "")
  const paragon = avatar ? 2 + Math.floor(row.hd / 2) : 0
  for (const k of ABL) {
    let v = (avatar?.abilities ?? form.abilities)[k]
    if (co.small && k === "dex") v += 2
    if (co.small && k === "str") v -= 2
    if (k === "int" && hasConjArchetype("Beast")) v = 2
    if (["str", "dex", "con"].includes(k)) v += paragon
    v += co.increases.filter((x) => x === k).length
    state.abilities[k] = k === "int" && mindless ? null : v
  }
  state.race.size = co.size || (co.small ? "sm" : "med")
  mon.space = SPACE[state.race.size]
  mon.reach = `${REACH[state.race.size]?.[0] ?? 5} ft.`

  // the form's natural attacks at its size (none for a warrior companion); rebuilt only when those change
  const warrior = hasConjArchetype("Warrior")
  const sig = JSON.stringify([form.name, co.small, warrior])
  if (co.attackSig !== sig) {
    mon.attacks = warrior ? [] : conjAttacks(form, co.small)
    co.attackSig = sig
  }
  const naturals = mon.attacks.filter((a) => a.natural).reduce((n, a) => n + num(a.count), 0)
  const natural = num(form.natural) + row.natural
  const auto = [newFeature("misc", { name: "Natural armor", monster: true,
    desc: `Natural armor +${natural}: +${num(form.natural)} for the ${form.name.toLowerCase()} form, +${row.natural} from Table: Companion.`,
    changes: [{ formula: String(natural), target: "nac", type: "untyped", operator: "add" }] })]
  for (const [hd, name, desc] of CONJ_SPECIALS) if (row.hd >= hd) auto.push(newFeature("misc", { name, desc, monster: true }))
  if (row.hd >= 7) {
    if (naturals >= 3) auto.push(newFeature("feat", { name: "Multiattack", desc: "Bonus feat at 7 Hit Dice: secondary natural attacks take a -2 penalty instead of -5." }))
    else auto.push(newFeature("misc", { name: "Multiattack (Ex)", monster: true,
      desc: "With fewer than three natural attacks, the companion instead gets a second attack with one of its natural weapons, at a -5 penalty." }))
  }
  if (mindless) auto.push(newFeature("misc", { name: "Mindless", monster: true,
    desc: "No Intelligence score: immune to mind-affecting effects, with no feats or skill points.",
    changes: [{ formula: String(-2 * row.hd), target: "bonusSkillRanks", type: "untyped", operator: "add" },
      { formula: String(-Math.ceil(row.hd / 2)), target: "bonusFeats", type: "untyped", operator: "add" }] }))
  if (avatar) auto.push(newFeature("misc", { name: "Otherworldly Paragon (form)", monster: true,
    desc: `Strength, Dexterity and Constitution +${paragon} (2 + 1 per 2 Hit Dice), already in the ability scores. Treated as a (form) talent: the avatar can't benefit from other (form) talents that give an untyped bonus to those scores.` }))
  setAutoFeatures("conjuration", auto)
  state.race.name = `${form.name} companion`
}

function chooseForm(form) {
  const prev = state.conjuration
  const s = blankState()
  s.spheresModule = state.spheresModule
  s.hpMode = "average"
  s.details.languages = "Common"
  s.portrait = prev?.entry ? "" : state.portrait
  s.master = state.master ?? blankMaster()
  s.conjuration = { ...blankConjuration(), entry: form, cl: prev?.cl ?? 1, small: !!prev?.small }
  s.classes = []
  s.monster = { base: { id: `conjuration/${form.name.toLowerCase()}`, name: `${form.name} companion`, cr: "1", xp: 0, url: "", source: "Conjuration sphere" },
    cr: "1", type: "outsider", subtypes: [], role: "combat", speeds: Object.fromEntries(Object.entries(form.speeds).filter(([k]) => k !== "land")),
    senses: "darkvision 60 ft.", aura: "", defensive: "", dr: "", immune: "", resist: "", sr: "", weaknesses: "", sq: "", specialAttacks: "", sla: "", spells: "",
    space: "", reach: "", gearText: "", hpAbility: "con", baseHd: 0, baseCr: "1", templates: [], adjustments: [], addedHd: 0, attacks: [], printed: { skills: {} },
    racialMods: "", monsterChanges: [], baseMr: 0, mr: 0, mythicTemplates: [], baseDr: "", baseSr: "", baseSpecialAttacks: "" }
  s.race.speed = num(form.speeds.land)
  state = normalize(s)
  state.classes = []
  syncConjuration()
  save()
  tab = "monster"
  renderAll()
  toast(`${form.name} form chosen`)
}

// ---------- (form) and (type) talents ----------
const conjTalentTag = (t) => (t.tags.includes("type") ? "type" : "form")
function toggleConjTalent(t, on) {
  const co = state.conjuration
  co.talents = (co.talents ?? []).filter((x) => x.name !== t.name)
  state.features = state.features.filter((f) => f.formTalent !== t.name)
  if (on) {
    co.talents.push({ name: t.name, kind: conjTalentTag(t), advanced: t.kind === "advanced talent", url: t.url })
    state.features.push(newFeature("misc", { name: `${t.name} (${conjTalentTag(t)})`, desc: mdToText(t.md), monster: true, formTalent: t.name }))
  }
  changed(true)
}
function openConjTalentPicker() {
  const box = h("input", { type: "search", placeholder: "Search talents", "aria-label": "Search talents" })
  const kindSel = h("select", { "aria-label": "Talent kind" }, h("option", { value: "" }, "Form and type talents"), h("option", { value: "form" }, "(form) talents"),
    h("option", { value: "type" }, "(type) talents"), h("option", { value: "advanced" }, "Advanced talents"))
  const results = h("div", { class: "picker-results", role: "list" })
  const dlg = openDialog("Form and type talents",
    h("p", { class: "note" }, "Tick the talents this companion has. Each is added as a feature with its text; apply the numbers it changes on this tab (size, speeds, attacks) or as changes on the feature. A (form) talent applies once per companion unless it says otherwise, and a companion benefits from only one (type) talent: neither is checked here."),
    h("div", { class: "row picker-filters" }, box, kindSel), results,
    h("div", { class: "row add-row" }, h("button", { class: "primary", onclick: () => dlg.done() }, "Done")))
  const render = () => {
    const q = box.value.trim().toLowerCase()
    const hits = CONJ.talents.filter((t) => (!q || t.name.toLowerCase().includes(q) || t.md.toLowerCase().includes(q))
      && (!kindSel.value || (kindSel.value === "advanced" ? t.kind === "advanced talent" : conjTalentTag(t) === kindSel.value && t.kind !== "advanced talent")))
    fill(results, ...hits.map((t) => {
      const cb = h("input", { type: "checkbox", checked: (state.conjuration.talents ?? []).some((x) => x.name === t.name) })
      cb.addEventListener("change", () => toggleConjTalent(t, cb.checked))
      return h("label", { class: "picker-item", role: "listitem", style: "cursor:pointer" },
        h("span", { class: "pi-name" }, cb, " ", t.name, h("span", { class: "pi-meta" }, ` (${conjTalentTag(t)})${t.kind === "advanced talent" ? " · advanced" : ""}`)),
        h("span", { class: "pi-pre" }, mdToText(t.md).replace(/\s+/g, " ").slice(0, 170) + "…"))
    }), hits.length ? null : h("p", { class: "muted" }, CONJ.talents.length ? "No talents match." : "Couldn't load the talents."))
  }
  box.addEventListener("input", render)
  kindSel.addEventListener("change", render)
  render()
  box.focus()
}

function conjurationPanel() {
  const co = state.conjuration, mon = state.monster, data = CONJ.data
  if (!data) return [h("h2", {}, "Conjuration companion"), h("p", { class: "muted" }, "Loading the companion rules…")]
  if (!co?.entry || !mon) return [
    h("h2", {}, "Conjuration companion"),
    h("p", { class: "muted" }, "Choose the companion's base form. Its Hit Dice, base attack bonus, saves, skill points, feats and natural armor then follow Table: Companion by its caster's caster level, and you shape it with (form) and (type) talents and companion archetypes."),
    h("div", { class: "picked-list" }, ...data.forms.map((f) => h("button", { class: "picker-item", onclick: () => chooseForm(f) },
      h("span", { class: "pi-name" }, f.name, h("span", { class: "pi-meta" }, ` ${f.speedText} · +${f.natural} natural armor · ${f.attackText}`)),
      h("span", { class: "pi-pre" }, `${ABL.map((k) => `${k[0].toUpperCase()}${k.slice(1)} ${f.abilities[k]}`).join(", ")} · good saves: ${["fort", "ref", "will"].filter((k) => f.saves[k] === "high").map((k) => k[0].toUpperCase() + k.slice(1)).join(", ")}`)))),
  ]
  const c = calc(), form = co.entry, row = conjRow(), L = conjLevel()
  const specials = [...CONJ_SPECIALS.filter(([hd]) => row.hd >= hd).map(([, n]) => baseName(n)), ...(row.hd >= 7 ? ["multiattack"] : [])]
  const incr = co.increases.map((cur, i) => {
    const el = h("select", { "aria-label": `Ability score increase at ${(i + 1) * 4} Hit Dice` }, h("option", { value: "" }, "Choose…"),
      ...ABL.filter((k) => state.abilities[k] != null).map((k) => h("option", { value: k, selected: cur === k }, k.toUpperCase())))
    el.addEventListener("change", () => { co.increases[i] = el.value; changed(true) })
    return field(`+1 at ${(i + 1) * 4} HD`, el)
  })
  const sizeSel = h("select", { "aria-label": "Current size" }, h("option", { value: "" }, `By base size (${co.small ? "Small" : "Medium"})`),
    ...Object.entries(SIZES).map(([k, v]) => h("option", { value: k, selected: co.size === k }, v[0])))
  sizeSel.addEventListener("change", () => { co.size = sizeSel.value; changed(true) })
  const numeric = ["Familiar", "Mage", "Mindless", "Unwilling", "Beast", "Warrior", "Avatar"].filter(hasConjArchetype)
  return [
    h("div", { class: "row" }, h("h2", { style: "margin:0" }, `${form.name} companion`), h("span", { class: "muted" }, "Conjuration sphere"),
      h("div", { class: "spacer" }), h("a", { href: `../../${data.url}#summon`, target: "_blank", rel: "noopener" }, "Rules on the wiki"),
      h("button", { onclick: () => { if (confirm("Choose a different base form? This starts the companion again.")) { state.conjuration.entry = null; changed(true) } } }, "Change form"),
      h("button", { onclick: () => exportStatBlock() }, "Stat block")),
    h("div", { class: "card" },
      h("div", { class: "row" }, h("div", { class: "group-title", style: "margin:0" }, "Caster"), h("div", { class: "spacer" }),
        h("button", { class: "small", title: "Read the caster's name and sphere caster level from the character saved in the Character Builder on this browser", onclick: masterFromBuilder }, "From the Character Builder")),
      h("div", { class: "row" },
        field("Caster's name", input("master.name", { placeholder: "Caster's name" })),
        field("Caster level", numField("conjuration.cl", { min: 1, max: 40, style: "width:5.5rem" }), "Not counting temporary increases"),
        h("div", { class: "field" }, h("span", {}, " "), checkbox("conjuration.small", "Small (+2 Dex, -2 Str)")),
        field("Current size", sizeSel, "For Altered Size and the like")),
      hasConjArchetype("Familiar") ? h("p", { class: "note" }, `Familiar archetype: its statistics use half the caster level (${L}).`) : null),
    h("div", { class: "card" },
      h("div", { class: "group-title", style: "margin-top:0" }, `Caster level ${L} companion`),
      h("div", { class: "mon-compare" },
        ...[["Hit Dice", `${row.hd}d${hasConjArchetype("Mage") ? 6 : 10}`], ["BAB", signed(c.bab)], ["Fort", signed(c.saves.fort)], ["Ref", signed(c.saves.ref)], ["Will", signed(c.saves.will)],
          ["Skill points", String(c.skillBudget)], ["Feats", String(c.featSlots)], ["Natural armor", `+${num(form.natural) + row.natural}`], ["Hit points", String(c.hp)]]
          .map(([k, v]) => h("div", { class: "stat" }, h("b", {}, v), h("span", {}, k)))),
      specials.length ? h("p", { class: "note" }, `Special abilities: ${specials.join(", ")}.`) : null,
      incr.length ? h("div", { class: "row" }, h("span", { class: "note" }, "Ability score increases:"), ...incr) : null,
      form.text ? h("details", {}, h("summary", { class: "note" }, `About the ${form.name.toLowerCase()} form`), h("p", { class: "note", style: "white-space:pre-wrap" }, form.text)) : null),
    h("div", { class: "card" },
      h("div", { class: "row" }, h("div", { class: "group-title", style: "margin:0" }, `Form and type talents (${conjTalents().length})`), h("div", { class: "spacer" }),
        h("button", { class: "small", onclick: () => openConjTalentPicker() }, "+ Add talents")),
      ...conjTalents().map((t) => h("div", { class: "row" }, h("b", {}, t.name), h("span", { class: "muted" }, `(${t.kind})${t.advanced ? " · advanced" : ""}`),
        t.fromArchetype ? h("span", { class: "note" }, `From the ${t.fromArchetype} archetype: Strength, Dexterity and Constitution +${2 + Math.floor(row.hd / 2)}, already in the ability scores. No other (form) talent can add an untyped bonus to those.`) : null,
        h("div", { class: "spacer" }),
        t.fromArchetype ? null : h("a", { href: `../../${t.url}`, target: "_blank", rel: "noopener" }, "On the wiki"),
        t.fromArchetype ? null : h("button", { class: "small danger", onclick: () => toggleConjTalent({ name: t.name, tags: [t.kind] }, false) }, "Remove"))),
      h("p", { class: "note" }, "Every companion gets one (form) or (type) talent free; the rest are talents its caster spends. Their text is on the Feats & Features tab: apply what they change to the size, speeds, senses and attacks below, or as changes on the feature.")),
    archetypeCard(),
    numeric.length ? h("p", { class: "note" }, `Worked into the numbers above for ${numeric.join(", ")}: ${[
      hasConjArchetype("Familiar") ? "half caster level" : "", hasConjArchetype("Mage") ? "d6 Hit Dice, half base attack bonus and the mage's class skills" : "",
      hasConjArchetype("Mindless") ? "no Intelligence, feats or skill points, and the extra Hit Dice" : "", hasConjArchetype("Unwilling") ? "the extra Hit Dice" : "",
      hasConjArchetype("Beast") ? "Intelligence 2" : "", hasConjArchetype("Warrior") ? "no natural attacks from the form" : "",
      hasConjArchetype("Avatar") ? "the avatar's ability scores and Otherworldly Paragon" : ""].filter(Boolean).join("; ")}. Everything else an archetype changes is left to you.`) : null,
    h("div", { class: "card grid" },
      field("Type", input("monster.type")),
      field("Land speed", input("race.speed", { type: "number", min: 0, step: 5 })),
      ...["fly", "swim", "climb", "burrow"].map((k) => field(`${k[0].toUpperCase()}${k.slice(1)} speed`, input(`monster.speeds.${k}`, { type: "number", min: 0, step: 5 }, { allowBlank: true }))),
      field("Senses", input("monster.senses")), field("Special attacks", input("monster.specialAttacks")), field("Special qualities", input("monster.sq")),
      field("DR", input("monster.dr")), field("Resist", input("monster.resist")), field("Immune", input("monster.immune"))),
    form.speedText && /hover|\*/i.test(form.speedText) ? h("p", { class: "note" }, `Speed as written: ${form.speedText} (see "About the ${form.name.toLowerCase()} form" above).`) : null,
    ...attackEditor(c),
  ]
}

function conjurationNotes() {
  const co = state.conjuration, row = conjRow()
  return [`${state.master?.name ? `${state.master.name}'s Conjuration companion` : "Conjuration sphere companion"}: ${co.entry.name.toLowerCase()} form, caster level ${num(co.cl)}${hasConjArchetype("Familiar") ? ` (counts as ${conjLevel()})` : ""}, ${row.hd} Hit Dice.`,
    conjTalents().length ? `Talents: ${conjTalents().map((t) => `${t.name} (${t.kind})`).join(", ")}.` : "",
    (co.archetypes ?? []).length ? `Archetypes: ${co.archetypes.map((a) => a.name).join(", ")}.` : ""].filter(Boolean).join("\n\n")
}

// ---------- hooks ----------
if (VARIANT === "conjuration") {
  const baseChanged = HOOKS.changed
  HOOKS.changed = () => { syncConjuration(); baseChanged?.() }
  HOOKS.archetypeList = async () => CONJ.archetypes
  HOOKS.summary = (c) => {
    if (!state.conjuration?.entry) return []
    const stat = (v, label) => h("div", { class: "stat" }, h("b", {}, v), h("span", {}, label))
    return [h("div", { class: "card" }, h("div", { class: "stat-grid" }, stat(String(num(state.conjuration.cl)), "Caster level"), stat(String(c.hd), "HD"),
      stat(String(conjTalents().length), "Form talents")))]
  }
  HOOKS.statHeader = () => [state.name || `${state.conjuration.entry.name} companion`,
    `${state.master?.name ? `${state.master.name}'s ` : ""}Conjuration sphere companion (${state.conjuration.entry.name.toLowerCase()} form), caster level ${num(state.conjuration.cl)}`]
  const baseExport = HOOKS.exportActor
  HOOKS.exportActor = (actor, c) => {
    baseExport?.(actor, c)
    if (!state.conjuration?.entry) return
    actor.prototypeToken = { ...actor.prototypeToken, actorLink: true, disposition: 1 }
    actor.system.details.cr = { base: 0 }
    if (!state.name) actor.name = actor.prototypeToken.name = `${state.conjuration.entry.name} companion`
    actor.items.push(item("feat", "Conjuration companion", { subType: "misc", description: { value: toHtml(conjurationNotes()) } }))
  }
  HOOKS.pdfRows = (rows, c) => {
    const co = state.conjuration, mon = state.monster
    if (!co?.entry || !mon) return rows
    const speeds = [`${num(state.race.speed)} ft.`, ...Object.entries(mon.speeds ?? {}).filter(([key, v]) => key !== "flyManeuver" && num(v)).map(([key, v]) => `${key} ${v} ft.`)].join(", ")
    return [
      [["Caster", state.master?.name || state.details.player], ["Role", "Conjuration companion"], ["Caster level", String(num(co.cl))]],
      [["Base form", co.entry.name], ["Size", SIZES[state.race.size]?.[0]], ["Speed", speeds]],
      [["Type", mon.type], ["Alignment", ALIGNMENTS[state.details.alignment]], ["Hit Dice", String(c.hd)]],
      [["Senses", mon.senses || "-"], ["Space", mon.space || "5 ft."], ["Reach", mon.reach || "5 ft."]],
    ]
  }
  HOOKS.pdfWide = () => {
    const co = state.conjuration, mon = state.monster
    if (!co?.entry || !mon) return []
    return [["Form and type talents", conjTalents().map((t) => t.name).join(", ") || "-"],
      ["Archetypes & special", [(co.archetypes ?? []).map((a) => a.name).join(", "), mon.specialAttacks, mon.sq, mon.dr ? `DR ${mon.dr}` : ""].filter(Boolean).join("; ") || "-"]]
  }
  panels.monster = () => conjurationPanel()

  state.conjuration ??= blankConjuration()
  Promise.all([loadCompendium("conjuration-companion.json", { table: [], forms: [], avatar: null, url: "" }),
    loadCompendium("conjuration.json", { entries: [] })]).then(([data, sphere]) => {
    CONJ.data = data
    const isForm = (e) => (e.tags ?? []).some((t) => t === "form" || t === "type")
    CONJ.talents = sphere.entries.filter((e) => (e.kind === "talent" || e.kind === "advanced talent") && isForm(e) && e.status !== "retired")
      .sort((a, b) => a.name.localeCompare(b.name))
    CONJ.archetypes = [
      ...sphere.entries.filter((e) => e.kind === "companion archetype").map((e) => ({ name: e.name, source: e.source, url: `../../${e.url}`,
        intro: mdToText(e.md), abilities: [{ name: `${e.name} (companion archetype)`, text: mdToText(e.md) }], replaces: [] })),
      ...(data.avatar ? [{ name: "Avatar", source: data.avatar.source, url: `../../${data.avatar.url}`, intro: "Granted by the voidrusher and void conduit: not otherwise available. " + mdToText(data.avatar.text),
        abilities: [{ name: "Avatar (companion archetype)", text: mdToText(data.avatar.text) }], replaces: [] }] : []),
    ].sort((a, b) => a.name.localeCompare(b.name))
    if (state.conjuration.entry) state.conjuration.entry = data.forms.find((f) => f.name === state.conjuration.entry.name) ?? state.conjuration.entry
    syncConjuration()
    renderAll()
  })
  renderAll()
}
