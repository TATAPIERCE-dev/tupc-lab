import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from scraper.database import initialize, restore_history, record


class HistoryRestoreTests(unittest.TestCase):
    def test_fresh_runner_retains_previous_readings_without_inventing_stock(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'catalog.json'
            path.write_text(json.dumps({'products': [{'id': 'cpu', 'history': [
                {'date': '2026-10-20T00:00:00+00:00', 'price': 100}]}]}))
            with sqlite3.connect(':memory:') as db:
                initialize(db)
                restore_history(db, path)
                restore_history(db, path)
                self.assertIsNone(db.execute('SELECT in_stock FROM observations').fetchone()[0])
                history = record(db, {'id': 'cpu', 'price': 90, 'inStock': True}, '2026-10-21T00:00:00+00:00')
                self.assertEqual([h['price'] for h in history], [100, 90])
                restore_history(db, path)
                self.assertEqual(db.execute('SELECT COUNT(*) FROM observations').fetchone()[0], 2)

    def test_missing_snapshot_is_allowed(self):
        with sqlite3.connect(':memory:') as db:
            initialize(db)
            restore_history(db, Path('nonexistent-snapshot.json'))
            self.assertEqual(db.execute('SELECT COUNT(*) FROM observations').fetchone()[0], 0)
