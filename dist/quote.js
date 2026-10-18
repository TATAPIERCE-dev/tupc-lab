export const quoteFilename = format => `pc cotizacion tupc.labs.${format}`;

export function quoteWorkbook(XLSX, items, budget, exportedAt) {
  if (!items.length) throw new Error('Añade componentes antes de exportar.');
  const rows = [
    ['PC COTIZACION TUPC.LABS'],
    ['Exportado (Chile)', exportedAt],
    ['Precios en CLP. Sin despacho ni armado.'],
    ['Categoría', 'Producto', 'Tienda', 'Precio CLP', 'Stock observado', 'Fecha de captura', 'Enlace', 'Condición de pago'],
    ...items.map(p => [p.categoryName, p.name, p.store, p.price,
      p.stale ? 'Lectura anterior; confirmar' : p.inStock === true ? 'Con stock' : p.inStock === false ? 'Sin stock' : 'Por confirmar',
      p.captureLabel, p.url, p.paymentMethod || 'Precio publicado; confirmar en tienda']),
    ['TOTAL ESTIMADO', '', '', items.reduce((sum, p) => sum + p.price, 0)],
    ['Presupuesto', '', '', budget || null],
    ['Confirma stock, BIOS, memoria, medidas y potencia antes de comprar.']
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const totalRow = items.length + 5;
  sheet[`D${totalRow}`].f = `SUM(D5:D${totalRow - 1})`;
  for (let row = 5; row <= totalRow + 1; row++) {
    if (sheet[`D${row}`]) sheet[`D${row}`].z = '"$"#,##0';
  }
  items.forEach((p, i) => {
    if (/^https:\/\//i.test(p.url)) sheet[`G${i + 5}`].l = { Target: p.url };
  });
  sheet['!cols'] = [22, 78, 18, 18, 28, 26, 65, 46].map(wch => ({ wch }));
  sheet['!autofilter'] = { ref: `A4:H${totalRow - 1}` };
  sheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Cotización PC');
  return book;
}
