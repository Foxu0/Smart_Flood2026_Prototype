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
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HTML_PATH = path.join(__dirname, 'esp32-simulator-dashboard.html');

const PORT = 5174;

const server = http.createServer((req, res) => {
  fs.readFile(HTML_PATH, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error loading simulator dashboard');
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(` 📡 VIRTUAL ESP32 SIMULATOR WEB DASHBOARD READY   `);
  console.log(`==================================================`);
  console.log(` Open Dashboard in Browser → http://localhost:${PORT}`);
  console.log(` Target Backend Endpoint   → Render Cloud or Localhost`);
  console.log(`==================================================\n`);
});
