/**
 * Reset an account's password from the command line.
 *
 *   npm run account:reset-password -- admin
 *     → sets "admin" to ADMIN_PASSWORD from .env (and re-activates the account)
 *
 *   npm run account:reset-password -- brgy.mayamot "NewPassword123"
 *     → sets the given password
 *
 * Use the User Accounts page for everyday resets; this is for when nobody can log in.
 */
import 'dotenv/config';
import { prisma } from '../db.js';
import { findUserByUsername, updateUser } from '../services/accountStore.js';

const [username, explicit] = process.argv.slice(2);
if (!username) {
  console.error('Usage: npm run account:reset-password -- <username> [newPassword]');
  process.exit(1);
}

const password = explicit || (username === (process.env.ADMIN_USERNAME || 'admin') ? process.env.ADMIN_PASSWORD : null);
if (!password || password.length < 10) {
  console.error('Give a new password (10+ characters), or set ADMIN_PASSWORD in .env when resetting the admin.');
  process.exit(1);
}

try {
  await prisma.$queryRaw`SELECT 1`;
} catch (err) {
  console.error('Database not reachable — check DATABASE_URL in .env.', err.message);
  process.exit(1);
}

const user = await findUserByUsername(username);
if (!user) {
  console.error(`No account named "${username}".`);
  process.exit(1);
}
await updateUser(user.id, { password, isActive: true });
console.log(`Password for "${username}" (${user.role}) has been reset${explicit ? '' : ' to ADMIN_PASSWORD from .env'}.`);
await prisma.$disconnect();
