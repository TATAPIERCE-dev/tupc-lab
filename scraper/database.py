"""Persistencia SQLite local. El visitante sólo necesita su navegador."""
import sqlite3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def connect():
    path = ROOT / 'data/prices.db'
    path.parent.mkdir(parents=True, exist_ok=True)
    return sqlite3.connect(path)


def initialize(db):
    db.execute('''CREATE TABLE IF NOT EXISTS observations (
        product_id TEXT, observed_at TEXT, price INTEGER CHECK(price > 0),
        in_stock INTEGER, PRIMARY KEY(product_id, observed_at))''')


def restore_history(db, catalog_path):
    """Recover the exported 90 readings when a runner has no local database.

    Historical exports do not contain historical stock, so keep it unknown.
    INSERT OR IGNORE preserves richer observations already stored locally.
    """
    if not catalog_path.exists():
        return
    catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
    for product in catalog['products']:
        for reading in product.get('history', []):
            db.execute('INSERT OR IGNORE INTO observations VALUES (?, ?, ?, NULL)',
                       (product['id'], reading['date'], reading['price']))


def record(db, p, observed_at):
    db.execute('INSERT OR IGNORE INTO observations VALUES (?, ?, ?, ?)',
        (p['id'], observed_at, p['price'], p['inStock']))
    rows = db.execute('''SELECT observed_at, price FROM observations
        WHERE product_id=? ORDER BY observed_at DESC LIMIT 90''', (p['id'],)).fetchall()
    return [dict(date=d, price=price) for d, price in rows[::-1]]
