// Wartet, bis das Studio ein neues Signal schreibt (Weitergeben fertig, Export-Fehler, Feedback gespeichert), gibt es aus und endet.
// Claude startet das im Hintergrund, sobald das Studio läuft, und wird beim Ende benachrichtigt:
//   node warten.mjs <projektordner>
import fs from 'node:fs';
import path from 'node:path';

const ordner = process.argv[2];
if (!ordner) { console.error('Aufruf: node warten.mjs <projektordner>'); process.exit(1); }
const datei = path.join(ordner, 'signal.json');
const lies = () => { try { return JSON.parse(fs.readFileSync(datei, 'utf8')); } catch { return null; } };
const start = lies()?.zeit || 0;
setInterval(() => {
  const s = lies();
  if (s && s.zeit > start) { console.log(JSON.stringify(s)); process.exit(0); }
}, 1000);
