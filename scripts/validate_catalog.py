"""Reject invalid or unchanged exports before an automated publication."""
import json
from datetime import datetime, timezone
from pathlib import Path

catalog = json.loads(Path('dist/data/catalog.json').read_text(encoding='utf-8'))
age = (datetime.now(timezone.utc) - datetime.fromisoformat(catalog['generatedAt'])).total_seconds()
assert 0 <= age < 1200, 'El recolector no generó una captura nueva'
assert catalog['products'], 'Catálogo vacío'
assert all(isinstance(p['price'], (int, float)) and p['price'] > 0 for p in catalog['products'])
assert all(sum(p['category'] == c['id'] for p in catalog['products']) >= 2 for c in catalog['categories']), 'Cobertura insuficiente'
assert any(not p.get('stale') for p in catalog['products']), 'Todas las fuentes fallaron'
