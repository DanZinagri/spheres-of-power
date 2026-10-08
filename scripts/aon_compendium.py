"""Pathfinder 1e reference data from Archives of Nethys (www.aonprd.com, which hosts Paizo's PRD),
for the site's tools: quartz/static/compendium/pf1e/<category>.json.

Only www.aonprd.com is ever fetched (never 2e.aonprd.com, aonsrd.com or 2e.aonsrd.com). Pages
are fetched slowly (DELAY seconds apart) and cached in .cache/aon/, so a run can be stopped and
resumed, and later runs only fetch what isn't cached yet.

  python scripts/aon_compendium.py discover            # index pages only: how many entries each
  python scripts/aon_compendium.py crawl feats spells  # fetch + extract those categories
  python scripts/aon_compendium.py crawl all
  python scripts/aon_compendium.py build               # (re)write the JSON from the cache only

The rules text is Open Game Content (OGL 1.0a); see compendium/pf1e/LICENSE.md. Monster lore
("Ecology" onward) is left out, as it's mostly Paizo setting material (Product Identity).
"""
import hashlib
import json
import re
import sys
import time
import urllib.parse
from pathlib import Path

import requests
from bs4 import BeautifulSoup, NavigableString
from markdownify import markdownify

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache" / "aon"
OUT = ROOT / "quartz" / "static" / "compendium" / "pf1e"
SITE = "https://www.aonprd.com/"
HOST = "www.aonprd.com"
DELAY = 1.2  # seconds between requests to AoN
UA = "Mozilla/5.0 (spheres-of-power wiki compendium; personal use, low request rate)"

# category -> (index pages, detail link pattern). Index entries may be ("from", category, fmt):
# every detail page of that category yields one more index page, e.g. each class's archetypes.
CATEGORIES = {
    "classes": (["Classes.aspx"], r"^ClassDisplay\.aspx\?ItemName="),
    "archetypes": ([("from", "classes", "Archetypes.aspx?Class={name}")], r"^ArchetypeDisplay\.aspx\?"),
    "feats": (["Feats.aspx"], r"^FeatDisplay\.aspx\?ItemName="),
    "traits": ([f"Traits.aspx?Type={t}" for t in (
        "Basic (Combat)", "Basic (Faith)", "Basic (Magic)", "Basic (Social)", "Campaign", "Cosmic",
        "Drawback", "Equipment", "Exemplar", "Faction", "Family", "Mount", "Race", "Region", "Religion")],
        r"^TraitDisplay\.aspx\?ItemName="),
    "races": (["Races.aspx?Category=Core", "Races.aspx?Category=NonCore"], r"^RacesDisplay\.aspx\?ItemName="),
    "spells": (["Spells.aspx?Class=All"], r"^SpellDisplay\.aspx\?ItemName="),
    "equipment": (["EquipmentArmor.aspx", "EquipmentWeapons.aspx", "EquipmentMisc.aspx",
                   ("self", "SpecialMaterials.aspx")],
                  r"^(Equipment\w*Display|Vehicles)\.aspx\?ItemName="),
    "magic-items": ([f"Magic{k}.aspx" for k in ("Armor", "Weapons", "Rings", "Rods", "Staves", "Wondrous",
                                                  "Potions", "Artifacts", "Cursed", "Intelligent", "Other")],
                    r"^Magic\w*Display\.aspx\?"),
    "monsters": (["Monsters.aspx?Letter=All"], r"^MonsterDisplay\.aspx\?ItemName="),
    "templates": (["MonsterTemplates.aspx?ItemName=All"], r"^MonsterTemplates\.aspx\?ItemName=(?!All$)"),
}

session = requests.Session()
session.headers["User-Agent"] = UA
_last = [0.0]


def page_url(path: str) -> str:
    """Absolute URL for a relative AoN link, with its query values properly encoded ("+1" stays "+1")."""
    base, _, query = path.partition("?")
    if query:
        parts = [kv.partition("=") for kv in query.split("&")]
        query = "&".join(k + eq + urllib.parse.quote(urllib.parse.unquote(v), safe="") for k, eq, v in parts)
    return urllib.parse.urljoin(SITE, base.replace(" ", "%20") + ("?" + query if query else ""))


def decode(raw: bytes) -> str:
    """AoN serves some pages as Windows-1252 whatever they declare."""
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("cp1252", errors="replace")


def cache_file(path: str) -> Path:
    return CACHE / (hashlib.sha1(page_url(path).encode()).hexdigest() + ".bin")


def fetch(path: str) -> str:
    """A page of www.aonprd.com (relative path), from the cache when possible."""
    url = page_url(path)
    if urllib.parse.urlsplit(url).hostname != HOST:
        raise ValueError(f"refusing to fetch outside {HOST}: {url}")
    f = cache_file(path)
    if f.exists():
        return decode(f.read_bytes())
    for attempt in range(4):
        wait = DELAY - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        try:
            r = session.get(url, timeout=60)
            if r.status_code == 200:
                CACHE.mkdir(parents=True, exist_ok=True)
                f.write_bytes(r.content)
                return decode(r.content)
            if r.status_code == 404:
                return ""
        except requests.RequestException:
            pass
        time.sleep(10 * (attempt + 1))  # back off on errors
    print(f"  ! gave up on {url}")
    return ""


