export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startAutomationWatcher } = await import('./lib/automationWatcher')
    const { startQueueProcessor } = await import('./lib/queueProcessor')
    await startAutomationWatcher()
    startQueueProcessor()
  }
}
