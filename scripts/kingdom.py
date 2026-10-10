"""Kingdom-building data from Archives of Nethys (www.aonprd.com only, through aon_compendium's
cached, rate-limited fetch) for the Kingdom Builder. Statistics only (no descriptions):

    python scripts/kingdom.py     # writes compendium/kingdom.json

Ultimate Campaign's kingdom rules: every settlement building (cost, lots, what it adds to the
kingdom and the settlement, discounts, limits, upgrades, magic item slots), the terrain
improvements, and the terrain table (preparation, farm and road costs).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import aon_compendium as aon
from downtime import body, clean

COMP = Path(__file__).resolve().parent.parent / "quartz" / "static" / "compendium"
LABELS = ["Kingdom", "Discount", "Limit", "Upgrade From", "Upgrade To", "Special", "Magic Items", "Settlement", "Terrain", "Effect", "Cost"]
LABEL_RE = re.compile(r"\b(" + "|".join(LABELS) + r")\b\s*:?\s")


def lines(path: str) -> list[str]:
    """A rules page as text lines, headings marked '## '."""
    h = body(path)
    h = re.sub(r"<(br|/h\d|/tr|/p|/table)[^>]*>", "\n", h)
    h = re.sub(r"</t[dh]>", " | ", h)
    h = re.sub(r"<h\d[^>]*>", "\n## ", h)
    return [t for t in (clean(l) for l in h.split("\n")) if t]


def blocks(path: str) -> list[tuple[str, list[str]]]:
    out, cur = [], None
    for l in lines(path):
        if l.startswith("## "):
            cur = (l[3:].strip(), [])
            out.append(cur)
        elif cur and not l.startswith("<div"):
            cur[1].append(l)
    return out


def fields(rows: list[str]) -> dict:
    """'Upgrade From Library; Upgrade To University' and friends -> {label: text}; prose lines are dropped."""
    out = {}
    for l in rows:
        hits = [m for m in LABEL_RE.finditer(l) if m.start() == 0 or l[:m.start()].rstrip().endswith(";")]
        if not hits or hits[0].start() != 0:
            continue
        for i, m in enumerate(hits):
            end = hits[i + 1].start() if i + 1 < len(hits) else len(l)
            out.setdefault(m.group(1), l[m.end():end].strip().rstrip(";").strip())
    return out


def mods(text: str) -> dict:
    """'Economy +2, Loyalty +2; Fame +1' -> {'economy': 2, 'loyalty': 2, 'fame': 1}."""
    return {k.lower(): int(v.replace("–", "-").replace("−", "-")) for k, v in re.findall(r"([A-Z][a-z]+(?: [A-Z][a-z]+)?) ([+\-–−]\d+)", text or "")}


RENAMED = {"Brothel": "Dance Hall"}


def names(text: str) -> list[str]:
    return [RENAMED.get(x.strip(), x.strip()) for x in re.split(r",| or ", text or "") if x.strip()]


def main() -> None:
    buildings = []
    for title, rows in blocks("Rules.aspx?ID=1544"):
        m = re.match(r"(.+?) \((\d+) BP(?:, (\d+) Lots?)?\)", title)
        if not m:
            continue
        f = fields(rows)
        special = re.sub(r"(Can share lot with another building).*", r"", f.get("Special", ""))
        value = re.search(r"[Bb]ase value \+([\d,]+) gp", special)
        defense = re.search(r"Defense \+(\d+)", special + " " + f.get("Kingdom", ""))
        buildings.append({"name": m.group(1).strip(), "bp": int(m.group(2)), "lots": int(m.group(3) or 0), "kingdom": mods(f.get("Kingdom", "")),
                          "discount": names(f.get("Discount", "")), "limit": f.get("Limit", ""), "upgradeFrom": names(f.get("Upgrade From", "")),
                          "upgradeTo": names(f.get("Upgrade To", "")), "special": special, "baseValue": int(value.group(1).replace(",", "")) if value else 0,
                          "defense": int(defense.group(1)) if defense else 0, "magicItems": f.get("Magic Items", ""), "settlement": mods(f.get("Settlement", ""))})
    improvements = []
    for title, rows in blocks("Rules.aspx?ID=1525"):
        f = fields(rows)
        if "Cost" not in f or "Effect" not in f or title.startswith("Table") or title == "Terrain Improvements":
            continue
        cost = re.match(r"(\d+) BP", f["Cost"])
        effect = f.get("Effect", "")
        improvements.append({"name": title.rstrip("*"), "shares": title.endswith("*"), "terrain": f.get("Terrain", "").rstrip("."), "effect": effect.rstrip("."),
                             "cost": int(cost.group(1)) if cost else None, "costText": "" if cost else f["Cost"]})
    terrain = []
    for l in lines("Rules.aspx?ID=1525"):
        cells = [c.strip() for c in l.split("|")]
        if len(cells) >= 6 and re.search(r"day|Special", cells[1]) and not cells[0].startswith("Terrain"):
            bp = lambda t: int(m.group(1)) if (m := re.search(r"(\d+) BP", t)) else None
            terrain.append({"name": re.sub(r"\s*\d+$", "", cells[0]), "exploration": cells[1], "preparation": cells[2], "prepare": bp(cells[3]), "farm": bp(cells[4]), "road": bp(cells[5])})
    out = {"source": "Archives of Nethys (www.aonprd.com), Pathfinder RPG Ultimate Campaign",
           "urls": {"rules": aon.page_url("Rules.aspx?ID=1489"), "buildings": aon.page_url("Rules.aspx?ID=1544"), "improvements": aon.page_url("Rules.aspx?ID=1525"),
                    "leadership": aon.page_url("Rules.aspx?ID=1494"), "edicts": aon.page_url("Rules.aspx?ID=1518"), "settlements": aon.page_url("Rules.aspx?ID=1539")},
           "buildings": buildings, "improvements": improvements, "terrain": terrain}
    (COMP / "kingdom.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print({k: len(v) for k, v in out.items() if isinstance(v, list)})
    known = {b["name"] for b in buildings}
    print("unknown building names in discounts/upgrades:", sorted({n for b in buildings for n in b["discount"] + b["upgradeFrom"] + b["upgradeTo"]} - known))
    print("kingdom modifier kinds:", sorted({k for b in buildings for k in b["kingdom"]}), "settlement:", sorted({k for b in buildings for k in b["settlement"]}))
    print("no kingdom modifiers:", [b["name"] for b in buildings if not b["kingdom"]])


if __name__ == "__main__":
    main()
