// ─── Trigger types ─────────────────────────────────────────────────────────────

export type TriggerType =
  | 'CONTACT_CREATED'
  | 'APPOINTMENT_BOOKED'
  | 'APPOINTMENT_NO_SHOW'
  | 'OPPORTUNITY_STAGE_CHANGED'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_FAILED'
  | 'TAG_ADDED'
  | 'TASK_COMPLETED'
  | 'MANUAL'

export const TRIGGER_LABELS: Record<TriggerType, string> = {
  CONTACT_CREATED: 'Contact Created',
  APPOINTMENT_BOOKED: 'Appointment Booked',
  APPOINTMENT_NO_SHOW: 'Appointment No-Show',
  OPPORTUNITY_STAGE_CHANGED: 'Stage Changed',
  PAYMENT_RECEIVED: 'Payment Received',
  PAYMENT_FAILED: 'Payment Failed',
  TAG_ADDED: 'Tag Added',
  TASK_COMPLETED: 'Task Completed',
  MANUAL: 'Manual Trigger',
}

// ─── Step types ────────────────────────────────────────────────────────────────

export type StepType =
  | 'EMAIL'
  | 'SMS'
  | 'WAIT'
  | 'BRANCH'
  | 'TASK'
  | 'TAG'
  | 'STAGE_MOVE'
  | 'WEBHOOK'

export const STEP_LABELS: Record<StepType, string> = {
  EMAIL: 'Email',
  SMS: 'SMS',
  WAIT: 'Wait',
  BRANCH: 'Branch',
  TASK: 'Task',
  TAG: 'Tag',
  STAGE_MOVE: 'Stage Move',
  WEBHOOK: 'Webhook',
}

export const STEP_BORDER_COLORS: Record<StepType, string> = {
  EMAIL: '#3B82F6',
  SMS: '#22C55E',
  WAIT: '#9CA3AF',
  BRANCH: '#F59E0B',
  TASK: '#A855F7',
  TAG: '#14B8A6',
  STAGE_MOVE: '#F97316',
  WEBHOOK: '#EF4444',
}

// Steps that allow copy editing in the CRM
export const COPY_EDITABLE_TYPES: StepType[] = ['EMAIL', 'SMS', 'TASK']

// ─── Step configs ─────────────────────────────────────────────────────────────

export interface EmailConfig {
  subject: string
  body: string
}

export interface SmsConfig {
  body: string
}

export interface WaitConfig {
  duration: number
  unit: 'days' | 'hours' | 'business_days'
}

export interface BranchConfig {
  condition: AutomationCondition
  yes: string
  no: string
}

export interface TaskConfig {
  title: string
  description?: string
  dueDays?: number
  priority?: 'LOW' | 'MEDIUM' | 'HIGH'
}

export interface TagConfig {
  action: 'add' | 'remove'
  tag: string
}

export interface StageMoveConfig {
  pipelineId?: string
  stageName: string
}

export interface WebhookConfig {
  url: string
  method?: 'POST' | 'GET' | 'PUT' | 'PATCH'
  payload?: Record<string, unknown>
}

// ─── Core types ────────────────────────────────────────────────────────────────

export interface AutomationCondition {
  field: string
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'exists'
    | 'not_exists'
    | 'greater_than'
    | 'less_than'
  value?: string
}

export interface AutomationStep {
  id: string
  type: StepType
  label: string
  config:
    | EmailConfig
    | SmsConfig
    | WaitConfig
    | BranchConfig
    | TaskConfig
    | TagConfig
    | StageMoveConfig
    | WebhookConfig
    | Record<string, unknown>
}

export interface AutomationDefinition {
  name: string
  description?: string
  trigger: TriggerType
  triggerConfig?: Record<string, unknown>
  conditions?: AutomationCondition[]
  steps: AutomationStep[]
}

// ─── Execution types ───────────────────────────────────────────────────────────

export type StepStatus = 'success' | 'skipped' | 'error'

export interface StepLog {
  stepId: string
  stepLabel: string
  type: StepType
  status: StepStatus
  detail: string
  durationMs: number
}

// ─── Validation ────────────────────────────────────────────────────────────────

const VALID_TRIGGERS: TriggerType[] = [
  'CONTACT_CREATED',
  'APPOINTMENT_BOOKED',
  'APPOINTMENT_NO_SHOW',
  'OPPORTUNITY_STAGE_CHANGED',
  'PAYMENT_RECEIVED',
  'PAYMENT_FAILED',
  'TAG_ADDED',
  'TASK_COMPLETED',
  'MANUAL',
]

const VALID_STEP_TYPES: StepType[] = [
  'EMAIL', 'SMS', 'WAIT', 'BRANCH', 'TASK', 'TAG', 'STAGE_MOVE', 'WEBHOOK',
]

export function validateAutomationJson(raw: unknown): {
  valid: boolean
  errors: string[]
  definition?: AutomationDefinition
} {
  const errors: string[] = []
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['Must be a JSON object'] }
  }
  const obj = raw as Record<string, unknown>

  if (!obj.name || typeof obj.name !== 'string') errors.push('name is required (string)')
  if (!obj.trigger || typeof obj.trigger !== 'string') {
    errors.push('trigger is required (string)')
  } else if (!VALID_TRIGGERS.includes(obj.trigger as TriggerType)) {
    errors.push(`trigger must be one of: ${VALID_TRIGGERS.join(', ')}`)
  }

  if (!Array.isArray(obj.steps)) {
    errors.push('steps must be an array')
  } else {
    const stepIds = new Set<string>()
    obj.steps.forEach((step: unknown, i: number) => {
      if (!step || typeof step !== 'object' || Array.isArray(step)) {
        errors.push(`steps[${i}] must be an object`)
        return
      }
      const s = step as Record<string, unknown>
      if (!s.id || typeof s.id !== 'string') errors.push(`steps[${i}].id is required`)
      else {
        if (stepIds.has(s.id as string)) errors.push(`steps[${i}].id "${s.id}" is duplicate`)
        stepIds.add(s.id as string)
      }
      if (!s.type || !VALID_STEP_TYPES.includes(s.type as StepType)) {
        errors.push(`steps[${i}].type must be one of: ${VALID_STEP_TYPES.join(', ')}`)
      }
      if (!s.label || typeof s.label !== 'string') errors.push(`steps[${i}].label is required`)
      if (!s.config || typeof s.config !== 'object') errors.push(`steps[${i}].config is required`)
    })
    // Validate BRANCH targets exist
    obj.steps.forEach((step: unknown) => {
      const s = step as Record<string, unknown>
      if (s.type === 'BRANCH') {
        const cfg = (s.config as Record<string, unknown>) ?? {}
        if (cfg.yes && !stepIds.has(cfg.yes as string)) {
          errors.push(`BRANCH step "${s.id}" yes target "${cfg.yes}" not found`)
        }
        if (cfg.no && !stepIds.has(cfg.no as string)) {
          errors.push(`BRANCH step "${s.id}" no target "${cfg.no}" not found`)
        }
      }
    })
  }

  if (errors.length > 0) return { valid: false, errors }
  return { valid: true, errors: [], definition: obj as unknown as AutomationDefinition }
}

// ─── Template interpolation ────────────────────────────────────────────────────

export function interpolate(template: string, contact: Record<string, unknown>): string {
  return template.replace(/\{\{contact\.(\w+)\}\}/g, (_, key) => {
    const val = contact[key]
    return val != null ? String(val) : ''
  })
}
