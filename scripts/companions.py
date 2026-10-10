"""Animal companions and familiars from Archives of Nethys (www.aonprd.com only, through
aon_compendium's cached, rate-limited fetch), for the Animal Companion and Familiar builders.
Statistics only (no descriptions):

    python scripts/companions.py     # writes compendium/companions.json and compendium/familiars.json

companions.json: every druid animal companion (animal, monstrous, plant, vermin) with its starting
statistics and its 4th/7th-level advancement. familiars.json: the wizard familiar list (what the
master gains, the monster it uses) and the Improved Familiar list (alignment, caster level).
"""
from __future__ import annotations

import html as htmllib
import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote

import aon_compendium as aon

COMP = Path(__file__).resolve().parent.parent / "quartz" / "static" / "compendium"
CATEGORIES = ["Animal", "Monstrous", "Plant", "Vermin"]
ABILITIES = ["str", "dex", "con", "int", "wis", "cha"]
DASH = "—–−-"


def text(fragment: str) -> str:
    t = re.sub(r"<br\s*/?>", "\n", fragment)
    t = htmllib.unescape(re.sub(r"<[^>]+>", "", t)).replace("\xa0", " ").replace("’", "'")
    return re.sub(r"[ \t]+", " ", t).strip()


def split_top(s: str, sep: str = ",") -> list[str]:
    """Split on sep outside parentheses."""
    out, depth, cur = [], 0, ""
    for ch in s:
        depth += ch == "("
        depth -= ch == ")"
        if ch == sep and depth == 0:
            out.append(cur.strip())
            cur = ""
        else:
            cur += ch
    return [p for p in out + [cur.strip()] if p]


def parse_attacks(s: str) -> list[dict]:
    """'bite (1d6 plus grab), 2 claws (1d4)' -> [{name, count, damage, extra}]."""
    out = []
    for part in split_top(re.sub(r"\s+or\s+", ", ", s)):
        m = re.match(r"(?:(\d+)\s+)?([^()]+?)\s*(?:\(([^)]*)\))?\s*$", part)
        if not m:
            continue
        inner = m.group(3) or ""
        dm = re.match(r"\s*(\d+d\d+(?:\s*[+-]\s*\d+)?)\s*(?:plus\s+(.*)|,\s*(.*))?$", inner)
        name = m.group(2).strip().rstrip("s") if m.group(1) and int(m.group(1)) > 1 else m.group(2).strip()
        out.append({"name": name, "count": int(m.group(1) or 1), "damage": dm.group(1).replace(" ", "") if dm else "",
                    "extra": ((dm.group(2) or dm.group(3) or "") if dm else inner).strip()})
    return out


def parse_abilities(s: str) -> dict[str, int]:
    out = {}
    for k, v in re.findall(rf"\b(Str|Dex|Con|Int|Wis|Cha)\s*([+{DASH}]?\s*\d+|[{DASH}])", s):
        v = v.replace(" ", "")
        if v in DASH:
            continue
        out[k.lower()] = -int(v[1:]) if v[0] in DASH else int(v.lstrip("+"))
    return out


def parse_speeds(s: str) -> dict[str, int]:
    """'40 ft., climb 20 ft., fly 60 ft. (average)' -> {land: 40, climb: 20, fly: 60}."""
    out = {}
    for part in split_top(s):
        m = re.match(r"(?:(burrow|climb|fly|swim)\s+)?(\d+)\s*ft", part.strip(), re.I)
        if m:
            out[(m.group(1) or "land").lower()] = int(m.group(2))
    return out


def parse_block(s: str) -> dict:
    """One 'Size Medium; Speed 40 ft.; AC +2 natural armor; ...' block -> fields."""
    fields = {}
    for part in split_top(s.strip().rstrip("."), ";"):
        m = re.match(r"(Size|Speed|AC|Attacks?|Ability Scores|Special Qualities|Special Attacks|"
                     r"Special Abilities|Bonus Feats?|CMD|Languages|SQ)\s*:?\s*(.*)$", part, re.S)
        if m:
            fields[m.group(1)] = m.group(2).strip()
    out: dict = {}
    if "Size" in fields:
        out["size"] = fields["Size"].split()[0]
    if "Speed" in fields:
        out["speeds"] = parse_speeds(fields["Speed"])
        out["speedText"] = fields["Speed"]
    if "AC" in fields:
        out["natural"] = int(m.group(1).replace(" ", "")) if (m := re.search(r"([+-]\s*\d+)\s*natural", fields["AC"])) else 0
        if not re.fullmatch(r"\s*[+-]\s*\d+\s*natural armor\s*", fields["AC"]):
            out["acText"] = fields["AC"]
    atk = fields.get("Attack") or fields.get("Attacks")
    if atk:
        out["attacks"] = parse_attacks(atk)
        out["attackText"] = atk
    if "Ability Scores" in fields:
        out["abilities"] = parse_abilities(fields["Ability Scores"])
    for label, key in (("Special Qualities", "sq"), ("SQ", "sq"), ("Special Attacks", "sa"), ("Special Abilities", "sa"),
                       ("Bonus Feat", "feats"), ("Bonus Feats", "feats"), ("CMD", "cmd")):
        if label in fields:
            out[key] = out.get(key, []) + split_top(fields[label])
    return out


