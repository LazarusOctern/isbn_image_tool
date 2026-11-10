import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('dist/vendor', { recursive: true });
for (const file of [
  'index.html', 'style.css', 'app.js', 'isbn.mjs', 'zip.mjs',
  'covers.mjs', 'excel.mjs', 'excel-ui.js',
]) {
  await copyFile(file, `dist/${file}`);
}
await copyFile('node_modules/exceljs/dist/exceljs.min.js', 'dist/vendor/exceljs.min.js');
await copyFile('node_modules/exceljs/LICENSE', 'dist/vendor/exceljs.LICENSE');
