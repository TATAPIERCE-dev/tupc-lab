"""Persistencia SQLite local. El visitante sólo necesita su navegador."""
import sqlite3
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


def record(db, p, observed_at):
    db.execute('INSERT OR IGNORE INTO observations VALUES (?, ?, ?, ?)',
        (p['id'], observed_at, p['price'], p['inStock']))
    rows = db.execute('''SELECT observed_at, price FROM observations
        WHERE product_id=? ORDER BY observed_at DESC LIMIT 90''', (p['id'],)).fetchall()
    return [dict(date=d, price=price) for d, price in rows[::-1]]
