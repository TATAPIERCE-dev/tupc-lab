"""python -m scraper.collect: HTML → normalización → SQLite → JSON estático.

Catálogo acotado: primera página por categoría, muestra base por tienda y
selección ampliada de CPU y placas con stock y plataforma documentada.
No es un índice exhaustivo del mercado ni una API de SoloTodo.
"""
import argparse
import hashlib
import json
import logging
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

from bs4 import BeautifulSoup
from scraper.database import connect, initialize, record

ROOT = Path(__file__).resolve().parents[1]
AGENT = 'TuPC.LABPortfolio/1.0'
CATEGORIES = {
    'cpu': ('Procesadores', ['28-amd', '29-intel']),
    'motherboard': ('Placas madre', ['31-para-amd', '79-para-intel']),
    'ram': ('Memoria RAM', ['37-ddr4', '117-ddr5']),
    'ssd': ('Almacenamiento', ['34-ssd']),
    'gpu': ('Tarjetas gráficas', ['63-amd', '64-nvidia']),
    'psu': ('Fuentes de poder', ['80-potencia-realcertificadas']),
    'case': ('Gabinetes', ['81-sin-fuente-de-poder']),
    'cooler': ('Refrigeración', ['93-cpu-cooler']),
}


class Client:
    def __init__(self):
        self.robots = {}
        self.last = {}

    def raw(self, url):
        request = urllib.request.Request(url, headers={'User-Agent': AGENT})
        with urllib.request.urlopen(request, timeout=25) as response:
            return response.read().decode('utf-8')

    def get(self, url):
        origin = 'https://' + urlparse(url).netloc
        if origin not in self.robots:
            # Fallo cerrado: no continuar si no se pueden consultar las reglas.
            parser = RobotFileParser()
            parser.parse(self.raw(origin + '/robots.txt').splitlines())
            self.robots[origin] = parser
        parser = self.robots[origin]
        if not parser.can_fetch(AGENT, url):
            raise ValueError('Ruta excluida por robots.txt: ' + url)
        delay = max(2, parser.crawl_delay(AGENT) or 0)
        time.sleep(max(0, delay - (time.monotonic() - self.last.get(origin, 0))))
        self.last[origin] = time.monotonic()
        # Sin reintentos ante 403, 429 o CAPTCHA. No se evaden bloqueos.
        return self.raw(url)


def clp(value):
    digits = re.sub(r'[^0-9]', '', value)
    number = int(digits) if digits else 0
    if not 0 < number < 20_000_000:
        raise ValueError('Precio inválido: ' + value)
    return number


def identity(url):
    return hashlib.sha256(url.encode()).hexdigest()[:16]


def specs(name, description, category):
    text = (name + ' ' + description).upper()
    result = {}
    if category in ('cpu', 'motherboard'):
        socket = re.search(r'\b(AM[45]|(?:LGA\s*)?(?:1100|1200|1700|1800|1851))\b', text)
        if socket:
            result['socket'] = socket[1].replace('LGA', '').replace(' ', '')
    if category in ('ram', 'motherboard'):
        ram = re.search(r'DDR[345]', text)
        if ram:
            result['memory'] = ram[0]
    return result


def parse_alltec(html, category):
    soup = BeautifulSoup(html, 'html.parser')
    result = []
    for card in soup.select('#product_list .product-container'):
        link = card.select_one('a.product-name')
        price = card.select_one('[itemprop="price"]')
        if not link or not price:
            continue
        name = link.get('title') or link.get_text(' ', strip=True)
        if category == 'case' and 'GABINETE' not in name.upper():
            continue
        if category == 'motherboard' and not re.search(r'AM[45]|LGA', name, re.I):
            continue
        url = link['href']
        if urlparse(url).netloc != 'www.alltec.cl':
            continue
        description = card.select_one('.product-desc')
        description = description.get_text(' ', strip=True) if description else ''
        image = card.select_one('img[itemprop="image"]')
        availability = card.select_one('[itemprop="availability"]')
        stock = None if availability is None else availability.get('href', '').endswith('/InStock')
        old = card.select_one('.old-price')
        result.append(dict(id=identity(url), name=name, category=category,
            price=clp(price.get_text()), currency='CLP', store='Alltec', url=url,
            image=image.get('src') if image else None, inStock=stock,
            previousRetailPrice=clp(old.get_text()) if old else None,
            description=description, specs=specs(name, description, category), sourceType='HTML / microdatos'))
    if not result:
        raise ValueError('No se encontraron productos: posible cambio de estructura')
    return result


