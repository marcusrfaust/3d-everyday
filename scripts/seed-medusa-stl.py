#!/usr/bin/env python3
# Seed: projetos STL/3MF do catalogo D1 -> produtos Medusa (Marcus, 06/11/26).
# /app/products passa a listar o acervo; aquisicao segue via creditos
# (ledger, /api/download) — checkout fiat NUNCA serve p/ STL (guards no frontend).
# Idempotente: handle stl-{item_id}; re-execucao pula o que ja existe.
# Nada e apagado (demos seguem no ar).
#
# Uso:
#   D1_ACCOUNT_ID=... D1_DATABASE_ID=... D1_API_TOKEN=... \
#   MEDUSA_ADMIN_EMAIL=admin@focol.ai MEDUSA_ADMIN_PASSWORD=... \
#   python3 scripts/seed-medusa-stl.py [--limit 24] [--dry-run]
# Env opcional: MEDUSA_URL (default http://127.0.0.1:9000),
#   ACCT_D1_DATABASE_ID (overrides de preco), THUMB_BASE
#   (default https://3de.focol.ai/api/thumb).
import json
import os
import re
import sys
import urllib.request
import urllib.error

MEDUSA_URL = os.environ.get('MEDUSA_URL', 'http://127.0.0.1:9000').rstrip('/')
THUMB_BASE = os.environ.get('THUMB_BASE', 'https://3de.focol.ai/api/thumb')
LIMIT = 24
HARD_CAP = 100
DRY_RUN = False
for i, a in enumerate(sys.argv[1:]):
    if a == '--dry-run':
        DRY_RUN = True
    elif a == '--limit' and i + 2 <= len(sys.argv[1:]):
        LIMIT = max(1, min(HARD_CAP, int(sys.argv[2 + i])))

D1_ACCT = os.environ['D1_ACCOUNT_ID']
D1_DB = os.environ['D1_DATABASE_ID']
D1_TOK = os.environ['D1_API_TOKEN']
ACCT_DB = os.environ.get('ACCT_D1_DATABASE_ID', '')
ADMIN_EMAIL = os.environ['MEDUSA_ADMIN_EMAIL']
ADMIN_PASS = os.environ['MEDUSA_ADMIN_PASSWORD']


def d1(acct, db, sql, params=None):
    req = urllib.request.Request(
        'https://api.cloudflare.com/client/v4/accounts/%s/d1/database/%s/query' % (acct, db),
        data=json.dumps({'sql': sql, 'params': params or []}).encode(),
        headers={'Authorization': 'Bearer ' + D1_TOK, 'Content-Type': 'application/json'})
    r = urllib.request.urlopen(req, timeout=30)
    j = json.load(r)
    if not j.get('success'):
        raise RuntimeError('D1 falhou: ' + json.dumps(j.get('errors'))[:300])
    return j['result'][0]['results']


def clean_title(s):
    t = (s or '').strip()
    t = re.sub(r'(\.(zip|rar|7z|stl|obj|3mf|step|stp))+$', '', t, flags=re.I)
    t = re.sub(r'(3mf|stl|obj|step|stp)?\d{8,}(_\d+)?(_[a-z0-9]{1,5})?$', '', t, flags=re.I)
    t = re.sub(r'[_+.]+', ' ', t)
    t = re.sub(r'\b(3mf|stl|obj|step|stp)\b', '', t, flags=re.I)
    return re.sub(r'\s+', ' ', t).strip()


def display_name(name, file_name):
    t = (name or '').strip()
    bad = (not t or re.match(r'^msg-\d+$', t, re.I)
           or re.match(r'algu[eé]m|bom dia|boa \(tarde|noite\)|@admin|does anyone', t, re.I))
    if not bad:
        return clean_title(t) or 'Peca sem titulo'
    f = clean_title(file_name or '')
    return f or 'Peca sem titulo'


def price_rule(total_bytes):
    mb = 1024 * 1024
    if total_bytes <= 5 * mb:
        return 30
    if total_bytes <= 20 * mb:
        return 50
    if total_bytes <= 100 * mb:
        return 300
    return 600


LP = "local_path IS NOT NULL AND local_path <> ''"
DRV = "drive_url LIKE 'https://drive.google.com/%'"
rows = d1(D1_ACCT, D1_DB,
          "SELECT i.id AS id, i.name AS name, c.slug AS cat, c.name AS catname, "
          "(SELECT f.id FROM files f WHERE f.item_id=i.id AND f.kind='photo' AND ((" + LP + ") OR (" + DRV + ")) ORDER BY f.id DESC LIMIT 1) photoId, "
          "(SELECT f2.file_name FROM files f2 WHERE f2.item_id=i.id AND f2.kind='document' ORDER BY f2.id LIMIT 1) fn, "
          "(SELECT LOWER(GROUP_CONCAT(x.f)) FROM (SELECT f4.file_name AS f FROM files f4 WHERE f4.item_id=i.id AND f4.kind='document' ORDER BY f4.id LIMIT 5) x) fns, "
          "(SELECT COALESCE(SUM(f3.size_bytes),0) FROM files f3 WHERE f3.item_id=i.id AND f3.kind='document') tb "
          "FROM items i LEFT JOIN categories c ON c.id=i.category_id "
          "WHERE i.status IN ('reposted','captured') AND i.is_adult=0 "
          "AND EXISTS (SELECT 1 FROM files d WHERE d.item_id=i.id AND d.kind='document' AND " + DRV + ") "
          "AND EXISTS (SELECT 1 FROM files f WHERE f.item_id=i.id AND f.kind='photo' AND ((" + LP + ") OR (" + DRV + "))) "
          "ORDER BY i.created_at DESC LIMIT %d" % HARD_CAP)

