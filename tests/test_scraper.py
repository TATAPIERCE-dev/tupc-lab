import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from scraper.collect import parse_alltec, clp, select, specs, save
from scraper.database import initialize, record

FIXTURE = '''<ul id="product_list"><li><div class="product-container">
<a class="product-name" title="AMD RYZEN TEST (AM4)" href="https://www.alltec.cl/amd/1-test.html">Cortado…</a>
<span itemprop="price">$ 74,500</span><span class="old-price">$ 89,900</span>
<link itemprop="availability" href="https://schema.org/OutOfStock">
<img itemprop="image" src="https://www.alltec.cl/test.jpg"><p class="product-desc">CPU de prueba</p>
</div></li></ul>'''


class ScraperTests(unittest.TestCase):
    def test_html_uses_full_title_current_price_and_stock(self):
        p = parse_alltec(FIXTURE, 'cpu')[0]
        self.assertEqual(p['price'], 74500)
        self.assertEqual(p['previousRetailPrice'], 89900)
        self.assertEqual(p['name'], 'AMD RYZEN TEST (AM4)')
        self.assertFalse(p['inStock'])
        self.assertEqual(p['specs'], {'socket': 'AM4'})

    def test_changed_markup_does_not_silently_succeed(self):
        with self.assertRaises(ValueError):
            parse_alltec('<p>Captcha</p>', 'cpu')

    def test_invalid_prices_are_rejected(self):
        for value in ('Consultar', '$0', '$999999999'):
            with self.assertRaises(ValueError):
                clp(value)
        self.assertEqual(clp('$ 123.990'), 123990)

    def test_accessory_not_accepted_as_case(self):
        with self.assertRaises(ValueError):
            parse_alltec(FIXTURE.replace('AMD RYZEN TEST (AM4)', 'LED PARTITION PLATE'), 'case')

    def test_stock_priority_and_deduplication(self):
        p = parse_alltec(FIXTURE, 'cpu')[0]
        available = dict(p, id='available', inStock=True, price=100000)
        self.assertEqual([x['id'] for x in select([p, p, available], 4)], ['available', p['id']])

    def test_specs_only_from_relevant_categories(self):
        self.assertEqual(specs('LGA1700 DDR4', '', 'motherboard'), {'socket': '1700', 'memory': 'DDR4'})
        self.assertEqual(specs('GPU GDDR5', '', 'gpu'), {})

    def test_history_idempotent_and_chronological(self):
        with sqlite3.connect(':memory:') as db:
            initialize(db)
            p = parse_alltec(FIXTURE, 'cpu')[0]
            record(db, p, '2026-01-01T12:00:00+00:00')
            record(db, p, '2026-01-01T12:00:00+00:00')
            p['price'] = 70000
            history = record(db, p, '2026-01-02T12:00:00+00:00')
            self.assertEqual([h['price'] for h in history], [74500, 70000])

    def test_failed_source_preserves_original_timestamp(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'catalog.json'
            p = parse_alltec(FIXTURE, 'cpu')[0]
            p['checkedAt'] = '2026-01-01T00:00:00+00:00'
            path.write_text(json.dumps({'products': [p]}), encoding='utf-8')
            with patch('scraper.collect.connect', return_value=sqlite3.connect(':memory:')):
                result = save([], [{'key': 'alltec:cpu', 'message': '403'}], path)
            self.assertTrue(result['products'][0]['stale'])
            self.assertEqual(result['products'][0]['checkedAt'], p['checkedAt'])


if __name__ == '__main__':
    unittest.main()
