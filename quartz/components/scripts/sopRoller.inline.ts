type Entry = { lo: number; hi: number; html: string }
type RollTable = { sides: number; entries: Entry[] }

// Tables look like "d100 | Result" or, for two-column layouts, "d20 | Result | d20 | Result".
// Keys are single numbers or ranges ("7", "8-10", "96–100"; "00" means 100).
function parseTable(table: HTMLTableElement): RollTable | null {
  const rows = Array.from(table.querySelectorAll("tr"))
  if (rows.length < 2) return null
  const header = Array.from(rows[0].children).map((c) => c.textContent?.trim() ?? "")
  const dieColumns: number[] = []
  let sides = 0
  header.forEach((text, i) => {
    const m = text.match(/^d(\d+)$/i)
    if (m) {
      dieColumns.push(i)
      sides = sides || Number(m[1])
    }
  })
  if (!dieColumns.length || !sides) return null

  const toNumber = (s: string) => (s === "00" ? 100 : Number(s))
  const entries: Entry[] = []
  for (const row of rows.slice(1)) {
    const cells = Array.from(row.children) as HTMLElement[]
    for (const col of dieColumns) {
      const key = cells[col]?.textContent?.trim() ?? ""
      const result = cells[col + 1]
      const m = key.match(/^(\d+)\s*(?:[-–—]\s*(\d+))?$/)
      if (!m || !result) continue
      const lo = toNumber(m[1])
      const hi = m[2] ? toNumber(m[2]) : lo
      entries.push({ lo, hi, html: result.innerHTML })
    }
  }
  return entries.length ? { sides, entries } : null
}

// The first table that comes after the marker in the document.
function tableAfter(marker: Element): HTMLTableElement | null {
  const tables = Array.from(document.querySelectorAll<HTMLTableElement>("article table"))
  return (
    tables.find((t) => marker.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING) ?? null
  )
}

document.addEventListener("nav", () => {
  for (const marker of Array.from(document.querySelectorAll<HTMLElement>(".sop-roller"))) {
    if (marker.dataset.ready) continue
    const table = tableAfter(marker)
    const parsed = table ? parseTable(table) : null
    if (!parsed) continue
    marker.dataset.ready = "true"

    const button = document.createElement("button")
    button.type = "button"
    button.textContent = `Roll d${parsed.sides}`
    const output = document.createElement("div")
    output.className = "sop-roller-result"
    output.setAttribute("aria-live", "polite")

    const roll = () => {
      const n = 1 + Math.floor(Math.random() * parsed.sides)
      const hit = parsed.entries.find((e) => n >= e.lo && n <= e.hi)
      output.innerHTML = `<span class="sop-roller-number">${n}</span>`
      const text = document.createElement("span")
      text.className = "sop-roller-text"
      text.innerHTML = hit ? hit.html : "(no matching entry in the table)"
      output.appendChild(text)
      button.textContent = `Roll again (d${parsed.sides})`
    }
    button.addEventListener("click", roll)
    window.addCleanup(() => button.removeEventListener("click", roll))
    marker.replaceChildren(button, output)
  }
})

export {}
