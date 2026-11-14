// Eine Webseite als Video aufnehmen (Screenshots mit echter Zeit, dann ffmpeg). node aufnahme.mjs <url> <ziel.mp4> <sekunden> [warte_ms]
import puppeteer from 'puppeteer-core'; import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
const [url, ziel, sek, warte] = process.argv.slice(2);
// Chrome von HyperFrames suchen (wird bei der ersten Nutzung von HyperFrames geladen), CHROME_PFAD überschreibt
import os from 'node:os'; import path from 'node:path';
function chromePfad() {
  if (process.env.CHROME_PFAD) return process.env.CHROME_PFAD;
  const basis = path.join(os.homedir(), '.cache', 'hyperframes', 'chrome', 'chrome-headless-shell');
  const name = process.platform === 'win32' ? 'chrome-headless-shell.exe' : 'chrome-headless-shell';
  // neueste Version zuerst
  const suche = d => { for (const e of fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).sort((x, y) => y.name.localeCompare(x.name, undefined, { numeric: true })) : []) { const p = path.join(d, e.name); if (e.isFile() && e.name === name) return p; if (e.isDirectory()) { const t = suche(p); if (t) return t; } } return null; };
  const p = suche(basis); if (!p) { console.error('Chrome von HyperFrames nicht gefunden. Einmal "npx hyperframes browser ensure" ausführen oder CHROME_PFAD setzen.'); process.exit(1); }
  return p;
}
const exe = chromePfad();
const b = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); await p.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1.2 });
try { await p.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }); } catch {}
await new Promise(r => setTimeout(r, +(warte || 6000)));
const dir = ziel + '.bilder'; fs.mkdirSync(dir, { recursive: true });
const t0 = Date.now(); const zeiten = []; let i = 0;
while (Date.now() - t0 < sek * 1000) { const f = `${dir}/${String(i).padStart(5, '0')}.jpg`; await p.screenshot({ path: f, type: 'jpeg', quality: 92 }); zeiten.push([f, Date.now()]); i++; }
await b.close();
let liste = ''; for (let k = 0; k < zeiten.length; k++) { const d = k + 1 < zeiten.length ? (zeiten[k + 1][1] - zeiten[k][1]) / 1000 : 0.04; liste += `file '${zeiten[k][0].split('/').pop()}'\nduration ${d}\n`; }
fs.writeFileSync(dir + '/liste.txt', liste);
execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', dir + '/liste.txt', '-vf', 'fps=30,scale=1920:-2', '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', ziel]);
console.log(ziel, zeiten.length, 'Bilder in', sek, 's');
