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
  'dashboard.view':      [SUPERADMIN, MDRRMO, BARANGAY],
  'notifications.view':  [SUPERADMIN, MDRRMO, BARANGAY],
  'devices.view':        [SUPERADMIN, MDRRMO, BARANGAY],
  'devices.manage':      [SUPERADMIN, MDRRMO, BARANGAY],   // add board, edit, replace, rotate key (Barangay: own only)
  'devices.maintenance': [SUPERADMIN, MDRRMO, BARANGAY],   // toggle maintenance mode (Barangay: own only)
  'devices.delete':      [SUPERADMIN],
  'alerts.manage':       [SUPERADMIN, MDRRMO],             // broadcast / manage alerts
  'thresholds.manage':   [SUPERADMIN, MDRRMO],
  'reports.view':        [SUPERADMIN, MDRRMO, BARANGAY],
  'settings.system':     [SUPERADMIN, MDRRMO],             // system-wide settings
  'control.siren':       [SUPERADMIN, MDRRMO, BARANGAY],
  'subscribers.manage':  [SUPERADMIN, MDRRMO],
  'users.manage':        [SUPERADMIN, MDRRMO],
  'audit.view':          [SUPERADMIN],
  'system.maintenance':  [SUPERADMIN],                     // reset/purge test data
};

// Which roles each role may create / edit in User Management
export const MANAGEABLE_ROLES = {
  SUPERADMIN: [SUPERADMIN, MDRRMO, BARANGAY],
  MDRRMO:     [BARANGAY],
};

// Roles whose data access is limited to their own barangay
export const BARANGAY_SCOPED_ROLES = [BARANGAY];

export function can(role, permission) {
  return (PERMISSIONS[permission] || []).includes(role);
}

export const DEVICE_STATUSES = ['ACTIVE', 'MAINTENANCE', 'OFFLINE', 'RETIRED'];
export const SENSOR_TYPES = {
  WATER_LEVEL:   'Water Level (Ultrasonic)',
  FLOW_SPEED:    'Water Current Speed',
};

// Antipolo City barangays (16)
export const BARANGAYS = [
  'Bagong Nayon', 'Beverly Hills', 'Calawis', 'Cupang', 'Dalig', 'Dela Paz',
  'Inarawan', 'Mambugan', 'Mayamot', 'Muntindilaw', 'San Isidro', 'San Jose',
  'San Juan', 'San Luis', 'San Roque', 'Santa Cruz',
];
