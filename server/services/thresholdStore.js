import { prisma } from '../db.js';

/**
 * Alert thresholds (metres of water above the riverbed).
 *
 * Every board can have its own Level 1 / 2 / 3 values (table: node_thresholds).
 * A board without its own values uses the system defaults (table: system_settings),
 * which start at the manuscript values 1.20 / 1.60 / 2.00 m.
 * Level 3 is the spill level (CDRRMO: water spills at about 2.0 m).
 */
export const DEFAULT_THRESHOLDS = {
  level1_watch:  1.20,
  level2_alarm:  1.60,
  level3_danger: 2.00,
};

const memoryNodeThresholds = new Map(); // nodeId -> { level1_watch, level2_alarm, level3_danger }

export async function getDefaultThresholds() {
  try {
    const rows = await prisma.systemSetting.findMany({
      where: { keyName: { in: Object.keys(DEFAULT_THRESHOLDS) } },
    });
    const overrides = {};
    rows.forEach((r) => { overrides[r.keyName] = parseFloat(r.value); });
    return { ...DEFAULT_THRESHOLDS, ...overrides };
  } catch (_e) {
    return { ...DEFAULT_THRESHOLDS };
  }
}

async function readNodeRow(nodeId) {
  try {
    const row = await prisma.nodeThreshold.findUnique({ where: { nodeId } });
    if (!row) return null;
    return { level1_watch: row.level1Watch, level2_alarm: row.level2Alarm, level3_danger: row.level3Danger };
  } catch (_e) {
    return memoryNodeThresholds.get(nodeId) || null;
  }
}

/** Thresholds that apply to a board: its own values where set, otherwise the defaults. */
export async function getThresholds(nodeId) {
  const defaults = await getDefaultThresholds();
  if (!nodeId) return { ...defaults, custom: false };
  const own = await readNodeRow(nodeId);
  if (!own) return { ...defaults, custom: false };
  return {
    level1_watch:  own.level1_watch  ?? defaults.level1_watch,
    level2_alarm:  own.level2_alarm  ?? defaults.level2_alarm,
    level3_danger: own.level3_danger ?? defaults.level3_danger,
    custom: true,
  };
}

/** Returns an error message, or null when the three levels are valid. */
export function validateThresholds({ level1_watch, level2_alarm, level3_danger }, maxStageM) {
  const v = [level1_watch, level2_alarm, level3_danger];
  if (v.some((x) => typeof x !== 'number' || !Number.isFinite(x) || x <= 0)) return 'All three levels must be positive numbers (metres).';
  if (!(level1_watch < level2_alarm && level2_alarm < level3_danger)) return 'Levels must go up: Level 1 < Level 2 < Level 3.';
  if (maxStageM && level3_danger > maxStageM) return `Level 3 can't be above ${maxStageM.toFixed(2)} m (the highest level this sensor can measure).`;
  return null;
}

export async function setNodeThresholds(nodeId, t) {
  const data = { level1Watch: t.level1_watch, level2Alarm: t.level2_alarm, level3Danger: t.level3_danger };
  try {
    await prisma.nodeThreshold.upsert({ where: { nodeId }, update: data, create: { nodeId, ...data } });
  } catch (_e) {
    memoryNodeThresholds.set(nodeId, { ...t });
  }
  return getThresholds(nodeId);
}

/** Go back to using the system defaults for this board. */
export async function clearNodeThresholds(nodeId) {
  try {
    await prisma.nodeThreshold.deleteMany({ where: { nodeId } });
  } catch (_e) {
    memoryNodeThresholds.delete(nodeId);
  }
  return getThresholds(nodeId);
}
