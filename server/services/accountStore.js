import { prisma } from '../db.js';
import { hashSecret, verifySecret } from '../lib/crypto.js';
import { ROLES } from '../../shared/roles.js';
import { barangayIdByName, barangayNameById } from './barangayStore.js';

/**
 * User account store (table: users). Uses PostgreSQL via Prisma when available and
 * falls back to an in-memory list (same pattern as the rest of the server) so the
 * prototype still runs without a database.
 *
 * The API speaks { barangay: name, isActive: bool, password }; the table stores
 * barangay_id, status ('ACTIVE' | 'DISABLED') and password_hash.
 */
const memoryUsers = [];
let memoryNextId = 1;

export async function toPublicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName ?? null,
    email: user.email ?? null,
    phone: user.phone ?? null,
    role: user.role,
    barangay: await barangayNameById(user.barangayId),
    isActive: user.status === 'ACTIVE',
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt ?? null,
    updatedAt: user.updatedAt ?? null,
  };
}

/** Convert API fields → table fields */
async function toRow(fields) {
  const { password, barangay, isActive, ...rest } = fields;
  const row = { ...rest };
  if (password) row.passwordHash = hashSecret(password);
  if (barangay !== undefined) row.barangayId = await barangayIdByName(barangay);
  if (isActive !== undefined) row.status = isActive ? 'ACTIVE' : 'DISABLED';
  return row;
}

const duplicate = () => Object.assign(new Error('Username or email already exists.'), { status: 409 });

export async function findUserByUsername(username) {
  try {
    return await prisma.user.findUnique({ where: { username } });
  } catch (_e) {
    return memoryUsers.find((u) => u.username === username) || null;
  }
}

export async function findUserById(id) {
  try {
    return await prisma.user.findUnique({ where: { id } });
  } catch (_e) {
    return memoryUsers.find((u) => u.id === id) || null;
  }
}

export async function listUsers({ roles } = {}) {
  const where = roles ? { role: { in: roles } } : {};
  try {
    return await prisma.user.findMany({ where, orderBy: [{ role: 'asc' }, { username: 'asc' }] });
  } catch (_e) {
    return memoryUsers
      .filter((u) => !roles || roles.includes(u.role))
      .sort((a, b) => a.role.localeCompare(b.role) || a.username.localeCompare(b.username));
  }
}

export async function createUser(fields) {
  const data = await toRow({ ...fields, fullName: fields.fullName || fields.username });
  try {
    return await prisma.user.create({ data });
  } catch (err) {
    if (err?.code === 'P2002') throw duplicate();
    if (memoryUsers.some((u) => u.username === data.username)) throw duplicate();
    const now = new Date();
    const row = {
      id: memoryNextId++, email: null, phone: null, barangayId: null, status: 'ACTIVE',
      lastLoginAt: null, createdAt: now, updatedAt: now, ...data,
    };
    memoryUsers.push(row);
    return row;
  }
}

export async function updateUser(id, fields) {
  const data = await toRow(fields);
  try {
    return await prisma.user.update({ where: { id }, data });
  } catch (err) {
    if (err?.code === 'P2025') return null;
    if (err?.code === 'P2002') throw duplicate();
    const row = memoryUsers.find((u) => u.id === id);
    if (!row) return null;
    Object.assign(row, data, { updatedAt: new Date() });
    return row;
  }
}

export async function deleteUser(id) {
  try {
    await prisma.user.delete({ where: { id } });
    return true;
  } catch (err) {
    if (err?.code === 'P2025') return false;
    const idx = memoryUsers.findIndex((u) => u.id === id);
    if (idx === -1) return false;
    memoryUsers.splice(idx, 1);
    return true;
  }
}

export async function verifyLogin(username, password) {
  const user = await findUserByUsername(username);
  if (!user || user.status !== 'ACTIVE') return null;
  if (!verifySecret(password, user.passwordHash)) return null;
  await updateUser(user.id, { lastLoginAt: new Date() });
  return user;
}

/**
 * Ensure the bootstrap accounts exist:
 *  - SUPERADMIN from ADMIN_USERNAME / ADMIN_PASSWORD (only created once — after that,
 *    change the password from Settings or with `npm run account:reset-password`)
 *  - Demo MDRRMO + Barangay accounts when SEED_DEMO_ACCOUNTS=true
 *
 * Safety for a real database: the SUPERADMIN is not seeded with a weak password
 * (< 10 chars or equal to the username), and demo accounts are only seeded into
 * the database when SEED_DEMO_ACCOUNTS=force.
 */
export async function seedAccounts() {
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD;

  let usingDatabase = true;
  try { await prisma.user.count(); } catch (_e) { usingDatabase = false; }

  if (adminPass && !(await findUserByUsername(adminUser))) {
    const weak = adminPass.length < 10 || adminPass === adminUser;
    if (usingDatabase && weak) {
      console.warn(`[Accounts] NOT seeding SUPERADMIN "${adminUser}": ADMIN_PASSWORD is too weak for a real database (min 10 chars, not the username).`);
    } else {
      await createUser({ username: adminUser, password: adminPass, fullName: 'System Super Administrator', role: ROLES.SUPERADMIN });
      console.log(`[Accounts] Seeded SUPERADMIN "${adminUser}"${usingDatabase ? '' : ' (in-memory)'}`);
    }
  }

  const demoFlag = process.env.SEED_DEMO_ACCOUNTS;
  if (demoFlag === 'force' || (demoFlag === 'true' && !usingDatabase)) {
    const demoPass = process.env.DEMO_ACCOUNT_PASSWORD || 'smartflood2026';
    const demos = [
      { username: 'mdrrmo',   fullName: 'Antipolo CDRRMO Operator',  role: ROLES.MDRRMO },
      { username: 'brgy.mayamot', fullName: 'Mayamot BDRRM Staff',   role: ROLES.BARANGAY, barangay: 'Mayamot' },
    ];
    for (const d of demos) {
      if (!(await findUserByUsername(d.username))) {
        await createUser({ ...d, password: demoPass });
        console.log(`[Accounts] Seeded demo ${d.role} "${d.username}"`);
      }
    }
  } else if (demoFlag === 'true' && usingDatabase) {
    console.log('[Accounts] SEED_DEMO_ACCOUNTS=true ignored on a real database (use "force" to seed demo accounts there).');
  }
}
