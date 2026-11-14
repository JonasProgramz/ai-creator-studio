// Adapter für den Chat im Studio: welcher KI-Agent den Schnitt ändert.
// Jeder Adapter sagt, wie eine Nachricht geschickt wird, wie Antworten und Werkzeuge zurückkommen,
// ob ein Gespräch fortgesetzt werden kann und wie die Anmeldung läuft.
// Welcher Agent: --agent beim Start, sonst "agent" in projekt.json, sonst der erste installierte (Reihenfolge unten).
// Getestet am 14.11.2026: claude (Claude Code), codex (Codex CLI 0.169), hermes (Hermes Agent 0.20).
// Noch nicht getestet, nach Doku gebaut: antigravity (Antigravity CLI agy), gemini (Gemini CLI), opencode (OpenCode).
// anleitungNennen: Der Agent liest die Anleitung im Projektordner nicht von selbst, das Studio nennt sie in jeder Nachricht.

import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const basis = p => path.basename(p || '');
const agyText = new Map();   // Antigravity streamt Text in Stücken je Schritt

export const AGENTEN = {
  claude: {
    name: 'Claude Code', bin: 'claude', fortsetzen: true, stream: true, getestet: true,
    // Nur lesen und Dateien bearbeiten, keine Befehle
    aufruf: (prompt, sitzung) => ({ args: ['-p', prompt, '--output-format', 'stream-json', '--verbose',
      '--permission-mode', 'acceptEdits', '--allowedTools', 'Read,Edit,Write,Glob,Grep', ...(sitzung ? ['--resume', sitzung] : [])] }),
    zeile(e) {
      const out = [];
      if (e.session_id) out.push({ sitzung: e.session_id });
      if (e.type === 'assistant') for (const c of e.message?.content || []) {
        if (c.type === 'text' && c.text.trim()) out.push({ text: c.text.trim() });
        if (c.type === 'tool_use') {
          const i = c.input || {}, d = basis(i.file_path || i.path);
          out.push({ werkzeug: c.name === 'Edit' || c.name === 'Write' ? `ändert ${d}` : c.name === 'Read' ? `liest ${d}`
            : c.name === 'Grep' ? `sucht „${(i.pattern || '').slice(0, 40)}“` : c.name });
        }
      }
      if (e.type === 'result' && e.is_error) out.push({ fehler: String(e.result || 'Fehler') });
      return out;
    },
    angemeldet: () => { try { return JSON.parse(lauf('claude', ['auth', 'status']).match(/\{[\s\S]*\}/)[0]).loggedIn === true; } catch { return false; } },
    anmelden: ['auth', 'login'],
  },

  codex: {
    name: 'Codex', bin: 'codex', fortsetzen: true, stream: true, getestet: true, ueberStdin: true,
    // Schreiben nur im Projektordner (Sandbox workspace-write). Der Prompt kommt über stdin, weil codex unter Windows ein .cmd ist.
    aufruf: (_prompt, sitzung) => ({ args: sitzung
      ? ['exec', 'resume', sitzung, '--json', '--skip-git-repo-check', '-c', 'sandbox_mode="workspace-write"', '-']
      : ['exec', '--json', '--skip-git-repo-check', '-s', 'workspace-write', '-'] }),
    zeile(e) {
      const out = [];
      if (e.type === 'thread.started' && e.thread_id) out.push({ sitzung: e.thread_id });
      const it = e.item;
      if (e.type === 'item.completed' && it?.type === 'agent_message' && it.text?.trim()) out.push({ text: it.text.trim() });
      if (e.type === 'item.started' && it?.type === 'file_change') for (const c of it.changes || []) out.push({ werkzeug: `ändert ${basis(c.path)}` });
      if (e.type === 'item.started' && it?.type === 'command_execution') out.push({ werkzeug: 'führt einen Befehl aus' });
      if (e.type === 'turn.failed') out.push({ fehler: fehlerText(e.error?.message) });
      return out;
    },
    angemeldet: () => { try { const t = lauf('codex', ['login', 'status']); return /logged in/i.test(t) && !/not logged in/i.test(t); } catch { return false; } },
    anmelden: ['login'],
  },

  hermes: {
    name: 'Hermes', bin: 'hermes', fortsetzen: false, stream: false, getestet: true, anleitungNennen: true,
    // Einmal-Modus gibt nur die fertige Antwort aus und merkt sich kein Gespräch, deshalb schickt das Studio den Verlauf mit
    aufruf: (prompt, _s, ordner) => ({ args: ['--in', ordner, '-z', prompt] }),
    // Hermes hängt manchmal eine Prüfmeldung zu Dateiänderungen an die Antwort, die gehört nicht in den Chat
    aufraeumen: s => s.replace(/\s*⚠️ File-mutation verifier[\s\S]*$/u, '').trim(),
    angemeldet: () => istInstalliert('hermes'),
    hinweis: 'Hermes richtest du einmal im Terminal ein: „hermes setup“ (Modell und Anbieter wählen). Danach funktioniert der Chat hier.',
  },

  antigravity: {
    // Antigravity CLI (agy), Kommandozeile zu Googles Antigravity. Nach Doku gebaut (antigravity.google/docs/cli/headless), noch nicht getestet.
    // accept-edits: Dateien ändern ohne Rückfrage, sonst lehnt der Einmal-Modus Änderungen still ab
    name: 'Antigravity', bin: 'agy', fortsetzen: true, stream: true, getestet: false, anleitungNennen: true,
    aufruf: (prompt, sitzung) => ({ args: ['-p', prompt, '--output-format', 'stream-json', '--mode', 'accept-edits',
      ...(sitzung ? ['--conversation', sitzung] : [])] }),
    zeile(e) {
      const out = [];
      if (e.conversation_id) out.push({ sitzung: e.conversation_id });
      if (e.type === 'init' || e.event === 'init') agyText.clear();
      const art = e.type || e.event;
      if (art === 'step_update') {
        if (e.step_type === 'tool' && e.state === 'ACTIVE' && e.tool_name && !agyText.has('w' + e.step_index)) {
          agyText.set('w' + e.step_index, 1);
          const pa = e.tool_info?.parameters || {}, d = basis(pa.file_path || pa.path);
          out.push({ werkzeug: /write|edit|replace/i.test(e.tool_name) ? `ändert ${d}` : /read|view/i.test(e.tool_name) ? `liest ${d}` : e.tool_name });
        }
        if (e.text_delta) agyText.set(e.step_index, (agyText.get(e.step_index) || '') + e.text_delta);
        if (e.state === 'DONE' && agyText.get(e.step_index)?.trim()) { out.push({ text: agyText.get(e.step_index).trim() }); agyText.delete(e.step_index); }
      }
      if (art === 'result' && e.status && e.status !== 'SUCCESS') out.push({ fehler: e.error?.message || String(e.error || e.status) });
      return out;
    },
    angemeldet: () => istInstalliert('agy'),
    hinweis: 'Starte einmal „agy“ im Terminal und melde dich mit deinem Google-Konto an. Danach funktioniert der Chat hier.',
  },

  gemini: {
    name: 'Gemini CLI', bin: 'gemini', fortsetzen: false, stream: false, getestet: false, ueberStdin: true, anleitungNennen: true,
    // Ohne -p liest die Gemini CLI den Prompt aus stdin und läuft ohne Rückfragen durch
    aufruf: () => ({ args: ['--approval-mode', 'auto_edit'] }),
    angemeldet: () => istInstalliert('gemini'),
    hinweis: 'Starte einmal „gemini“ im Terminal und melde dich mit deinem Google-Konto an. Danach funktioniert der Chat hier.',
  },

  opencode: {
    name: 'OpenCode', bin: 'opencode', fortsetzen: false, stream: false, getestet: false, anleitungNennen: true,
    aufruf: prompt => ({ args: ['run', prompt] }),
    angemeldet: () => istInstalliert('opencode'),
    hinweis: 'Melde OpenCode einmal im Terminal bei deinem Anbieter an: „opencode auth login“. Danach funktioniert der Chat hier.',
  },
};

