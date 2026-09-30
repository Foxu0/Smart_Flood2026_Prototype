/**
 * SmartFlood 2026 — 3D Wiring Model Local LAN Server
 * ==============================================================================
 * Hosts the interactive 3D breadboard wiring schematic over the local Wi-Fi
 * network so team members, advisors, and testing devices (phones, tablets, PCs)
 * can view and inspect the physical circuit layout simultaneously in real time.
 * ==============================================================================
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(PROJECT_ROOT, 'docs');
const WIRING_HTML_PATH = path.join(DOCS_DIR, 'Smart_Flood_3D_wiring_expansion.html');
const DRAWIO_PATH = path.join(DOCS_DIR, 'WiringSmartFlood_Full.drawio');

const PORT = parseInt(process.env.PORT || '5175', 10);
const HOST = '0.0.0.0'; // Bind to all interfaces for Wi-Fi access

// Helper: Detect active Wi-Fi / LAN IPv4 addresses
function getLanIps() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // IPv4 and not loopback
      if (net.family === 'IPv4' && !net.internal) {
        ips.push({ interface: name, address: net.address });
      }
    }
  }
  return ips;
}

// MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.drawio': 'application/xml; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // Route: Root or /wiring -> Serve 3D wiring HTML
  if (pathname === '/' || pathname === '/wiring' || pathname === '/3d' || pathname === '/index.html') {
    fs.readFile(WIRING_HTML_PATH, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Error reading 3D wiring file: ${err.message}`);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // Route: /drawio or /diagram -> Serve DrawIO XML/file
  if (pathname === '/drawio' || pathname === '/WiringSmartFlood_Full.drawio') {
    fs.readFile(DRAWIO_PATH, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('DrawIO file not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // Route: check if requested file exists in docs/ or tools/
  let candidatePath = path.join(DOCS_DIR, pathname.replace(/^\/docs\//, ''));
  if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
    const ext = path.extname(candidatePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(candidatePath).pipe(res);
    return;
  }

  // Fallback: Default to 3D wiring HTML
  fs.readFile(WIRING_HTML_PATH, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Page not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  const lanIps = getLanIps();
  console.log(`\n============================================================`);
  console.log(` 🔌 SMART FLOOD 2026 — 3D WIRING MODEL LAN SERVER IS LIVE   `);
  console.log(`============================================================`);
  console.log(` Local:    http://localhost:${PORT}`);
  if (lanIps.length > 0) {
    lanIps.forEach(ip => {
      console.log(` Wi-Fi:    http://${ip.address}:${PORT}  (${ip.interface})`);
    });
  } else {
    console.log(` Wi-Fi:    http://192.168.1.19:${PORT}`);
  }
  console.log(`============================================================`);
  console.log(` 📱 Any device (phone/tablet/PC) connected to the same Wi-Fi `);
  console.log(`    can open the URL above to inspect the circuit interactively.`);
  console.log(`============================================================\n`);
});
