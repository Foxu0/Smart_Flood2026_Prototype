// ==============================================================================
// SmartFlood — Role & permission matrix (shared by server and frontend)
// Edit this one file to change who can do what.
// ==============================================================================

export const ROLES = {
  SUPERADMIN: 'SUPERADMIN',
  MDRRMO:     'MDRRMO',
  BARANGAY:   'BARANGAY',
  SYSTEM:     'SYSTEM',
};

export const ROLE_LABELS = {
  SUPERADMIN: 'Super Admin',
  MDRRMO:     'MDRRMO / CDRRMO',
  BARANGAY:   'Barangay DRRM Staff',
  SYSTEM:     'System Service',
};

// Roles that may sign in to the staff console (/admin). SYSTEM is a non-interactive identity.
// Residents do not have accounts: they use the public dashboard at / anonymously.
export const STAFF_ROLES = [ROLES.SUPERADMIN, ROLES.MDRRMO, ROLES.BARANGAY];

const { SUPERADMIN, MDRRMO, BARANGAY } = ROLES;

export const PERMISSIONS = {
  'dashboard.view':      [MDRRMO, BARANGAY],               // river monitoring (Super Admin manages the system instead)
  'devices.view':        [SUPERADMIN, MDRRMO, BARANGAY],
  'devices.manage':      [SUPERADMIN, MDRRMO, BARANGAY],   // add board, edit, replace, rotate key (Barangay: own only)
  'devices.maintenance': [SUPERADMIN, MDRRMO, BARANGAY],   // toggle maintenance mode (Barangay: own only)
  'alerts.view':         [MDRRMO, BARANGAY],               // alert history, sent messages, subscribers
  'thresholds.manage':   [SUPERADMIN, MDRRMO],
  'reports.view':        [SUPERADMIN, MDRRMO, BARANGAY],
  'control.siren':       [MDRRMO, BARANGAY],
  'residents.manage':    [MDRRMO, BARANGAY],               // add/remove residents who get SMS or email alerts (Barangay: own only)
  'users.manage':        [SUPERADMIN, MDRRMO],
  'audit.view':          [SUPERADMIN],
  'system.maintenance':  [SUPERADMIN],                     // reset/purge test data
};

// Which roles each role may create / edit in User Management
export const MANAGEABLE_ROLES = {
  SUPERADMIN: [MDRRMO, BARANGAY],   // only one Super Admin (created at setup) — it can't be added or edited here
  MDRRMO:     [BARANGAY],
};

// Roles whose data access is limited to their own barangay
export const BARANGAY_SCOPED_ROLES = [BARANGAY];

export function can(role, permission) {
  return (PERMISSIONS[permission] || []).includes(role);
}

export const SENSOR_TYPES = {
  WATER_LEVEL:   'Water level',
  FLOW_SPEED:    'Water speed',
};

// Antipolo City barangays (16)
export const BARANGAYS = [
  'Bagong Nayon', 'Beverly Hills', 'Calawis', 'Cupang', 'Dalig', 'Dela Paz',
  'Inarawan', 'Mambugan', 'Mayamot', 'Muntindilaw', 'San Isidro', 'San Jose',
  'San Juan', 'San Luis', 'San Roque', 'Santa Cruz',
];
