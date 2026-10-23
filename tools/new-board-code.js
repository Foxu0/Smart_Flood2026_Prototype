#!/usr/bin/env node
/**
 * Makes a new board code for one ESP32 (run once per board, by the team).
 *   npm run board:new-code
 *
 * 1. Paste the printed line into the firmware and upload it to the board.
 * 2. Print the same code on a sticker and put it on the board.
 * 3. At installation, staff type the code on Hardware → Add board.
 */
import { generateBoardCode } from '../server/lib/crypto.js';

const code = generateBoardCode();
console.log(`
Board code:  ${code}

Firmware (paste into the sketch before uploading):
  const char* BOARD_CODE = "${code}";

Print "${code}" on the board's sticker. Keep it private — it works like the board's password.
`);
