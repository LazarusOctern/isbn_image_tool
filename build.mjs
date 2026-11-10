import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/assets', { recursive: true });
for (const file of [
  'index.html', 'style.css', 'app.js', 'isbn.mjs', 'zip.mjs',
  'covers.mjs', 'excel.mjs', 'excel-ui.js',
]) {
  await copyFile(file, `dist/${file}`);
}
await copyFile('node_modules/exceljs/dist/exceljs.min.js', 'dist/assets/exceljs.min.js');
await copyFile('node_modules/exceljs/LICENSE', 'dist/assets/exceljs.LICENSE');
await writeFile(
  'dist/config.js',
  `globalThis.GOOGLE_BOOKS_API_KEY = ${JSON.stringify(process.env.GOOGLE_BOOKS_API_KEY ?? '')};\n`
);
await writeFile('dist/.nojekyll', '');
