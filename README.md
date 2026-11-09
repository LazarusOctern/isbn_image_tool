# ISBN Cover Finder

Eine statische Webseite, die Buchcover zu einer Liste von ISBNs über die
[Open-Library-Cover-API](https://openlibrary.org/dev/docs/api/covers) und die
[Google Books API](https://developers.google.com/books/docs/v1/using) sucht.
Zuerst wird Open Library abgefragt, anschließend Google Books als Ersatzquelle.
Gefundene Bilder können einzeln heruntergeladen oder geöffnet werden.

## Verwendung

ISBN-10 oder ISBN-13 eingeben: eine ISBN pro Zeile oder durch Komma bzw.
Semikolon getrennt. Bindestriche und Leerzeichen innerhalb einer ISBN sind
erlaubt. Ungültige ISBNs und fehlende Cover werden angezeigt; doppelte ISBNs
werden nur einmal gesucht.

Die Suche benötigt eine Internetverbindung. Die eingegebenen ISBNs werden
für die Cover-Suche an Open Library und Google Books übermittelt. Auch dort
ist nicht für jedes Buch ein Cover vorhanden. Beachte bei der Weiterverwendung
der Bilder die jeweiligen Urheberrechte.

## Lokal starten

Im Projektverzeichnis beispielsweise `python3 -m http.server 8000` ausführen
und `http://localhost:8000` im Browser öffnen. Die Seite benötigt keinen
Build-Schritt und keine installierten Pakete.

Die ISBN-Prüfung kann mit `node --test` getestet werden.

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
