import fs from 'fs'
import path from 'path'
import { prisma } from './prisma'
import { validateAutomationJson } from './automation-types'

const AUTOMATIONS_DIR = path.join(process.cwd(), 'automations')

function slugFromPath(filePath: string): string {
  return path.basename(filePath)
}

export async function ensureAutomationsDir() {
  if (!fs.existsSync(AUTOMATIONS_DIR)) {
    fs.mkdirSync(AUTOMATIONS_DIR, { recursive: true })
  }
}

async function getSystemUserId(): Promise<string | null> {
  const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } })
  return user?.id ?? null
}

export async function syncAutomationFile(filePath: string): Promise<void> {
  if (!filePath.endsWith('.json')) return
  const sourceFile = slugFromPath(filePath)

  let raw: unknown
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    raw = JSON.parse(content)
  } catch (err) {
    console.error(`[AutomationSync] Failed to read ${sourceFile}:`, err)
    // Mark as schema error if a record exists
    await prisma.automation.updateMany({
      where: { sourceFile },
      data: { syncStatus: 'SCHEMA_ERROR', lastSyncedAt: new Date() },
    })
    return
  }

  const { valid, errors, definition } = validateAutomationJson(raw)
  if (!valid || !definition) {
    console.error(`[AutomationSync] Schema error in ${sourceFile}:`, errors)
    await prisma.automation.updateMany({
      where: { sourceFile },
      data: { syncStatus: 'SCHEMA_ERROR', lastSyncedAt: new Date() },
    })
    return
  }

  const userId = await getSystemUserId()
  if (!userId) {
    console.warn('[AutomationSync] No user found — skipping sync')
    return
  }

  try {
    await prisma.automation.upsert({
      where: { userId_sourceFile: { userId, sourceFile } },
      create: {
        name: definition.name,
        description: definition.description ?? null,
        sourceFile,
        trigger: definition.trigger,
        triggerConfig: JSON.parse(JSON.stringify(definition.triggerConfig ?? {})),
        conditions: JSON.parse(JSON.stringify(definition.conditions ?? [])),
        steps: JSON.parse(JSON.stringify(definition.steps)),
        syncStatus: 'SYNCED',
        lastSyncedAt: new Date(),
        userId,
      },
      update: {
        name: definition.name,
        description: definition.description ?? null,
        trigger: definition.trigger,
        triggerConfig: JSON.parse(JSON.stringify(definition.triggerConfig ?? {})),
        conditions: JSON.parse(JSON.stringify(definition.conditions ?? [])),
        steps: JSON.parse(JSON.stringify(definition.steps)),
        syncStatus: 'SYNCED',
        lastSyncedAt: new Date(),
      },
    })
    console.log(`[AutomationSync] Synced ${sourceFile}`)
  } catch (err) {
    console.error(`[AutomationSync] DB error for ${sourceFile}:`, err)
  }
}

export async function removeAutomationFile(filePath: string): Promise<void> {
  const sourceFile = slugFromPath(filePath)
  await prisma.automation.updateMany({
    where: { sourceFile },
    data: { active: false, syncStatus: 'FILE_MISSING' },
  })
  console.log(`[AutomationSync] Marked ${sourceFile} as FILE_MISSING`)
}

export async function scanAndSyncAll(): Promise<{ synced: number; errors: number }> {
  await ensureAutomationsDir()
  let synced = 0
  let errors = 0

  const files = fs.readdirSync(AUTOMATIONS_DIR).filter((f) => f.endsWith('.json'))

  for (const file of files) {
    const filePath = path.join(AUTOMATIONS_DIR, file)
    const sizeBefore = (await prisma.automationLog.count())
    await syncAutomationFile(filePath)
    const sizeAfter = (await prisma.automationLog.count())
    void sizeAfter; void sizeBefore
    // Check if it synced OK
    const userId = await getSystemUserId()
    if (userId) {
      const record = await prisma.automation.findUnique({
        where: { userId_sourceFile: { userId, sourceFile: file } },
      })
      if (record?.syncStatus === 'SYNCED') synced++
      else errors++
    }
  }

  return { synced, errors }
}
