export type PermissionsJson = {
  dashboard: { view: boolean }
  contacts: { view: boolean; create: boolean; edit: boolean; delete: boolean; import: boolean; export: boolean }
  companies: { view: boolean; create: boolean; edit: boolean; delete: boolean }
  pipelines: { view: boolean; create: boolean; edit: boolean; delete: boolean; managePipelines: boolean }
  calendar: { view: boolean; create: boolean; edit: boolean; delete: boolean; manageSettings: boolean }
  inbox: { view: boolean; reply: boolean }
  tasks: { view: boolean; create: boolean; edit: boolean; delete: boolean }
  products: { view: boolean; create: boolean; edit: boolean; delete: boolean }
  billing: { view: boolean; manage: boolean }
  automations: { view: boolean; test: boolean; toggleActive: boolean }
  metrics: { view: boolean; export: boolean }
  aiAssistant: { view: boolean }
  settings: { view: boolean; manageUsers: boolean; manageApi: boolean; manageIntegrations: boolean; manageCustomFields: boolean; manageMetrics: boolean }
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
  billing: { view: true, manage: true },
  automations: { view: true, test: true, toggleActive: true },
  metrics: { view: true, export: true },
  aiAssistant: { view: true },
  settings: { view: true, manageUsers: true, manageApi: true, manageIntegrations: true, manageCustomFields: true, manageMetrics: true },
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
  billing: { view: true, manage: true },
  automations: { view: true, test: false, toggleActive: true },
  metrics: { view: true, export: true },
  aiAssistant: { view: true },
  settings: { view: false, manageUsers: false, manageApi: false, manageIntegrations: false, manageCustomFields: false, manageMetrics: false },
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
  billing: { view: true, manage: false },
  automations: { view: true, test: false, toggleActive: false },
  metrics: { view: true, export: false },
  aiAssistant: { view: true },
  settings: { view: false, manageUsers: false, manageApi: false, manageIntegrations: false, manageCustomFields: false, manageMetrics: false },
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
  billing: { view: false, manage: false },
  automations: { view: true, test: false, toggleActive: false },
  metrics: { view: true, export: false },
  aiAssistant: { view: true },
  settings: { view: false, manageUsers: false, manageApi: false, manageIntegrations: false, manageCustomFields: false, manageMetrics: false },
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

/**
 * Resolve a user's effective permissions: their stored overrides layered on top
 * of their role's preset.
 *
 * Why layered rather than "stored wins outright": a permissions record is a
 * snapshot of the modules that existed when it was last saved. Every time a new
 * permission is added to PermissionsJson, every previously-saved record lacks
 * that key — and `mod[action] === true` on an absent key is false. The result is
 * a user with "full permissions" in the editor silently losing access to each
 * new feature until an admin re-saves them, one user at a time.
 *
 * Layering fixes that permanently: a key the user has an explicit value for
 * (including `false`) is respected, and a key they have never been asked about
 * falls back to what their role would grant. This can never grant more than the
 * role preset already allows, so it does not widen anyone's access.
 */
export function resolveEffectivePermissions(
  role: string,
  stored: unknown
): PermissionsJson {
  const preset = getPresetForRole(role)
  const overrides = (stored ?? {}) as Record<string, Record<string, boolean>>
  if (Object.keys(overrides).length === 0) return preset

  const merged: Record<string, Record<string, boolean>> = {}
  for (const [module, actions] of Object.entries(preset as unknown as Record<string, Record<string, boolean>>)) {
    merged[module] = { ...actions, ...(overrides[module] ?? {}) }
  }
  // Keep any module present in the stored record but absent from the preset, so
  // a permission removed from the code doesn't silently drop a user's override.
  for (const [module, actions] of Object.entries(overrides)) {
    if (!merged[module]) merged[module] = { ...actions }
  }
  return merged as unknown as PermissionsJson
}
