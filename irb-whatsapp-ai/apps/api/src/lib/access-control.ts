export type AccessScope = {
  allCostCenters: boolean;
  costCenterIds: string[];
  units: string[];
};

export type PermissionOverrides = {
  allow: string[];
  deny: string[];
};

export const PERMISSION_GROUPS = {
  workspace: [
    'dashboard.view',
    'conversations.view',
    'teleconsulta.view',
    'schedules.view',
    'opd.view',
    'billing.view',
    'lab.view',
    'pharmacy.view',
    'metrics.view',
    'subscriptions.view',
  ],
  finance: [
    'finance.view',
    'finance.payable.view',
    'finance.payable.approve',
    'finance.payable.pay',
    'finance.receivable.view',
    'finance.receivable.receive',
    'finance.daily.view',
    'finance.cashflow.view',
    'finance.cashflow.import_statement',
    'finance.reimbursements.view',
    'finance.orders.view',
    'finance.cadastros.view',
  ],
  crm: [
    'crm.leads.view',
    'crm.leads.manage',
    'crm.campaigns.manage',
    'crm.metrics.view',
  ],
  admin: [
    'settings.view',
    'users.manage',
  ],
} as const;

export const ALL_PERMISSIONS = Object.values(PERMISSION_GROUPS).flat();

export const ACCESS_PROFILES = {
  super_admin: {
    label: 'Super Admin',
    permissions: ALL_PERMISSIONS,
  },
  finance_director: {
    label: 'Diretoria Financeira',
    permissions: [
      'dashboard.view',
      'metrics.view',
      'finance.view',
      'finance.payable.view',
      'finance.payable.approve',
      'finance.payable.pay',
      'finance.receivable.view',
      'finance.receivable.receive',
      'finance.daily.view',
      'finance.cashflow.view',
      'finance.cashflow.import_statement',
      'finance.reimbursements.view',
      'finance.orders.view',
      'finance.cadastros.view',
      'crm.leads.view',
      'crm.leads.manage',
      'crm.campaigns.manage',
      'crm.metrics.view',
    ],
  },
  finance_analyst: {
    label: 'Analista Financeiro',
    permissions: [
      'dashboard.view',
      'finance.view',
      'finance.payable.view',
      'finance.payable.approve',
      'finance.receivable.view',
      'finance.receivable.receive',
      'finance.daily.view',
      'finance.cashflow.view',
      'finance.cashflow.import_statement',
      'finance.reimbursements.view',
      'finance.orders.view',
      'finance.cadastros.view',
    ],
  },
  finance_operator: {
    label: 'Operação Financeira',
    permissions: [
      'dashboard.view',
      'finance.view',
      'finance.payable.view',
      'finance.receivable.view',
      'finance.daily.view',
      'finance.cashflow.view',
      'finance.reimbursements.view',
      'finance.orders.view',
      'finance.cadastros.view',
    ],
  },
  attendant_basic: {
    label: 'Atendimento',
    permissions: [
      'dashboard.view',
      'conversations.view',
      'teleconsulta.view',
      'schedules.view',
      'subscriptions.view',
    ],
  },
} as const;

export type AccessProfileKey = keyof typeof ACCESS_PROFILES;

export function normalizeOverrides(input?: Partial<PermissionOverrides> | null): PermissionOverrides {
  return {
    allow: Array.isArray(input?.allow) ? [...new Set(input!.allow.filter(Boolean))] : [],
    deny: Array.isArray(input?.deny) ? [...new Set(input!.deny.filter(Boolean))] : [],
  };
}

export function normalizeScope(input?: Partial<AccessScope> | null): AccessScope {
  return {
    allCostCenters: input?.allCostCenters !== false,
    costCenterIds: Array.isArray(input?.costCenterIds) ? [...new Set(input!.costCenterIds.filter(Boolean))] : [],
    units: Array.isArray(input?.units) ? [...new Set(input!.units.filter(Boolean))] : [],
  };
}

export function resolvePermissions(input: {
  role?: string | null;
  accessProfile?: string | null;
  permissionOverrides?: Partial<PermissionOverrides> | null;
}) {
  if (input.role === 'admin') return ALL_PERMISSIONS;

  const profileKey = (input.accessProfile || 'attendant_basic') as AccessProfileKey;
  const basePermissions = [...(ACCESS_PROFILES[profileKey]?.permissions || ACCESS_PROFILES.attendant_basic.permissions)] as string[];
  const overrides = normalizeOverrides(input.permissionOverrides);

  return [...new Set(
    basePermissions.filter((permission) => !overrides.deny.includes(permission)).concat(overrides.allow),
  )];
}

export function hasPermission(user: { role?: string | null; permissions?: string[] | null }, permission: string) {
  if (user.role === 'admin') return true;
  return Array.isArray(user.permissions) && user.permissions.includes(permission);
}

export function getAccessModel() {
  return {
    profiles: Object.entries(ACCESS_PROFILES).map(([key, value]) => ({
      key,
      label: value.label,
      permissions: value.permissions,
    })),
    permissionGroups: PERMISSION_GROUPS,
    allPermissions: ALL_PERMISSIONS,
  };
}
