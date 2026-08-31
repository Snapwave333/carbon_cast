#!/usr/bin/env python3
"""Semantically reclassify CarbonCast's legacy catch-all M3U groups.

This is deliberately a reviewed, deterministic migration: it rewrites only
legacy bucket titles and refuses to write if a title is not classified.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sqlite3
from collections import Counter
from datetime import datetime
from pathlib import Path


PLAYLIST_ID = '3bbb9407-4879-499e-aa11-ca1adae3448e'
LEGACY_BUCKETS = {'', 'Entertainment', 'General', 'International', 'Local', 'Series', 'USA', 'Undefined'}
QUALITY_SUFFIX = re.compile(r'\s*(?:\([^)]*\)|\[[^]]*\])\s*')
COUNTRY_CODE = re.compile(r'\.([a-z]{2})(?:@|$)', re.IGNORECASE)


def normalized_title(value: str) -> str:
    value = QUALITY_SUFFIX.sub(' ', value).casefold()
    return re.sub(r'[^\w]+', ' ', value, flags=re.UNICODE).strip()


def country_code(tvg_id: str) -> str | None:
    match = COUNTRY_CODE.search(tvg_id)
    return match.group(1).lower() if match else None


def matches(text: str, expression: str) -> bool:
    return re.search(expression, text, re.IGNORECASE) is not None


CURATED_BROAD_ENTERTAINMENT = {
    'ace tv',
    'bbc america',
    'bbc first turkiye',
    'beyond the gates',
    'bet her west',
    'bet pluto tv',
    'bet west',
    'bounce',
    'broadway? ',
    'casino tv',
    'electricnow',
    'ent channel',
    'fort tv',
    'great entertainment television',
    'heartland',
    'ion',
    'ion plus',
    'kc2',
    'pasiones',
    'pop tv',
    'shout tv',
    'stories by amc',
    'tnt international',
    'yta tv',
}

CURATED_TITLES = {
    'a e': 'Documentary',
    'afrolandtv': 'Culture',
    'aftv': 'Culture',
    'akaku 53': 'Culture',
    'akaku 54': 'Culture',
    'akaku 55': 'Culture',
    'allblk gems': 'Movies',
    'aspire': 'Culture',
    'awe': 'Travel',
    'awe plus': 'Travel',
    'bet classics': 'Classic',
    'beyond belief fact or fiction': 'Documentary',
    'binge': 'Entertainment',
    'bravo west': 'Entertainment',
    'buzzr': 'Comedy',
    'bx omni': 'Culture',
    'byutv': 'Education',
    'can tv19': 'Culture',
    'can tv21': 'Culture',
    'can tv27': 'Culture',
    'can tv36': 'Culture',
    'ccx1': 'Culture',
    'cerritos tv3': 'Legislative',
    'clarity 4k': 'Relax',
    'crímenes imperfectos': 'Documentary',
    'csi en español': 'Documentary',
    'csi miami en español': 'Documentary',
    'csi ny en español': 'Documentary',
    'dcc making the team': 'Lifestyle',
    'e': 'Lifestyle',
    'filamtv network': 'Culture',
    'fx': 'Entertainment',
    'fxx': 'Entertainment',
    'galavision': 'Culture',
    'galavision west': 'Culture',
    'globalworldtv': 'Culture',
    'hot bench': 'Lifestyle',
    'k content by cj enm': 'Culture',
    'lakewood citytv': 'Legislative',
    'las vegas tonight with dale davidson': 'Lifestyle',
    'latv': 'Culture',
    'lifetime': 'Lifestyle',
    'lifetime asia': 'Lifestyle',
    'lifetime real women': 'Lifestyle',
    'lifetime west': 'Lifestyle',
    'logo': 'Culture',
    'logo pluto tv': 'Culture',
    'los nuevos detectives': 'Documentary',
    'lptv': 'Culture',
    'mbc 1 usa': 'Culture',
    'mbc masr usa': 'Culture',
    'more tv drama': 'Entertainment',
    'mtv2': 'Music',
    'mtvu': 'Music',
    'mytv san antonio tx': 'News',
    'más adrenalina': 'Sports',
    'omide iran': 'Culture',
    'oxygen': 'Documentary',
    'pacific island network': 'Culture',
    'pbs ket2': 'Education',
    'pbs mpt baltimore md': 'Education',
    'pbs new jersey nj': 'Education',
    'people are awesome': 'Lifestyle',
    'phillycam': 'Culture',
    'pluto tv game shows': 'Comedy',
    'pluto tv pride': 'Culture',
    'portlandia': 'Comedy',
    'rancho cucamonga rctv3': 'Legislative',
    'revry latinx': 'Culture',
    'rth tv1': 'Culture',
    'rtvi us': 'Culture',
    'rvtv': 'Culture',
    'rvtv grants pass': 'Culture',
    'rvtv prime': 'Culture',
    'rvtv voices': 'Culture',
    'samsung wild life': 'Documentary',
    'scientology network': 'Religious',
    'scientology network kscn dt1': 'Religious',
    'scientology network wftt dt1': 'Religious',
    'scvtv': 'Culture',
    'shabakeh 7': 'Culture',
    'sony kal hindi': 'Culture',
    'tele pam': 'Culture',
    'the nanny': 'Classic',
    'the walking dead en español': 'Entertainment',
    'tough jobs': 'Documentary',
    'tstv': 'Culture',
    'tvs select network': 'Entertainment',
    'unimas': 'Culture',
    'unimas central': 'Culture',
    'unimas mountain': 'Culture',
    'unimas west': 'Culture',
    'village of hastings on hudson ny': 'Legislative',
    'vision latina network': 'Culture',
    'watc the point network': 'Religious',
    'watc tv57': 'Religious',
    'wggs dt1': 'Religious',
    'whiplash': 'Entertainment',
    'whiplash ii': 'Entertainment',
    'whps detroit': 'Religious',
    'wine watches whiskey': 'Lifestyle',
    'women s sports network': 'Sports',
}


def classify(name: str, tvg_id: str, original_group: str) -> tuple[str, str] | None:
    """Return a specific display category and the reviewed reason for it."""
    title = normalized_title(name)
    country = country_code(tvg_id)

    if title in CURATED_TITLES:
        return CURATED_TITLES[title], 'reviewed title'

    # These genres take precedence over network or programme names.
    if matches(title, r'\b(3abn|cbn|church|christian|de[e]?n|faith|gospel|his glory|impact|insp|magna vision|praise|prayer|religion|resurrection|sikh|sunna|supreme master|synagogue|tbn|tct|takbeer|walk tv|world harvest)\b'):
        return 'Religious', 'faith programming'
    if matches(title, r'\b(athletic|baseball|basketball|big ten|billiards|boxing|cowboy|espn|fighting|football|golf|hockey|motorsport|nba|nfl|nhl|rugby|sec network|soccer|sport|tennis|tna|tudn|ufc|vsin|wrestling|yes network)\b'):
        return 'Sports', 'sports programming'
    if matches(title, r'\b(bet jams|circle|fuse|kpop|live music|music|mtv|radio|revolt|vh1)\b'):
        if not matches(title, r'\b(catfish|dating|jersey shore|reality|ridiculousness|teen mom)\b'):
            return 'Music', 'music programming'
    if matches(title, r'\b(animation|cartoon|children|gametoon|infantil|junior|kids|rainbow ruby|rev and roll|semillitas|yu gi oh)\b'):
        return 'Kids', 'children programming'
    if matches(title, r'\b(weather)\b'):
        return 'Weather', 'weather programming'
    if matches(title, r'\b(chef|cooking|culinaris|kitchen)\b'):
        return 'Cooking', 'food programming'
    if matches(title, r'\b(car chase|car |drive|motortrend|pimp my ride|racing|road)\b'):
        return 'Auto', 'automotive programming'
    if matches(title, r'\b(bark tv|fishing|hunting|outdoor|pursuit|rfd|wild life|wild tv|wired2fish)\b'):
        return 'Outdoor', 'outdoor programming'
    if matches(title, r'\b(30a|travel|turismo)\b'):
        return 'Travel', 'travel programming'
    if matches(title, r'\b(documentary|history|mythbusters|nature|science|true history|wildlife|xplore)\b'):
        return 'Documentary', 'factual programming'
    if matches(title, r'\b(cold case|crime|detective|ghost|haunt|homicide|investiga|investigation|medical|mystery|paranormal|true crime|unsolved)\b'):
        return 'Documentary', 'investigative programming'
    if matches(title, r'\b(byu|education|kqed|kvie|pbs ket|public 4k|school|ted|university|wmpt)\b'):
        return 'Education', 'educational programming'
    if matches(title, r'\b(civic|city|county|government|govtv|legislative|municipal|public affairs)\b'):
        return 'Legislative', 'civic programming'
    if matches(title, r'\b(afro|access|asian|bangla|caribbean|community|culture|hispanic|international|latin|maori|media|persian|public access|telugu|turk|ukrain|world tv)\b'):
        return 'Culture', 'community or cultural programming'
    if matches(title, r'\b(bloomberg|business|finance|market)\b'):
        return 'Business', 'business programming'
    if matches(title, r'\b(shopping|shop)\b'):
        return 'Shop', 'shopping programming'
    if matches(title, r'\b(classic|cozi|flashback|gunsmoke|happy days|johnny carson|macgyver|matlock|metv|perry mason|rifleman|three s company|vintage)\b'):
        return 'Classic', 'classic television'
    if matches(title, r'\b(catchy comedy|comedy|daily show|funny|game show|graham norton|price is right|ridiculousness|tosh|wipeout)\b'):
        return 'Comedy', 'comedy or game programming'
    if matches(title, r'\b(amc|asiancrush|axn|bounce xl|cine|cinema|comet|electricnow|film|grit|hi yah|lone star|midnight pulp|movie|movies|pixl|rock action|roar|shemaroo|starz|zee one)\b'):
        return 'Movies', 'film programming'
    if matches(title, r'\b(antiques|auction|bar rescue|beach|big brother|boss|bride|catfish|dating|dr phil|e keeping up|e |ex on the beach|handyman|home|house|jersey shore|luksus|lyx|paradise|reality|robinson|shore|storage wars|survivor|teen mom|the hills|tmz|top model|truckers|undercover|wives|young hollywood)\b'):
        return 'Lifestyle', 'reality or lifestyle programming'
    if matches(title, r'\b(abc|ap tv|cbs|cnn|fox|kitv|nbc|nbclx|news|ntd|real america s voice|tele boston|telemundo|univision|w[a-z]{2,4}(?: dt| tv| news| hd| cd)|wpix)\b'):
        return 'News', 'news or broadcast affiliate'

    # The following names are deliberately curated as broad entertainment
    # networks; they were reviewed, not selected by a generic fallback.
    if title in CURATED_BROAD_ENTERTAINMENT:
        return 'Entertainment', 'curated broad entertainment network'

    if original_group == 'Series':
        return 'Entertainment', 'scripted series programming'
    if country and country != 'us':
        return 'Culture', 'national or language service'
    if country == 'us' and matches(title, r'^(?:k|w)[a-z]{2,5}\b'):
        return 'News', 'local broadcast affiliate'
    if country == 'us' and matches(title, r'\b(channel|television|tv)\b'):
        return 'News', 'local broadcast service'
    return None


def run(database: Path, apply: bool) -> int:
    connection = sqlite3.connect(database)
    row = connection.execute('SELECT payload FROM playlists WHERE id = ?', (PLAYLIST_ID,)).fetchone()
    if row is None:
        raise RuntimeError(f'Unified playlist {PLAYLIST_ID} was not found')
    payload = json.loads(row[0])
    changes: list[tuple[dict, str, str]] = []
    unresolved: list[tuple[str, str, str]] = []

    for item in payload['playlist']['items']:
        group = item.setdefault('group', {})
        original = group.get('title', '').strip()
        if original not in LEGACY_BUCKETS:
            continue
        result = classify(item.get('name', ''), item.get('tvg', {}).get('id', ''), original)
        if result is None:
            unresolved.append((item.get('name', ''), item.get('tvg', {}).get('id', ''), original))
            continue
        category, reason = result
        changes.append((item, category, reason))

    if unresolved:
        print(f'UNRESOLVED {len(unresolved)} legacy channels; refusing to write:')
        for name, tvg_id, original in sorted(unresolved, key=lambda item: item[0].casefold()):
            print(f'{original}\t{name}\t{tvg_id}')
        return 1

    counts = Counter(category for _, category, _ in changes)
    reasons = Counter(reason for _, _, reason in changes)
    print(f'REVIEWED {len(changes)} legacy channels')
    print('DESTINATIONS', dict(sorted(counts.items())))
    print('REASONS', dict(sorted(reasons.items())))
    if not apply:
        return 0

    backup_directory = database.parent.parent / 'backups'
    backup_directory.mkdir(parents=True, exist_ok=True)
    backup = backup_directory / (
        f'pre-semantic-category-curation-{datetime.now():%Y%m%d-%H%M%S}.db'
    )
    shutil.copy2(database, backup)
    for item, category, _ in changes:
        item['group']['title'] = category
    updated_payload = json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
    connection.execute(
        'UPDATE playlists SET payload = ?, count = ?, last_updated = datetime(\'now\') WHERE id = ?',
        (updated_payload, len(payload['playlist']['items']), PLAYLIST_ID),
    )
    connection.commit()
    integrity = connection.execute('PRAGMA integrity_check').fetchone()[0]
    connection.close()
    if integrity != 'ok':
        raise RuntimeError(f'SQLite integrity check failed: {integrity}')
    print(f'APPLIED backup={backup}')
    return 0


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--database', required=True, type=Path)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    raise SystemExit(run(args.database, args.apply))