def companions() -> list[dict]:
    names: dict[str, str] = {}
    for cat in CATEGORIES:
        listing = aon.fetch(f"DruidCompanions.aspx?ItemName=All&Category={cat}")
        for href in re.findall(r'<h2 class="title"><a href="DruidCompanions\.aspx\?ItemName=([^"]+)"', listing):
            names.setdefault(htmllib.unescape(unquote(href)), cat)
    out = []
    for n, (name, cat) in enumerate(sorted(names.items())):
        page = aon.fetch("DruidCompanions.aspx?ItemName=" + name)
        start = page.find('<h1 class="title"')
        end = page.find("</span>", start)
        if start < 0:
            print(f"warning: companions: no entry on the page for {name}")
            continue
        seg = page[start:end]
        entry = {"id": "companion/" + re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-"), "name": name, "type": cat,
                 "source": text(m.group(1)) if (m := re.search(r"<b>Source</b>\s*(.*?)<br", seg, re.S)) else "",
                 "monster": htmllib.unescape(unquote(m.group(1))) if (m := re.search(r'MonsterDisplay\.aspx\?ItemName=([^"]+)"', seg)) else "",
                 "url": aon.page_url("DruidCompanions.aspx?ItemName=" + name)}
        if (m := re.search(r"<b>Companion Type</b>\s*([^<]+)", seg)):
            entry["type"] = m.group(1).strip()
        blocks = re.split(r"<b>((?:Starting Statistics|\d+(?:st|nd|rd|th)-Level Advancement)[^<]*)</b>\s*:?", seg)
        for label, body in zip(blocks[1::2], blocks[2::2]):
            body = re.split(r"<br\s*/?>\s*<br\s*/?>", body)[0]
            parsed = parse_block(text(body))
            if label.startswith("Starting"):
                entry["start"] = parsed
            else:
                parsed["level"] = int(re.match(r"\d+", label).group())
                entry.setdefault("advances", []).append(parsed)
        if "start" not in entry:
            print(f"warning: companions: no starting statistics for {name}")
            continue
        out.append(entry)
        if n % 40 == 0:
            print(f"  companions {n}/{len(names)}", file=sys.stderr)
    return out


def familiars() -> dict:
    page = aon.fetch("WizardFamiliars.aspx")

    def rows(table_id: str) -> list[list[str]]:
        m = re.search(rf'<table[^>]*id="{table_id}".*?</table>', page, re.S)
        return [re.findall(r"<td[^>]*>(.*?)</td>", r, re.S) for r in re.findall(r"<tr[^>]*>(.*?)</tr>", m.group(0), re.S)] if m else []

    def monster(cell: str) -> str:
        m = re.search(r'MonsterDisplay\.aspx\?ItemName=([^"]+)"', cell)
        return htmllib.unescape(unquote(m.group(1))) if m else ""

    regular, improved = [], []
    for cells in rows("MainContent_GridViewBloodlines"):
        if len(cells) >= 3:
            regular.append({"name": text(cells[0]), "monster": monster(cells[0]), "special": text(cells[1]),
                            "source": text(cells[2])})
    for cells in rows("MainContent_GridView1"):
        if len(cells) >= 4:
            improved.append({"name": text(cells[0]), "monster": monster(cells[0]), "alignment": text(cells[1]),
                             "level": int(m.group()) if (m := re.search(r"\d+", text(cells[2]))) else 0,
                             "levelText": text(cells[2]), "source": text(cells[3])})
    # the Monster Creator's parsed monster for each (monsters.py), matched by its AoN item name
    by_item: dict[str, tuple[str, str]] = {}
    for f in sorted((COMP / "monsters").glob("m*.json")):
        for mon in json.loads(f.read_text(encoding="utf-8"))["entries"]:
            if (m := re.search(r"ItemName=(.+)$", mon.get("url", ""))):
                by_item.setdefault(unquote(m.group(1)).lower(), (mon["id"], f"monsters/{f.name}"))
    missing = []
    for fam in regular + improved:
        hit = by_item.get(fam["monster"].lower())
        if hit:
            fam["monsterId"], fam["file"] = hit
        else:
            missing.append(fam["name"])
    if missing:
        print(f"familiars without a monster entry ({len(missing)}): {', '.join(missing)}")
    return {"familiars": regular, "improved": improved}


def main() -> None:
    comp = companions()
    (COMP / "companions.json").write_text(json.dumps(
        {"source": "Archives of Nethys (www.aonprd.com)", "entries": comp}, ensure_ascii=False, indent=1), encoding="utf-8")
    fam = familiars()
    (COMP / "familiars.json").write_text(json.dumps(
        {"source": "Archives of Nethys (www.aonprd.com)", **fam}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Companions: {len(comp)}; familiars: {len(fam['familiars'])}; improved familiars: {len(fam['improved'])}")


if __name__ == "__main__":
    main()