function fehlerText(m) {
  try { return JSON.parse(m).error?.message || m; } catch { return String(m || 'Fehler'); }
}

// Unter Windows liegen manche Agenten als .cmd vor (npm). Die brauchen eine Shell, darum geht der Prompt dort über stdin.
const pfade = {};
export function finde(bin) {
  if (bin in pfade) return pfade[bin];
  try {
    const t = execFileSync(process.platform === 'win32' ? 'where' : 'which', [bin], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    const liste = t.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    pfade[bin] = liste.find(p => /\.(exe|cmd|bat)$/i.test(p)) || liste[0] || null;
  } catch { pfade[bin] = null; }
  return pfade[bin];
}
export const istInstalliert = bin => !!finde(bin);
export const brauchtShell = bin => /\.(cmd|bat)$/i.test(finde(bin) || '');
// Ausgabe eines kurzen Befehls, stdout und stderr zusammen (codex login status schreibt auf stderr)
function lauf(bin, args) {
  const r = spawnSync(finde(bin) || bin, args, { windowsHide: true, shell: brauchtShell(bin), encoding: 'utf8', timeout: 20000 });
  if (r.error) throw r.error;
  return (r.stdout || '') + (r.stderr || '');
}

// Welcher Agent: ausdrücklich gewählt, sonst der erste installierte
export function waehle(wunsch) {
  if (wunsch && AGENTEN[wunsch]) return wunsch;
  return Object.keys(AGENTEN).find(k => istInstalliert(AGENTEN[k].bin)) || 'claude';
}
export const installierte = () => Object.keys(AGENTEN).filter(k => istInstalliert(AGENTEN[k].bin));
