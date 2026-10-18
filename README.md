# TuPC.LAB — Explorador de componentes para PC

![Vista de TuPC.LAB](docs/preview.png)

**Python · BeautifulSoup · SQLite · JavaScript · HTML/CSS**

Proyecto web de portafolio con datos reales de tiendas chilenas. Permite explorar componentes, comparar hasta tres opciones y armar una lista con presupuesto. Inspirado en el concepto de un comparador de hardware; sin afiliación a SoloTodo.

## Para quien visita

Sólo necesita abrir la web. **No requiere Python, Node, SQLite, Docker ni instalar nada.** La versión web publicada sirve HTML, CSS, JavaScript y un catálogo JSON. Los favoritos y el armado se guardan en el navegador.

## Funciones

- 8 categorías: procesadores, placas madre, RAM, SSD, GPU, fuentes, gabinetes y refrigeración.
- Catálogo inicial de 40 productos; al menos 4 opciones por categoría.
- Búsqueda, filtro por categoría/tienda/stock y orden por precio o nombre.
- Comparación de hasta 3 componentes, favoritos persistentes y fichas con fuente.
- Armador de una pieza por categoría, presupuesto y exportación TXT con enlaces.
- Advertencias de incompatibilidad de socket y generación de RAM cuando esos datos están disponibles.
- Historial de lecturas reales en SQLite; nunca se generan precios ni tendencias ficticias.
- Diseño adaptable a móvil, navegación por teclado y diálogos accesibles.

## Ver la web local

Requiere Node 20+ **sólo para desarrollo**. Sin paquetes npm adicionales:

```powershell
npm run dev
```

Abre http://127.0.0.1:4173. El catálogo ya está incluido, por lo que no hay que ejecutar el scraper para ver la web.

Alternativa con Python: `python -m http.server 4173 --bind 127.0.0.1 --directory dist`.

## Actualizar precios

Requiere Python 3.11+ en el equipo que recolecta. En Windows:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
npm run scrape
npm test
```

En macOS/Linux usa `python3 -m venv .venv` y `.venv/bin/python -m pip install -r requirements.txt`. El comando npm detecta el entorno virtual según el sistema.

El recolector actualiza `data/prices.db` y `dist/data/catalog.json`. Para cambiar el tamaño de la muestra: `npm run scrape -- --limit 6` (entre 2 y 12 productos por categoría y tienda). La extracción demora unos 30 segundos por las pausas entre solicitudes.

**La versión publicada no ejecuta Python:** para mostrar nuevas capturas hay que volver a publicar `dist/`. No hay tareas recurrentes activadas. La fecha visible es la de la captura y se muestra una advertencia cuando supera 48 horas.

## Arquitectura

```text
Alltec (HTML/microdatos) ─┐
                        ├─ Python + BeautifulSoup ─ SQLite ─ catálogo JSON
Chile Setup (API pública)┘                                      │
                                                     Web estática / Sites
```

```text
dist/                 Web publicable, sin secretos ni base de datos
  data/catalog.json   Snapshot de precios + historial exportado
scraper/
  collect.py          Adaptadores, robots.txt, selección y exportación
  database.py         Observaciones SQLite
data/prices.db        Historial local (ignorado por Git)
tests/                Pruebas unitarias sin red
scripts/              Servidor local y lanzador Python multiplataforma
```

## Fuentes y alcance

- [Alltec](https://www.alltec.cl/): HTML de la primera página de subcategorías observadas. Extrae título completo, precio vigente, disponibilidad, imagen y URL.
- [Chile Setup](https://chilesetup.cl/): API pública WooCommerce Store, primera página de hasta 100 artículos; selecciona fuentes, gabinetes y refrigeración.
- Muestra acotada: hasta cuatro productos por categoría y tienda por defecto, priorizando stock y menor precio. No representa todo el mercado. Algunos artículos pueden estar agotados.
- Cada ficha mantiene su tienda. No se afirma que productos de distintas tiendas sean el mismo SKU ni se promete el mejor precio de Chile.
- Precio publicado en CLP, sin envío. Revisar condiciones de pago en origen.
- Se consulta robots.txt y se aplica una pausa mínima de dos segundos por dominio, respetando mayores crawl-delay. No se evaden 403/429 ni CAPTCHAs. Si falla una fuente, se conserva su lectura anterior con `stale: true` y se informa el error; el proceso termina con código 1.
- Las imágenes y nombres pertenecen a sus titulares y se enlazan desde la fuente. Hay alternativa visual si una imagen deja de cargar.
- La compatibilidad es parcial: socket y generación DDR. BIOS, dimensiones, conectores, potencia y compatibilidad de refrigeración requieren revisión manual. Algunos procesadores incluyen cooler. Periféricos y sistema operativo están fuera de esta versión.
- La base crece con cada ejecución. Respaldar `data/prices.db` para conservar el historial; borrar ese archivo inicia una nueva historia local.

## Verificación

```powershell
npm run check
npm test
```

Las pruebas cubren extracción de precios y stock, cambios de HTML, exclusión de accesorios, deduplicación, características, idempotencia del historial y conservación de datos ante errores.

## Publicación y portafolio

`dist/` se puede servir en cualquier hosting estático. La publicación inicial en Sites es **privada**, según lo solicitado. Antes de compartir con reclutadores hay que habilitar una audiencia que pueda acceder; una vista privada sólo es visible para su propietario.

No subir `.venv/`, `work/` ni la base de datos al hosting. El archivo JSON contiene únicamente datos públicos y sus fechas de observación.

Próximas mejoras posibles: emparejar SKUs exactos entre tiendas, ampliar cobertura con paginación, programar capturas y publicación, y verificar compatibilidad con fichas técnicas de fabricantes.