def parse_chilesetup(data):
    mapping = {58: 'case', 57: 'cooler', 59: 'psu'}
    products = []
    for p in data:
        category = next((mapping[c['id']] for c in p['categories'] if c['id'] in mapping), None)
        if category is None:
            continue
        price_info = p['prices']
        if price_info['currency_code'] != 'CLP':
            raise ValueError('Moneda inesperada')
        price = round(int(price_info['price']) / 10 ** price_info['currency_minor_unit'])
        if price <= 0:
            continue
        desc = BeautifulSoup(p['short_description'], 'html.parser').get_text(' ', strip=True)
        products.append(dict(id=identity(p['permalink']), name=p['name'], category=category,
            price=price, currency='CLP', store='Chile Setup', url=p['permalink'],
            image=p['images'][0]['src'] if p['images'] else None,
            inStock=p['is_in_stock'], previousRetailPrice=None, description=desc,
            specs=specs(p['name'], desc, category), sourceType='API pública WooCommerce'))
    if not products:
        raise ValueError('Catálogo de Chile Setup vacío')
    return products


def select(products, limit):
    unique = {p['id']: p for p in products}
    return sorted(unique.values(), key=lambda p: (p['inStock'] is not True, p['price']))[:limit]


def expand_platforms(candidates, selection, config):
    """Add documented CPU/board options only when both are freshly in stock."""
    available = {p['id']: p for p in candidates if p['inStock'] is True}
    result = {p['id']: p for p in selection}
    for entry in config['boards']:
        board = available.get(entry['id'])
        if not board or board['category'] != 'motherboard' or board['specs'].get('socket') != entry['socket']:
            continue
        cpus = [available[cid] for cid in entry['cpuIds'] if cid in available
                and available[cid]['category'] == 'cpu'
                and available[cid]['specs'].get('socket') == entry['socket']]
        if not cpus:
            continue
        board = dict(board, platformSupport=dict(cpuIds=[p['id'] for p in cpus],
            source=entry['source'], reviewedOn=config['reviewedOn'], note=config['note']))
        result[board['id']] = board
        result.update({p['id']: p for p in cpus})
    return list(result.values())


def save(products, errors, export_path):
    now = datetime.now(timezone.utc).isoformat()
    with connect() as db:
        initialize(db)
        for product in products:
            product['checkedAt'] = now
            product['history'] = record(db, product, now)
        db.commit()
    # Conservar última observación de fuentes fallidas, marcada como antigua.
    if export_path.exists() and errors:
        previous = json.loads(export_path.read_text(encoding='utf-8'))
        present = {p['id'] for p in products}
        failed_keys = {e['key'] for e in errors}
        for p in previous['products']:
            key = 'alltec:' + p['category'] if p['store'] == 'Alltec' else 'chilesetup'
            if p['id'] not in present and key in failed_keys:
                p['stale'] = True
                products.append(p)
    export = dict(generatedAt=now, currency='CLP', categories=[dict(id=k, name=v[0]) for k, v in CATEGORIES.items()],
                  products=products, errors=errors,
                  methodology='Muestra acotada de catálogos públicos. Precio publicado; confirmar forma de pago, stock y despacho en la tienda. No incluye envío. No afiliado a SoloTodo.')
    export_path.parent.mkdir(parents=True, exist_ok=True)
    temp = export_path.with_suffix('.tmp')
    temp.write_text(json.dumps(export, ensure_ascii=False, indent=2), encoding='utf-8')
    temp.replace(export_path)
    return export


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--limit', type=int, default=4, help='Máximo de productos por categoría y tienda (2–12)')
    args = parser.parse_args()
    if not 2 <= args.limit <= 12:
        parser.error('--limit debe estar entre 2 y 12')
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
    with connect() as db:
        initialize(db)
    client, products, errors, platform_candidates = Client(), [], [], []
    for category, (_, paths) in CATEGORIES.items():
        items = []
        for path in paths:
            try:
                items.extend(parse_alltec(client.get('https://www.alltec.cl/' + path), category))
            except (urllib.error.URLError, ValueError, TimeoutError) as exc:
                errors.append(dict(key='alltec:' + category, message=str(exc)))
                logging.error('%s: %s', category, exc)
        if category in ('cpu', 'motherboard'):
            platform_candidates.extend(items)
        selected = select(items, args.limit)
        products.extend(selected)
        logging.info('%s: %s productos', category, len(selected))
    try:
        items = parse_chilesetup(json.loads(client.get('https://chilesetup.cl/wp-json/wc/store/v1/products?per_page=100')))
        for category in ('case', 'cooler', 'psu'):
            products.extend(select([p for p in items if p['category'] == category], args.limit))
    except (urllib.error.URLError, ValueError, KeyError, TimeoutError) as exc:
        errors.append(dict(key='chilesetup', message=str(exc)))
        logging.error('Chile Setup: %s', exc)
    config = json.loads((ROOT / 'scraper/catalog_expansion.json').read_text(encoding='utf-8'))
    products = expand_platforms(platform_candidates, products, config)
    export = save(products, errors, ROOT / 'dist/data/catalog.json')
    logging.info('Exportados %s productos; %s incidencias', len(export['products']), len(errors))
    if errors or any(sum(p['category'] == k for p in export['products']) < 2 for k in CATEGORIES):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
