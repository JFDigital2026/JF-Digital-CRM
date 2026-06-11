export type PermissionsJson = {
  dashboard: { view: boolean }
  contacts: { view: boolean; create: boolean; edit: boolean; delete: boolean; import: boolean; export: boolean }
  companies: { view: boolean; create: boolean; edit: boolean; delete: boolean }
  pipelines: { view: boolean; create: boolean; edit: boolean; delete: boolean; managePipelines: boolean }
  calendar: { view: boolean; create: boolean; edit: boolean; delete: boolean; manageSettings: boolean }
  inbox: { view: boolean; reply: boolean }
  tasks: { view: boolean; create: boolean; edit: boolean; delete: boolean }
  products: { view: boolean; create: boolean; edit: boolean; delete: boolean }
  automations: { view: boolean; test: boolean; toggleActive: boolean }
  metrics: { view: boolean; export: boolean }
  aiAssistant: { view: boolean }
  settings: { view: boolean; manageUsers: boolean; manageApi: boolean; manageIntegrations: boolean; manageCustomFields: boolean }
}

export const ADMIN_PERMISSIONS: PermissionsJson = {
  dashboard: { view: true },
  contacts: { view: true, create: true, edit: true, delete: true, import: true, export: true },
  companies: { view: true, create: true, edit: true, delete: true },
  pipelines: { view: true, create: true, edit: true, delete: true, managePipelines: true },
  calendar: { view: true, create: true, edit: true, delete: true, manageSettings: true },
  inbox: { view: true, reply: true },
  tasks: { view: true, create: true, edit: true, delete: true },
  products: { view: true, create: true, edit: true, delete: true },
  automations: { view: true, test: true, toggleActive: true },
  metrics: { view: true, export: true },
  aiAssistant: { view: true },
  settings: { view: true, manageUsers: true, manageApi: true, manageIntegrations: true, manageCustomFields: true },
}

export const MANAGER_PERMISSIONS: PermissionsJson = {
  dashboard: { view: true },
  contacts: { view: true, create: true, edit: true, delete: false, import: true, export: true },
  companies: { view: true, create: true, edit: true, delete: false },
  pipelines: { view: true, create: true, edit: true, delete: false, managePipelines: true },
  calendar: { view: true, create: true, edit: true, delete: false, manageSettings: false },
  inbox: { view: true, reply: true },
  tasks: { view: true, create: true, edit: true, delete: false },
  products: { view: true, create: true, edit: true, delete: false },
  automations: { view: true, test: false, toggleActive: true },
  metrics: { view: true, export: true },
  aiAssistant: { view: true },
  settings: { view: false, manageUsers: false, manageApi: false, manageIntegrations: false, manageCustomFields: false },
}

export const SALES_REP_PERMISSIONS: PermissionsJson = {
  dashboard: { view: true },
  contacts: { view: true, create: true, edit: true, delete: false, import: false, export: false },
  companies: { view: true, create: true, edit: true, delete: false },
  pipelines: { view: true, create: false, edit: true, delete: false, managePipelines: false },
  calendar: { view: true, create: true, edit: true, delete: false, manageSettings: false },
  inbox: { view: true, reply: true },
  tasks: { view: true, create: true, edit: true, delete: false },
  products: { view: true, create: false, edit: false, delete: false },
  automations: { view: true, test: false, toggleActive: false },
  metrics: { view: true, export: false },
  aiAssistant: { view: true },
  settings: { view: false, manageUsers: false, manageApi: false, manageIntegrations: false, manageCustomFields: false },
}

export const SUPPORT_PERMISSIONS: PermissionsJson = {
  dashboard: { view: true },
  contacts: { view: true, create: false, edit: true, delete: false, import: false, export: false },
  companies: { view: true, create: false, edit: false, delete: false },
  pipelines: { view: true, create: false, edit: false, delete: false, managePipelines: false },
  calendar: { view: true, create: true, edit: false, delete: false, manageSettings: false },
  inbox: { view: true, reply: true },
  tasks: { view: true, create: true, edit: true, delete: false },
  products: { view: true, create: false, edit: false, delete: false },
  automations: { view: true, test: false, toggleActive: false },
  metrics: { view: true, export: false },
  aiAssistant: { view: true },
  settings: { view: false, manageUsers: false, manageApi: false, manageIntegrations: false, manageCustomFields: false },
}

export const ROLE_PRESETS: Record<string, PermissionsJson> = {
  ADMIN: ADMIN_PERMISSIONS,
  MANAGER: MANAGER_PERMISSIONS,
  SALES_REP: SALES_REP_PERMISSIONS,
  SUPPORT: SUPPORT_PERMISSIONS,
  CUSTOM: SALES_REP_PERMISSIONS, // starts with SALES_REP defaults
}

export function getPresetForRole(role: string): PermissionsJson {
  return ROLE_PRESETS[role] ?? SALES_REP_PERMISSIONS
}
