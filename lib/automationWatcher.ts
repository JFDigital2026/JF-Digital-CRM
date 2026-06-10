import path from 'path'
import { scanAndSyncAll, syncAutomationFile, removeAutomationFile } from './automationSync'

const AUTOMATIONS_DIR = path.join(process.cwd(), 'automations')

let watcherStarted = false

export async function startAutomationWatcher() {
  if (watcherStarted) return
  watcherStarted = true

  // Initial scan on startup
  try {
    const { synced, errors } = await scanAndSyncAll()
    console.log(`[AutomationWatcher] Initial scan complete: ${synced} synced, ${errors} errors`)
  } catch (err) {
    console.error('[AutomationWatcher] Initial scan failed:', err)
  }

  // Start file watcher
  try {
    // Dynamic import to avoid issues in environments without chokidar
    const chokidar = await import('chokidar')
    const watcher = chokidar.default.watch(`${AUTOMATIONS_DIR}/*.json`, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    })

    watcher
      .on('add', async (filePath: string) => {
        console.log(`[AutomationWatcher] File added: ${path.basename(filePath)}`)
        await syncAutomationFile(filePath)
      })
      .on('change', async (filePath: string) => {
        console.log(`[AutomationWatcher] File changed: ${path.basename(filePath)}`)
        await syncAutomationFile(filePath)
      })
      .on('unlink', async (filePath: string) => {
        console.log(`[AutomationWatcher] File removed: ${path.basename(filePath)}`)
        await removeAutomationFile(filePath)
      })
      .on('error', (err: unknown) => {
        console.error('[AutomationWatcher] Watcher error:', err)
      })

    console.log(`[AutomationWatcher] Watching ${AUTOMATIONS_DIR}`)
  } catch (err) {
    console.warn('[AutomationWatcher] Could not start file watcher (chokidar unavailable):', err)
  }
}
