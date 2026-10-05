import './vorfuehrungsHinweis.css'

// v18-T: dezenter Hinweis auf /live?vorfuehrung=1 — direkt unter der
// Kopfzeile, eine Haarlinien-Zeile, kein Alarm. Zeigt klar: das ist eine
// Vorführung, kein echtes Spiel.
export function VorfuehrungsHinweis() {
  return (
    <p className="lv-demo" role="note">
      <span className="lv-demo__label">Vorführung</span>
      <span className="lv-demo__text">kein echtes Spiel</span>
    </p>
  )
}
