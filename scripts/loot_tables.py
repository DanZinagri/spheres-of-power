"""Treasure tables from Archives of Nethys (www.aonprd.com only, through aon_compendium's cached,
rate-limited fetch) for the Loot Generator. Numbers and item names only:

    python scripts/loot_tables.py     # writes compendium/loot-tables.json

Core Rulebook: Table 12-5 (treasure per encounter), Table 15-2 (random magic item kinds), the magic
armor and weapon bonus tables, the potion / scroll / wand spell level tables, common item curses,
and the gem grades and nonmagical treasure values from Building a Treasure Hoard.
"""
from __future__ import annotations

import html as htmllib
import json
import re
from pathlib import Path

import aon_compendium as aon

COMP = Path(__file__).resolve().parent.parent / "quartz" / "static" / "compendium"
DASH = "—–−-"


def clean(fragment: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", htmllib.unescape(fragment))).replace("\xa0", " ").strip()


def tables(path: str) -> list[tuple[str, list[list[str]]]]:
    """Every table on a rules page as (the text just before it, rows of cells)."""
    page = aon.fetch(path)
    main = page[page.find('id="main"'):]
    out = []
    for m in re.finditer(r"<table.*?</table>", main, re.S):
        rows = [[clean(c) for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", r, re.S)]
                for r in re.findall(r"<tr[^>]*>(.*?)</tr>", m.group(0), re.S)]
        out.append((clean(main[max(0, m.start() - 300):m.start()])[-80:], [r for r in rows if r]))
    return out


def find(tabs, title: str) -> list[list[str]]:
    return next((rows for pre, rows in tabs if pre.endswith(title)), [])


def gp(text: str) -> float:
    m = re.search(r"[\d,]+(?:\.\d+)?", text or "")
    return float(m.group().replace(",", "")) if m else 0.0


def span(text: str) -> list[int] | None:
    """'01-04' / '45' / a dash -> [1, 4] / [45, 45] / None."""
    nums = [int(n) for n in re.findall(r"\d+", text or "")]
    return [nums[0], nums[-1]] if nums else None


def graded(rows: list[list[str]], *names: str) -> list[dict]:
    """Rows of 'Minor | Medium | Major | <name columns>' -> dicts with the three d% ranges."""
    out = []
    for r in rows[1:]:
        if len(r) < 3 + len(names):
            continue
        out.append({"minor": span(r[0]), "medium": span(r[1]), "major": span(r[2]), **{n: r[3 + i] for i, n in enumerate(names)}})
    return out


def main() -> None:
    gm = tables("Rules.aspx?ID=254")
    per = [{"level": int(r[0]), "slow": gp(r[1]), "medium": gp(r[2]), "fast": gp(r[3])}
           for r in find(gm, "Table 12-5: Treasure Values per Encounter") if len(r) == 4 and r[0].isdigit()]
    mi = tables("Rules.aspx?ID=365")
    kinds = graded(find(mi, "Table 15-2: Random Magic Item Generation"), "item")
    armor = [{**r, "price": gp(r["price"])} for r in graded(find(mi, "Table 15-3: Armor and Shields"), "item", "price")]
    weapons = [{**r, "price": gp(r["price"])} for r in graded(find(mi, "Table 15-8: Weapons"), "item", "price")]
    spell_rows = lambda title: [{**r, "level": int(re.search(r"\d+", r["level"]).group()), "cl": int(re.search(r"\d+", r["cl"]).group())}
                                for r in graded(find(mi, title), "level", "cl")]
    curses = [{"range": span(r[0]), "curse": r[1]} for r in find(mi, "Table 15-27: Common Item Curses")[1:] if len(r) >= 2]

    hoard = aon.fetch("Rules.aspx?ID=255")
    text = clean(hoard[hoard.find('id="main"'):]).replace("’", "'")
    gems = []
    grade = r"(?:[A-Z][A-Za-z-]+ )*(?:Gems|Gemstones|Jewels)"
    for m in re.finditer(rf"({grade}) \(([\d,]+) gp(?: or more)?\) : (.+?)(?= {grade} \(|\s+Nonmagical Treasures)", text):
        gems.append({"grade": m.group(1).strip(), "value": gp(m.group(2)), "stones": [s.strip() for s in m.group(3).split(";") if s.strip()]})
    valuables = []
    tail = text[text.find("Nonmagical Treasures"):]
    for m in re.finditer(rf"([A-Z][A-Za-z, ]{{3,40}}?) \(([\d,]+)(?:[?{DASH}]([\d,]+))? gp( or more)?\) :", tail):
        name = m.group(1).strip()
        if name.split()[0] in ("Nonmagical",):
            continue
        lo = gp(m.group(2))
        valuables.append({"name": name, "min": lo, "max": gp(m.group(3)) if m.group(3) else (lo * 10 if m.group(4) else lo)})

    out = {"source": "Archives of Nethys (www.aonprd.com), Pathfinder RPG Core Rulebook",
           "perEncounter": per, "kinds": kinds, "armor": armor, "weapons": weapons,
           "potions": spell_rows("Table 15-12: Potions"), "scrolls": spell_rows("Table 15-15: Scrolls"),
           "wands": spell_rows("Table 15-17: Wands"), "curses": curses, "gems": gems, "valuables": valuables}
    (COMP / "loot-tables.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print({k: (len(v) if isinstance(v, list) else v) for k, v in out.items() if k != "source"})
    print("gems:", [(g["grade"], g["value"], len(g["stones"])) for g in gems])
    print("valuables:", [(v["name"], v["min"], v["max"]) for v in valuables])


if __name__ == "__main__":
    main()