def links(html: str, pattern: str) -> list[str]:
    seen, out = set(), []
    for m in re.finditer(r'href="([^"#]+)"', html):
        href = m.group(1).lstrip("/").replace("&amp;", "&")
        if re.match(pattern, href) and href not in seen:
            seen.add(href)
            out.append(href)
    return out


def discover(cat: str, cache: dict[str, list[str]]) -> list[str]:
    if cat in cache:
        return cache[cat]
    pages, pattern = CATEGORIES[cat]
    found: list[str] = []
    for page in pages:
        if isinstance(page, tuple) and page[0] == "self":  # a page that is itself the one entry
            found.append(page[1])
        elif isinstance(page, tuple):  # one index page per entry of another category
            _, other, fmt = page
            for href in discover(other, cache):
                name = urllib.parse.unquote(href.split("=", 1)[1])
                found += links(fetch(fmt.format(name=name)), pattern)
        else:
            html = fetch(page)
            found += links(html, pattern)
            # menu pages (armor by category, wondrous items by slot, ...): follow their sub-lists,
            # i.e. links to the same page with a query
            base = re.escape(page.split("?")[0])
            for sub in links(html, rf"^{base}\?\w+=") if "?" not in page else []:
                found += links(fetch(sub), pattern)
    cache[cat] = list(dict.fromkeys(found))
    return cache[cat]


def text_of(el) -> str:
    return re.sub(r"\s+", " ", el.get_text(" ", strip=True)) if el else ""


def extract(cat: str, href: str, html: str) -> dict | None:
    """One entry: name, AoN url, source, labelled fields and the rules text (markdown)."""
    soup = BeautifulSoup(html, "html.parser")
    main = soup.find(id="main") or soup.body
    if not main:
        return None
    titles = main.find_all(["h1", "h2"], class_="title")
    if not titles:
        return None
    # some pages lead with a generic heading ("Monster Templates"): use the one naming the entry
    want = urllib.parse.unquote(href.partition("=")[2]).lower()
    title = next((t for t in titles if want and want in text_of(t).lower()), titles[0])
    for img in main.find_all("img"):
        img.decompose()
    # the entry's own block: from its title to the end of the container holding it
    box = title.parent
    while box is not None and box.name not in ("span", "td", "div") and box is not main:
        box = box.parent
    box = box or main
    for nav in box.find_all(["script", "style"]):
        nav.decompose()
    lore_cut = None
    if cat == "monsters":  # lore and setting text (mostly Product Identity) stays on AoN
        lore_cut = next((h for h in box.find_all(["h3", "h2"]) if text_of(h).lower() in ("ecology", "description")), None)
    name = text_of(title)
    src = box.find("b", string=re.compile(r"^\s*Source\s*$"))
    source = text_of(src.find_next("a")) if src else ""
    fields: dict[str, str] = {}
    for b in box.find_all("b"):
        label = text_of(b).rstrip(":")
        if not label or len(label) > 30 or label in fields:
            continue
        val = []
        for sib in b.next_siblings:
            if getattr(sib, "name", None) in ("b", "br", "h1", "h2", "h3"):
                break
            val.append(sib if isinstance(sib, NavigableString) else sib.get_text(" "))
        v = re.sub(r"\s+", " ", "".join(val)).strip(" :;")
        if v:
            fields[label] = v
    html_box = str(box)
    if lore_cut is not None:  # everything from the Ecology heading on (loose text included) goes
        html_box = html_box[:html_box.find(str(lore_cut))] if str(lore_cut) in html_box else html_box
        fields = {k: v for k, v in fields.items() if k not in ("Environment", "Organization", "Treasure")}
    md = markdownify(html_box, heading_style="ATX", bullets="-", strip=["a"])
    md = re.sub(r"\n{3,}", "\n\n", md).strip()
    return {"name": name, "category": cat, "url": page_url(href), "source": source, "fields": fields, "md": md}


def crawl(cats: list[str], build_only: bool = False) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    disc: dict[str, list[str]] = {}
    index = []
    for cat in cats:
        hrefs = discover(cat, disc)
        print(f"{cat}: {len(hrefs)} entries")
        entries = []
        for n, href in enumerate(hrefs, 1):
            cached = cache_file(href).exists()
            if build_only and not cached:
                continue
            e = extract(cat, href, fetch(href))
            if e:
                entries.append(e)
            if n % 200 == 0:
                print(f"  {cat}: {n}/{len(hrefs)}")
        (OUT / f"{cat}.json").write_text(json.dumps({"category": cat, "source": "Archives of Nethys (www.aonprd.com)",
                                                     "license": "OGL 1.0a - see LICENSE.md", "entries": entries},
                                                    ensure_ascii=False), encoding="utf-8")
        print(f"  wrote {len(entries)} {cat}")
        index += [{"name": e["name"], "category": cat, "source": e["source"], "url": e["url"]} for e in entries]
    old = OUT / "index.json"
    prev = [e for e in json.loads(old.read_text(encoding="utf-8"))] if old.exists() else []
    keep = [e for e in prev if e["category"] not in cats]
    old.write_text(json.dumps(keep + index, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    cmd, *args = sys.argv[1:] or ["discover"]
    cats = list(CATEGORIES) if args in ([], ["all"]) else args
    if cmd == "discover":
        disc: dict[str, list[str]] = {}
        for c in cats:
            print(f"{c}: {len(discover(c, disc))} entries")
    elif cmd == "crawl":
        crawl(cats)
    elif cmd == "build":
        crawl(cats, build_only=True)
