/**
 * SmartFlood 2026 — Virtual ESP32 Simulator Web Dashboard Server
 *
 * ⚠️  IMPORTANT DISCLAIMER — FOR DEVELOPMENT & TESTING USE ONLY
 * ==============================================================================
 * This file is a SOFTWARE DEVELOPMENT TOOL and is NOT part of the SmartFlood
 * 2026 capstone project documentation, manuscript, or system submission.
 *
 * - It is NOT included in the Technical Specification, Architecture Diagrams,
 *   or any chapter of the capstone paper.
 * - It exists solely to serve the esp32-simulator-dashboard.html file locally
 *   for backend API testing without physical hardware connected.
 * - The real embedded firmware is written in C++/Arduino IDE and resides
 *   separately in the microcontroller unit (not in this repository).
 *
 * DO NOT cite, reference, or submit this file as part of the project deliverable.
 * ==============================================================================
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HTML_PATH = path.join(__dirname, 'esp32-simulator-dashboard.html');
const WIRING_PATH = path.resolve(__dirname, '../docs/Smart_Flood_3D_wiring_expansion.html');

const PORT = 5174;
const HOST = '0.0.0.0';

function getLanIps() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push({ interface: name, address: net.address });
      }
    }
  }
  return ips;
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // If asking for /wiring or /3d -> serve the 3D wiring model
  if (pathname.startsWith('/wiring') || pathname.startsWith('/3d')) {
    fs.readFile(WIRING_PATH, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error loading 3D wiring view');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      }
    });
    return;
  }

  // Default: ESP32 Simulator Dashboard
  fs.readFile(HTML_PATH, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error loading simulator dashboard');
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    }
  });
});

server.listen(PORT, HOST, () => {
  const lanIps = getLanIps();
  console.log(`\n==================================================`);
  console.log(` 📡 VIRTUAL ESP32 SIMULATOR & WIRING HUB READY     `);
  console.log(`==================================================`);
  console.log(` Local:   http://localhost:${PORT}`);
  console.log(` 3D Wire: http://localhost:${PORT}/wiring`);
  if (lanIps.length > 0) {
    lanIps.forEach(ip => {
      console.log(` Wi-Fi:   http://${ip.address}:${PORT}  (${ip.interface})`);
      console.log(` Wi-Fi 3D:http://${ip.address}:${PORT}/wiring`);
    });
  } else {
    console.log(` Wi-Fi:   http://192.168.1.19:${PORT}`);
    console.log(` Wi-Fi 3D:http://192.168.1.19:${PORT}/wiring`);
  }
  console.log(`==================================================\n`);
});
