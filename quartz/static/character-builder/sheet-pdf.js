// Printable character sheet (US Letter) built with pdf-lib. Loaded on demand by builder.js and
// reads its globals (state, calc, SKILLS, …). The layout is our own; it doesn't copy any
// published sheet.
"use strict"

async function buildSheetPdf() {
  const { PDFDocument, StandardFonts, rgb } = PDFLib
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique)
  const charset = new Set(font.getCharacterSet())

  const W = 612, H = 792, M = 36
  const INK = rgb(0.13, 0.13, 0.15)
  const SOFT = rgb(0.42, 0.42, 0.45)
  const RULE = rgb(0.78, 0.78, 0.8)
  const BAR = rgb(0.27, 0.29, 0.33)
  const TINT = rgb(0.95, 0.95, 0.96)
  const ACCENT = rgb(0.12, 0.37, 0.75)
  const WHITE = rgb(1, 1, 1)

  const s = state
  const c = calc()
  const charName = s.name || "Unnamed character"

  // Standard PDF fonts only cover WinAnsi; swap the few characters the builder uses, drop the rest
  const SWAP = { "−": "-", "–": "-", "●": "*", "✓": "x", "…": "...", "\t": " " }
  const clean = (t) => [...String(t ?? "")].map((ch) => SWAP[ch] ?? (charset.has(ch.codePointAt(0)) || ch === "\n" ? ch : "?")).join("")
  const width = (t, size, f = font) => f.widthOfTextAtSize(clean(t), size)
  function fit(t, size, maxW, f = font) {
    let out = clean(t)
    if (f.widthOfTextAtSize(out, size) <= maxW) return out
    while (out.length > 1 && f.widthOfTextAtSize(out + "...", size) > maxW) out = out.slice(0, -1)
    return out + "..."
  }
  function wrap(t, size, maxW, f = font) {
    const lines = []
    for (const para of clean(t).split("\n")) {
      let line = ""
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const test = line ? `${line} ${word}` : word
        if (f.widthOfTextAtSize(test, size) <= maxW) line = test
        else {
          if (line) lines.push(line)
          line = f.widthOfTextAtSize(word, size) <= maxW ? word : fit(word, size, maxW, f)
        }
      }
      lines.push(line)
    }
    return lines
  }

  let page
  const pages = []
  function newPage() {
    page = doc.addPage([W, H])
    pages.push(page)
    return page
  }
  const text = (t, x, y, size = 9, f = font, color = INK) => page.drawText(clean(t), { x, y, size, font: f, color })
  const textR = (t, xr, y, size = 9, f = font, color = INK) => text(t, xr - width(t, size, f), y, size, f, color)
  const textC = (t, xc, y, size = 9, f = font, color = INK) => text(t, xc - width(t, size, f) / 2, y, size, f, color)
  const line = (x1, y1, x2, y2, color = RULE, thickness = 0.6) => page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color })
  const rect = (x, y, w, h, opts) => page.drawRectangle({ x, y, width: w, height: h, ...opts })
  function bar(x, yTop, w, title) {
    rect(x, yTop - 15, w, 15, { color: BAR })
    text(title.toUpperCase(), x + 6, yTop - 11, 8.5, bold, WHITE)
    return yTop - 15
  }
  // label above a value with a hairline underneath, like a form field
  function cell(x, yTop, w, label, value, size = 10) {
    text(fit(value || "", size, w - 2, bold), x, yTop - 12, size, bold)
    line(x, yTop - 15, x + w - 6, yTop - 15)
    text(label, x, yTop - 23, 6.5, font, SOFT)
    return yTop - 26
  }
  function statBox(x, yTop, w, label, value) {
    rect(x, yTop - 30, w, 30, { borderColor: RULE, borderWidth: 0.8, color: WHITE })
    textC(String(value), x + w / 2, yTop - 17, 13, bold)
    textC(label.toUpperCase(), x + w / 2, yTop - 26, 6, bold, SOFT)
  }

  // ---------- page 1: identity, abilities, skills | combat, classes, spheres, attacks ----------
  newPage()
  const portraitW = 132, portraitH = 165
  const px = W - M - portraitW, pyTop = H - M
  rect(px, pyTop - portraitH, portraitW, portraitH, { borderColor: RULE, borderWidth: 1, color: TINT })
  if (s.portrait) {
    try {
      const bytes = Uint8Array.from(atob(s.portrait.split(",")[1]), (ch) => ch.charCodeAt(0))
      const img = s.portrait.startsWith("data:image/png") ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
      const scale = Math.min((portraitW - 6) / img.width, (portraitH - 6) / img.height)
      const iw = img.width * scale, ih = img.height * scale
      page.drawImage(img, { x: px + (portraitW - iw) / 2, y: pyTop - portraitH + (portraitH - ih) / 2, width: iw, height: ih })
    } catch {
      textC("Portrait could not be read", px + portraitW / 2, pyTop - portraitH / 2, 7, italic, SOFT)
    }
  } else textC("Portrait", px + portraitW / 2, pyTop - portraitH / 2, 8, italic, SOFT)

  const headW = px - M - 12
  let y = H - M
  text(fit(charName, 22, headW, bold), M, y - 20, 22, bold)
  const classLine = s.classes.filter((cl) => cl.name && num(cl.level) > 0).map((cl) => `${cl.name} ${cl.level}`).join(" / ")
  text(fit([s.race.name, classLine].filter(Boolean).join("  ·  ") || "Pathfinder 1e character", 10.5, headW), M, y - 36, 10.5, font, SOFT)
  line(M, y - 44, M + headW, y - 44, ACCENT, 1.5)
  y -= 52
  const d = s.details
  const colW = headW / 3
  const rows = [
    [["Player", d.player], ["Alignment", ALIGNMENTS[d.alignment]], ["Deity", d.deity]],
    [["Race", s.race.name], ["Size", SIZES[s.race.size]?.[0]], ["Speed", `${num(s.race.speed)} ft.`]],
    [["Gender", d.gender], ["Age", d.age], ["Homeland", d.homeland]],
    [["Height", d.height], ["Weight", d.weight], ["Level", String(c.hd)]],
  ]
  for (const r of rows) {
    r.forEach(([label, value], i) => cell(M + i * colW, y, colW, label, value))
    y -= 26
  }
  cell(M, y, headW, "Languages", d.languages)
  y = Math.min(y - 30, pyTop - portraitH - 10)

  // left column
  const LX = M, LW = 250
  const RX = M + LW + 14, RW = W - M - RX
  const topOfColumns = y
  let ly = bar(LX, y, LW, "Ability scores")
  const abW = [40, 50, 50, 50, 60]
  const abCols = ["", "Score", "Mod", "Base", "Racial"]
  let ax = LX + 4
  abCols.forEach((h, i) => { if (h) textC(h, ax + abW[i] / 2, ly - 9, 6.5, bold, SOFT); ax += abW[i] })
  ly -= 12
  for (const k of ABL) {
    const rowTop = ly
    ax = LX + 4
    text(k.toUpperCase(), ax + 2, rowTop - 13, 10, bold)
    ax += abW[0]
    rect(ax + 8, rowTop - 18, abW[1] - 16, 16, { borderColor: RULE, borderWidth: 0.8 })
    textC(String(c.abl[k].total), ax + abW[1] / 2, rowTop - 14, 11, bold)
    ax += abW[1]
    textC(signed(c.abl[k].mod), ax + abW[2] / 2, rowTop - 14, 11, bold, ACCENT)
    ax += abW[2]
    textC(String(num(s.abilities[k])), ax + abW[3] / 2, rowTop - 14, 9, font, SOFT)
    ax += abW[3]
    const r = num(s.race.mods[k])
    textC(r ? signed(r) : "-", ax + abW[4] / 2, rowTop - 14, 9, font, SOFT)
    ly -= 20
  }

  // skills: rows stay readable (at least SKILL_MIN_ROW tall); what doesn't fit the column continues
  // in two columns at the start of the following pages. With background skills on, those (Craft,
  // Perform, Profession and their specialties) are listed as a group of their own.
  const SKILL_MIN_ROW = 9.5, SKILL_ROW = 11
  const skillRow = (k, label, abl, trainedOnly, acp) => ({ label, abl: skillAbl(k), rank: num(s.skills[k]), total: skillTotal(k, num(s.skills[k]), c), cs: c.classSkills.has(k), trainedOnly, acp })
  const groups = [{ title: s.backgroundSkills ? "Adventuring skills" : "Skills", rows: [] }]
  if (s.backgroundSkills) groups.push({ title: "Background skills", rows: [] })
  for (const [k, [label, abl, trainedOnly, acp]] of Object.entries(SKILLS)) {
    if (BG_ONLY.includes(k) && !s.backgroundSkills) continue
    const g = groups[s.backgroundSkills && BG_SKILLS.includes(k) ? 1 : 0]
    g.rows.push(skillRow(k, label, abl, trainedOnly, acp))
    if (SUB_SKILLS.includes(k))
      for (const sub of s.subSkills[k]) {
        const a = sub.ability || abl
        g.rows.push({ label: `  ${sub.name || "(specialty)"}`, abl: a, rank: num(sub.rank), total: skillTotal(k, num(sub.rank), c, a), cs: c.classSkills.has(k), sub: true })
      }
  }
  // one list: a group's heading (after the first) is a row of its own
  const skillItems = groups.flatMap((g, i) => [...(i ? [{ heading: g.title }] : []), ...g.rows])
  function skillHeader(x, w, yTop) {
    const col = { cs: x + 6, name: x + 16, abl: x + w - 82, rank: x + w - 38, total: x + w - 6 }
    text("CS", col.cs - 3, yTop - 8, 5.5, bold, SOFT)
    text("SKILL", col.name, yTop - 8, 6, bold, SOFT)
    textC("ABIL", col.abl, yTop - 8, 6, bold, SOFT)
    textR("RANKS", col.rank, yTop - 8, 6, bold, SOFT)
    textR("TOTAL", col.total, yTop - 8, 6, bold, SOFT)
    return col
  }
  // draws rows from yTop down; returns the y below the last one
  function skillRows(items, x, w, yTop, rowH, col) {
    const size = Math.min(8, rowH - 2.2)
    let yy = yTop
    items.forEach((r, i) => {
      if (r.heading) {
        text(r.heading.toUpperCase(), x + 4, yy - rowH + 2.5, 6.5, bold, ACCENT)
        line(x, yy - rowH, x + w, yy - rowH, ACCENT, 0.8)
        yy -= rowH
        return
      }
      const base = yy - rowH + (rowH - size) / 2 + 0.8
      if (i % 2 === 0) rect(x, yy - rowH, w, rowH, { color: TINT })
      if (r.cs && !r.sub) page.drawCircle({ x: col.cs, y: base + size * 0.35, size: Math.min(2.2, rowH / 4), color: ACCENT })
      const name = r.label + (r.trainedOnly ? "*" : "") + (r.acp ? " †" : "")
      text(fit(name, size, col.abl - col.name - 18, r.sub ? italic : font), col.name, base, size, r.sub ? italic : font)
      textC(r.abl.toUpperCase(), col.abl, base, size - 0.5, font, SOFT)
      textR(r.rank ? String(r.rank) : "-", col.rank, base, size, font, SOFT)
      textR(signed(r.total), col.total, base, size, bold)
      yy -= rowH
    })
    return yy
  }
  ly = bar(LX, ly - 6, LW, groups[0].title) - 2
  const skCol = skillHeader(LX, LW, ly)
  ly -= 11
  const footerY = M + 4
  const fitRows = Math.floor((ly - footerY) / SKILL_MIN_ROW)
  const firstPart = skillItems.length <= fitRows ? skillItems : skillItems.slice(0, fitRows)
  const skillOverflow = skillItems.slice(firstPart.length)
  // a trailing heading with no rows under it moves to the continuation
  if (firstPart.length && firstPart[firstPart.length - 1].heading) skillOverflow.unshift(firstPart.pop())
  const firstRowH = Math.max(SKILL_MIN_ROW, Math.min(SKILL_ROW, (ly - footerY) / Math.max(firstPart.length, 1)))
  skillRows(firstPart, LX, LW, ly, firstRowH, skCol)
  text(`* trained only   † armor check penalty applies   dot = class skill${skillOverflow.length ? "   (more skills on the next page)" : ""}`, LX, footerY - 8, 5.5, italic, SOFT)

  // right column: overflow continues on a new full-width page
  let ry = topOfColumns
  let region = { x: RX, w: RW, bottom: M + 4 }
  function room(h) {
    if (ry - h >= region.bottom) return
    newPage()
    region = { x: M, w: W - 2 * M, bottom: M + 4 }
    ry = H - M
  }
  room(15 + 3 * 34 + 4)
  ry = bar(region.x, ry, region.w, "Combat") - 4
  const sw = (region.w - 2 * 6) / 3
  const statRows = [
    [["Hit points", c.hp], ["Base attack", signed(c.bab)], ["Initiative", signed(c.init)]],
    [["Armor class", c.ac], ["Touch", c.touch], ["Flat-footed", c.flat]],
    [["CMB", signed(c.cmb)], ["CMD", c.cmd], ["Speed", `${c.speed} ft`]],
  ]
  for (const r of statRows) {
    r.forEach(([label, value], i) => statBox(region.x + i * (sw + 6), ry, sw, label, value))
    ry -= 34
  }
  room(15 + 34)
  ry = bar(region.x, ry - 4, region.w, "Saving throws") - 4
  ;[["Fortitude", c.saveTotals.fort], ["Reflex", c.saveTotals.ref], ["Will", c.saveTotals.will]].forEach(([label, v], i) =>
    statBox(region.x + i * (sw + 6), ry, sw, label, signed(v)))
  ry -= 34
  const armorBits = [c.acp ? `Armor check penalty -${c.acp}` : null, c.asf ? `Arcane spell failure ${c.asf}%` : null].filter(Boolean)
  if (armorBits.length) {
    text(armorBits.join("   "), region.x, ry - 8, 7.5, italic, SOFT)
    ry -= 12
  }

  // classes table
  const classes = s.classes.filter((cl) => num(cl.level) > 0)
  if (classes.length) {
    room(15 + 12 + classes.length * 13)
    ry = bar(region.x, ry - 4, region.w, "Classes") - 2
    const cx = { name: region.x + 4, lvl: region.x + region.w * 0.5, hd: region.x + region.w * 0.6, bab: region.x + region.w * 0.71, sv: region.x + region.w * 0.86 }
    const progName = { high: "Full", med: "3/4", low: "1/2" }
    ;[["Class", cx.name], ["Lvl", cx.lvl], ["HD", cx.hd], ["BAB", cx.bab], ["Good saves", cx.sv]].forEach(([h, x]) => text(h.toUpperCase(), x, ry - 8, 6, bold, SOFT))
    ry -= 11
    for (const cl of classes) {
      const good = ["fort", "ref", "will"].filter((k) => cl[k] === "high").map((k) => k[0].toUpperCase() + k.slice(1)).join(", ") || "-"
      text(fit((cl.name || "Class") + (cl.favored ? " (favored)" : ""), 8.5, cx.lvl - cx.name - 6), cx.name, ry - 9, 8.5)
      text(String(cl.level), cx.lvl, ry - 9, 8.5, bold)
      text(`d${cl.hd}`, cx.hd, ry - 9, 8.5)
      text(progName[cl.bab] ?? "", cx.bab, ry - 9, 8.5)
      text(fit(good, 8, region.x + region.w - cx.sv), cx.sv, ry - 9, 8)
      ry -= 13
    }
  }

  // spheres summary
  if (s.spheresModule) {
    room(15 + 34 + 26)
    ry = bar(region.x, ry - 4, region.w, "Spheres") - 4
    const qw = (region.w - 3 * 6) / 4
    ;[["Caster level", c.spheres.cl], ["MSB", signed(c.spheres.msb)], ["MSD", c.spheres.msd], ["Concentration", signed(c.spheres.concentration)]].forEach(([label, v], i) =>
      statBox(region.x + i * (qw + 6), ry, qw, label, v))
    ry -= 34
    const abName = (k) => (k ? ABILITIES[k] : "None")
    const third = region.w / 3
    cell(region.x, ry, third, "Casting ability", abName(s.sphere.casting), 9)
    cell(region.x + third, ry, third, "Practitioner ability", abName(s.sphere.practitioner), 9)
    cell(region.x + 2 * third, ry, third, "Tradition", s.sphere.tradition || "-", 9)
    ry -= 28
  }

  // attacks from equipped/listed weapons
  const weapons = s.gear.filter((g) => g.kind === "weapon")
  if (weapons.length) {
    room(15 + 30)
    ry = bar(region.x, ry - 4, region.w, "Attacks") - 2
    for (const wpn of weapons) {
      room(30)
      const ranged = wpn.attack === "ranged"
      const enh = num(wpn.enh)
      const base = c.bab + (ranged ? c.abl.dex.mod : c.abl.str.mod) + c.size + enh + c.attackMod[ranged ? "ranged" : "melee"]
      const iter = [base]
      for (let extra = c.bab - 5; extra > 0; extra -= 5) iter.push(base - (c.bab - extra))
      const dmgMod = (ranged ? 0 : c.abl.str.mod) + enh + c.damageMod[ranged ? "ranged" : "melee"]
      const dmg = wpn.damage ? `${wpn.damage}${dmgMod ? signed(dmgMod) : ""}` : "-"
      const cr = num(wpn.critRange) || 20
      const crit = `${cr < 20 ? `${cr}-20` : "20"}/×${num(wpn.critMult) || 2}`
      text(fit(`${wpn.name || "Weapon"}${enh ? ` +${enh}` : ""}`, 9.5, region.w * 0.55, bold), region.x + 2, ry - 11, 9.5, bold)
      textR(iter.map(signed).join("/"), region.x + region.w - 2, ry - 11, 9.5, bold, ACCENT)
      text(`${ranged ? "Ranged" : "Melee"}   Damage ${dmg} ${String(wpn.dmgType || "").toUpperCase()}   Critical ${crit}`, region.x + 2, ry - 22, 7.5, font, SOFT)
      line(region.x, ry - 27, region.x + region.w, ry - 27)
      ry -= 30
    }
  }

  // currency and carried weight
  room(15 + 30)
  ry = bar(region.x, ry - 4, region.w, "Wealth & load") - 2
  const cw = region.w / 5
  const carried = s.gear.reduce((a, g) => a + num(g.weight) * (g.qty === "" ? 1 : num(g.qty)), 0)
  ;[["PP", s.currency.pp], ["GP", s.currency.gp], ["SP", s.currency.sp], ["CP", s.currency.cp], ["Gear weight", `${Math.round(carried * 10) / 10} lb.`]].forEach(([label, v], i) =>
    cell(region.x + i * cw, ry, cw, label, String(num(v) || v || 0)))
  ry -= 28

  // ---------- following pages: everything with descriptions ----------
  let fy = 0
  function flowPage() {
    newPage()
    fy = H - M
  }
  flowPage()
  const FX = M, FW = W - 2 * M
  function fRoom(h) {
    if (fy - h < M + 4) flowPage()
  }
  function section(title) {
    fRoom(15 + 30)
    fy = bar(FX, fy - 6, FW, title) - 4
  }
  // description followed by a plain-text summary of the item's changes and notes
  function withChanges(e) {
    const lines = [String(e.desc ?? "").trim()]
    const ch = (e.changes ?? []).filter((x) => x.target && String(x.formula ?? "").trim())
    if (ch.length) lines.push("Changes: " + ch.map((x) => `${targetLabel(x.target)} ${/^[-+]/.test(x.formula.trim()) ? "" : "+"}${x.formula.trim()} (${PF1_FORMULA.bonusTypes[x.type] ?? x.type})`).join("; "))
    for (const n of (e.notes ?? []).filter((x) => String(x.text ?? "").trim())) lines.push(`Note: ${n.text.trim()}`)
    return lines.filter(Boolean).join("\n")
  }

  // one titled entry: name (+ meta on the right) and a wrapped description
  function entry(name, meta, desc) {
    const lines = desc ? wrap(desc, 8, FW - 12) : []
    fRoom(14 + Math.min(lines.length, 3) * 10)
    text(fit(name || "Unnamed", 9.5, FW * 0.6, bold), FX + 2, fy - 11, 9.5, bold)
    if (meta) textR(fit(meta, 7.5, FW * 0.38), FX + FW - 2, fy - 11, 7.5, font, SOFT)
    fy -= 14
    for (const l of lines) {
      fRoom(10)
      text(l, FX + 10, fy - 8, 8, font, INK)
      fy -= 10
    }
    line(FX, fy - 2, FX + FW, fy - 2)
    fy -= 5
  }

  // skills that didn't fit page 1: two columns per page
  if (skillOverflow.length) {
    let rest = [...skillOverflow]
    const gap = 14, cw = (FW - gap) / 2
    while (rest.length) {
      section("Skills (continued)")
      const perCol = Math.floor((fy - 11 - (M + 4)) / SKILL_ROW)
      const cols = [rest.slice(0, perCol), rest.slice(perCol, 2 * perCol)]
      rest = rest.slice(2 * perCol)
      let low = fy
      cols.forEach((items, i) => {
        if (!items.length) return
        const x = FX + i * (cw + gap)
        const col = skillHeader(x, cw, fy)
        low = Math.min(low, skillRows(items, x, cw, fy - 11, SKILL_ROW, col))
      })
      fy = low - 4
      if (rest.length) flowPage()
    }
  }

  if (s.spheresModule && s.talents.length) {
    section("Sphere talents")
    const groups = {}
    for (const t of s.talents) (groups[t.sphere || ""] ??= []).push(t)
    for (const key of Object.keys(groups).sort((a, b) => (a === "" ? 1 : b === "" ? -1 : label(a).localeCompare(label(b))))) {
      const kind = sphereKind(key)
      fRoom(30)
      const head = key ? `${label(key)} sphere` : "Other talents"
      const sub = key ? `${{ magic: "Spheres of Power", combat: "Spheres of Might", skill: "Spheres of Guile" }[kind] ?? ""}${kind === "magic" ? `  ·  CL ${c.spheres.cl}` : kind === "combat" ? `  ·  BAB ${signed(c.bab)}` : ""}` : ""
      text(clean(head), FX + 2, fy - 12, 11, bold, ACCENT)
      if (sub) textR(sub, FX + FW - 2, fy - 12, 7.5, font, SOFT)
      fy -= 17
      for (const t of groups[key]) entry(t.name, [t.tags, t.exclude ? "not counted" : ""].filter(Boolean).join("  ·  "), withChanges(t))
    }
  }

  if (s.features.length) {
    section("Feats & features")
    for (const kind of Object.keys(FEATURE_KINDS))
      for (const f of s.features.filter((x) => x.kind === kind)) entry(f.name, FEATURE_KINDS[kind], withChanges(f))
  }

  if (s.buffs.length) {
    section("Buffs")
    for (const b of [...s.buffs].sort((a, z) => Number(!!z.active) - Number(!!a.active))) {
      const dur = String(b.duration ?? "").trim() ? `${b.duration} ${DURATION_UNITS[b.units] ?? ""}`.trim() : DURATION_UNITS[b.units] && b.units ? DURATION_UNITS[b.units] : ""
      entry(`${b.active ? "[x] " : "[  ] "}${b.name || "Buff"}`, [BUFF_KINDS[b.kind], b.level !== "" && b.level != null ? `level ${b.level}` : "", dur].filter(Boolean).join("  ·  "), withChanges(b))
    }
  }

  if (s.spells.length) {
    const book = s.spellcasting.cls >= 0 ? s.classes[s.spellcasting.cls]?.name : ""
    section(book ? `Spells (${book})` : "Spells")
    const sorted = [...s.spells].sort((a, b) => num(a.level) - num(b.level) || String(a.name).localeCompare(b.name))
    for (const sp of sorted) entry(sp.name, `Level ${num(sp.level)}  ·  ${SCHOOLS[sp.school] ?? ""}`, sp.desc)
  }

  if (s.gear.length) {
    section("Equipment")
    const gx = { name: FX + 4, kind: FX + FW * 0.5, qty: FX + FW * 0.72, wt: FX + FW * 0.84, price: FX + FW - 4 }
    text("ITEM", gx.name, fy - 8, 6, bold, SOFT)
    text("TYPE", gx.kind, fy - 8, 6, bold, SOFT)
    textR("QTY", gx.qty, fy - 8, 6, bold, SOFT)
    textR("WEIGHT", gx.wt, fy - 8, 6, bold, SOFT)
    textR("PRICE", gx.price, fy - 8, 6, bold, SOFT)
    fy -= 12
    s.gear.forEach((g, i) => {
      const lines = g.desc ? wrap(g.desc, 7.5, FW - 20) : []
      fRoom(13 + lines.length * 9)
      if (i % 2 === 0) rect(FX, fy - 13 - lines.length * 9, FW, 13 + lines.length * 9, { color: TINT })
      const extra = g.kind === "armor" || g.kind === "shield" ? `  (AC +${num(g.ac)})` : ""
      text(fit((g.name || "Item") + (g.equipped ? " [equipped]" : "") + extra, 8.5, gx.kind - gx.name - 6, bold), gx.name, fy - 9.5, 8.5, bold)
      text(GEAR_KINDS[g.kind] ?? "", gx.kind, fy - 9.5, 8)
      textR(String(g.qty === "" ? 1 : num(g.qty)), gx.qty, fy - 9.5, 8)
      textR(num(g.weight) ? `${num(g.weight)} lb.` : "-", gx.wt, fy - 9.5, 8)
      textR(num(g.price) ? `${num(g.price)} gp` : "-", gx.price, fy - 9.5, 8)
      fy -= 13
      for (const l of lines) {
        text(l, gx.name + 8, fy - 7, 7.5, italic, SOFT)
        fy -= 9
      }
    })
  }

  if (s.bio.trim() || s.notes.trim()) {
    section("Biography & notes")
    for (const [title, body] of [["Biography", s.bio], ["Notes", s.notes]]) {
      if (!body.trim()) continue
      fRoom(30)
      text(title, FX + 2, fy - 11, 10, bold)
      fy -= 15
      for (const l of wrap(body, 9, FW - 8)) {
        fRoom(12)
        text(l, FX + 4, fy - 9, 9)
        fy -= 12
      }
      fy -= 6
    }
  }

  // the last flow page stays empty if there was nothing long-form to print
  if (fy === H - M) doc.removePage(doc.getPageCount() - 1), pages.pop()

  pages.forEach((p, i) => {
    page = p
    textR(`${clean(charName)}  ·  page ${i + 1} of ${pages.length}`, W - M, M - 18, 7, font, SOFT)
    text("Pathfinder 1e character sheet  ·  Spheres of Power Wiki character builder", M, M - 18, 7, font, SOFT)
  })

  doc.setTitle(`${charName} - character sheet`)
  doc.setCreator("Spheres of Power Wiki character builder")
  doc.setProducer("pdf-lib")
  return doc.save()
}
