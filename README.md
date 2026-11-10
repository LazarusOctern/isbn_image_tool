# ISBN Cover Finder

Eine statische Webseite, die Buchcover zu einer Liste von ISBNs über die
[Open-Library-Cover-API](https://openlibrary.org/dev/docs/api/covers) und die
[Google Books API](https://developers.google.com/books/docs/v1/using) sucht.
Zuerst wird Open Library abgefragt, anschließend Google Books als Ersatzquelle.
Gefundene Bilder können einzeln oder gesammelt als ZIP-Datei heruntergeladen
werden. Dafür müssen die Bilder vom Browser abrufbar sein.

## Verwendung

ISBN-10 oder ISBN-13 eingeben: eine ISBN pro Zeile oder durch Komma bzw.
Semikolon getrennt. Bindestriche und Leerzeichen innerhalb einer ISBN sind
erlaubt. Ungültige ISBNs und fehlende Cover werden angezeigt; doppelte ISBNs
werden nur einmal gesucht.

Die Suche benötigt eine Internetverbindung. Die eingegebenen ISBNs werden
für die Cover-Suche an Open Library und Google Books übermittelt. Auch dort
ist nicht für jedes Buch ein Cover vorhanden. Beachte bei der Weiterverwendung
der Bilder die jeweiligen Urheberrechte. Anfragen laufen einzeln; bei HTTP 429
wird eine mitgesendete `Retry-After`-Wartezeit berücksichtigt und die andere
Cover-Quelle versucht.

## Excel-Import

Alternativ eine `.xlsx`-Datei hochladen. Im **ersten Tabellenblatt** stehen die
Buch-GTINs (ISBN-13) oder ISBN-10 in **Spalte A**. Eine Überschrift `GTIN`, `EAN`
oder `ISBN` in A1 ist erlaubt. Auch als Zahlen gespeicherte ISBN-13 werden
erkannt, selbst wenn Excel sie in wissenschaftlicher Schreibweise anzeigt.

Mit **Cover in Excel einfügen** werden herunterladbare Cover als echte Bilder
in **Spalte B derselben Zeile** eingebettet, nicht nur verlinkt. Anschließend
steht die Datei als `…-mit-covern.xlsx` zum Download bereit. Zeilenhöhen und
die Breite von B werden bei Bedarf vergrößert. Die restlichen Zellwerte,
Formeln und Tabellenblätter bleiben erhalten. Bereits belegte Zellen in B
werden übersprungen; verbundene Zellen in B müssen zuerst aufgelöst werden.
Nicht gefundene Cover, ungültige ISBNs und Downloadfehler werden mit
Zeilennummer angezeigt. Doppelte ISBNs werden nur einmal abgefragt, ihre Cover
aber in jeder passenden Zeile eingefügt.

Die Verarbeitung erfolgt im Browser mit ExcelJS. Die Excel-Datei wird nicht
hochgeladen; nur die ISBNs werden an Open Library und Google Books gesendet.
GTINs anderer Produkte werden derzeit nicht unterstützt. Bilder, die wegen
Browser-Zugriffsbeschränkungen nur angezeigt, aber nicht heruntergeladen werden
können, lassen sich nicht in die Datei einbetten. Komplexe Excel-Funktionen
wie eingebettete Objekte oder spezielle Diagramme werden von ExcelJS nicht
vollständig unterstützt; für solche Dateien eine Kopie verwenden.

## Lokal starten

Mit Node.js 22 oder neuer im Projektverzeichnis:

```sh
npm ci
npm run build
python3 -m http.server 8000 --directory dist
```

Dann `http://localhost:8000` im Browser öffnen. Der Build kopiert die statische
Webseite und die lokal ausgelieferte ExcelJS-Bibliothek nach `dist/`; es wird
kein Anwendungsserver benötigt.

Die ISBN-Prüfung, Cover-Suche, Excel-Verarbeitung und das ZIP-Archiv können
mit `npm test` getestet werden.

## Auf GitHub Pages veröffentlichen

1. Die Dateien in den `main`-Branch des GitHub-Repositories übertragen.
2. Unter **Settings → Pages → Build and deployment → Source** die Option
   **GitHub Actions** auswählen.
3. Der Workflow unter `.github/workflows/pages.yml` veröffentlicht die Seite
   bei jedem Push auf `main`. Falls der erste Push vor der Auswahl der Quelle
   erfolgte, den Workflow im Reiter **Actions** manuell starten.

Die Adresse lautet bei diesem Repository
`https://lazarusoctern.github.io/isbn_image_tool/`. Sie ist verfügbar, sobald
der Pages-Workflow erfolgreich abgeschlossen ist.