overs = {}
ids = [int(r['id']) for r in rows]
if ACCT_DB and ids:
    ph = ','.join('?' * len(ids))
    for r in d1(D1_ACCT, ACCT_DB,
                'SELECT item_id, price FROM item_prices WHERE item_id IN (%s)' % ph, ids):
        overs[int(r['item_id'])] = int(r['price'])

items = []
for r in rows:
    nm = display_name(r['name'], r['fn'])
    if not nm or len(nm) < 4 or nm == 'Peca sem titulo':
        continue
    tb = int(r['tb'] or 0)
    fns = (r['fns'] or '')
    fmt = 'STL+3MF' if ('3mf' in fns and 'stl' in fns) else ('3MF' if '3mf' in fns else ('STL' if 'stl' in fns else 'ZIP/RAR'))
    items.append({
        'id': int(r['id']), 'name': nm[:120],
        'category': (r['catname'] or r['cat'] or '-'),
        'photoId': int(r['photoId']), 'credits': overs.get(int(r['id']), price_rule(tb)),
        'fmt': fmt, 'bytes': tb,
    })
    if len(items) >= LIMIT:
        break

print('candidatos: %d (limite %d)' % (len(items), LIMIT))
if DRY_RUN:
    for it in items:
        print('  stl-%d | %s | %d cred | photo %d | %s' % (it['id'], it['name'][:50], it['credits'], it['photoId'], it['fmt']))
    sys.exit(0)


def med(path, method='GET', body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(MEDUSA_URL + path, data=data, method=method, headers=headers)
    try:
        r = urllib.request.urlopen(req, timeout=30)
        return r.status, json.load(r) if r.status != 204 else {}
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:1000]


# Auditoria N2/N3 r2: variante STL JAMAIS tem price (invariante anti-bypass).
# Varre stl-* existentes; com prices -> tenta zerar via Admin, senao falha alto.
def audit_stl(TOK):
    bad = []
    seen, offset = 0, 0
    for _ in range(10):
        st, d = med('/admin/products?limit=100&offset=%d&fields=id,handle,*variants.prices' % offset, token=TOK)
        if st != 200: break
        prods = d.get('products', [])
        if not prods: break
        for p in prods:
            if not str(p.get('handle', '')).startswith('stl-'): continue
            seen += 1
            for v in p.get('variants', []):
                if v.get('prices'):
                    vst, _ = med('/admin/products/%s/variants/%s' % (p['id'], v['id']), 'POST',
                                 {'prices': []}, TOK)
                    if vst not in (200, 201): bad.append('%s/%s' % (p['handle'], v['id']))
        if len(prods) < 100: break
        offset += 100
    print('auditoria STL: %d produtos stl-*, %d com price remanescente' % (seen, len(bad)))
    if bad:
        print('FALHA: variantes STL com price fiat: %s' % bad[:5])
        sys.exit(2)

st, d = med('/auth/user/emailpass', 'POST', {'email': ADMIN_EMAIL, 'password': ADMIN_PASS})
if st != 200 or not d.get('token'):
    sys.exit('auth Medusa falhou: HTTP %s' % st)
TOK = d['token']
audit_stl(TOK)

st, d = med('/admin/sales-channels?limit=5', token=TOK)
sc = (d.get('sales_channels') or [{}])[0].get('id')
if not sc:
    sys.exit('sem sales channel no Medusa')
print('sales channel: %s' % sc)

created, skipped, failed = 0, 0, []
for it in items:
    handle = 'stl-%d' % it['id']
    st, d = med('/admin/products?handle=%s&fields=id' % handle, token=TOK)
    if st == 200 and (d.get('products') or []):
        skipped += 1
        continue
    thumb = '%s/%d' % (THUMB_BASE, it['photoId'])
    desc = ('Projeto do acervo 3d-Everyday.\n'
            'PRECO OFICIAL: %d creditos (aquisicao via carteira de creditos, nao via checkout).\n'
            'Peca #%d | Categoria: %s | Arquivos: %s') % (it['credits'], it['id'], it['category'], it['fmt'])
    body = {
        'title': it['name'], 'handle': handle, 'description': desc,
        'status': 'published', 'thumbnail': thumb, 'images': [{'url': thumb}],
        'metadata': {'kind': 'stl', 'item_id': it['id'], 'credits_price': it['credits'],
                     'photo_id': it['photoId'], 'category': it['category'], 'source': '3dlib-catalog'},
        'sales_channels': [{'id': sc}],
        'options': [{'title': 'Formato', 'values': ['Digital']}],
        # SEM prices de proposito: variante sem preco fiat nao entra em cart
        # nem completa checkout (controle no backend, nao so no frontend).
        'variants': [{'title': 'Padrao', 'sku': 'STL-%d' % it['id'],
                      'options': {'Formato': 'Digital'}}],
    }
    st, d = med('/admin/products', 'POST', body, TOK)
    if st in (200, 201):
        created += 1
        print('  + %s | %s | %d cred' % (handle, it['name'][:45], it['credits']))
    else:
        failed.append(handle)
        print('  ! %s HTTP %s %s' % (handle, st, str(d)[:200]))

print('seed STL: criados=%d pulados=%d falhas=%s' % (created, skipped, failed))
sys.exit(1 if failed else 0)
