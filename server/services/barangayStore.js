import { prisma } from '../db.js';
import { BARANGAYS } from '../../shared/roles.js';

/**
 * Barangay lookups. The API speaks barangay *names*; the database stores barangay_id.
 * Without a database, ids follow the order of BARANGAYS (same as the seeded table).
 */
const CITY_CENTER = {
  latitude:  parseFloat(process.env.CITY_LAT ?? 14.5869),
  longitude: parseFloat(process.env.CITY_LON ?? 121.1754),
};

let cache = null;

async function loadAll() {
  if (cache) return cache;
  try {
    cache = await prisma.barangay.findMany({ orderBy: { id: 'asc' } });
  } catch (_e) {
    return BARANGAYS.map((name, i) => ({ id: i + 1, name, ...CITY_CENTER }));
  }
  return cache;
}

export async function barangayIdByName(name) {
  if (!name) return null;
  const row = (await loadAll()).find((b) => b.name === name);
  return row ? row.id : null;
}

export async function barangayById(id) {
  if (id == null) return null;
  return (await loadAll()).find((b) => b.id === id) || null;
}

export async function barangayNameById(id) {
  return (await barangayById(id))?.name ?? null;
}

/** Fallback coordinates for a board: its barangay's centre, else the city centre. */
export async function defaultCoordinates(barangayId) {
  const b = await barangayById(barangayId);
  return b ? { latitude: b.latitude, longitude: b.longitude } : CITY_CENTER;
}
