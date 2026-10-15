import { defineConfig } from 'vite';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MAP_FILE = fileURLToPath(new URL('./src/world/map.json', import.meta.url));
const LISTS = ['fields', 'roads', 'ponds', 'forestPlots', 'river']; // lists of objects or points
const OBJECTS = ['ford', 'places']; // ford = { x, z }, places = { id: [dx, dz] }

/** One object (or point, or building) per line, so map.json stays readable and diffs stay small. */
function formatMap(data) {
  const keys = Object.keys(data);
  if (!keys.length) return '{}\n';
  const body = k => {
    if (k === 'ford') return JSON.stringify(data[k]);
    if (k === 'places') return '{\n' + Object.entries(data[k]).map(([id, v]) => `    "${id}": ${JSON.stringify(v)}`).join(',\n') + '\n  }';
    return '[\n' + data[k].map(o => '    ' + JSON.stringify(o)).join(',\n') + '\n  ]';
  };
  return '{\n' + keys.map(k => `  "${k}": ${body(k)}`).join(',\n') + '\n}\n';
}

/** Lets the map editor (F9 → Editor mapy) save src/world/map.json while the development server runs. */
function mapEditorSave() {
  return {
    name: 'map-editor-save',
    configureServer(server) {
      server.middlewares.use('/__map', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        let body = '';
        req.on('data', chunk => { body += chunk; if (body.length > 2e6) req.destroy(); });
        req.on('end', () => {
          res.setHeader('content-type', 'application/json');
          try {
            const data = JSON.parse(body);
            if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('expected an object');
            for (const [k, v] of Object.entries(data)) {
              if (LISTS.includes(k)) { if (!Array.isArray(v)) throw new Error(k + ' must be a list'); }
              else if (OBJECTS.includes(k)) { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(k + ' must be an object'); }
              else throw new Error('unknown section ' + k);
            }
            writeFileSync(MAP_FILE, formatMap(data));
            res.end('{"ok":true}');
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  base: './',
  server: { port: 5173 },
  build: { chunkSizeWarningLimit: 1000 },
  plugins: [mapEditorSave()],
});
