import { PrismaClient } from '@prisma/client'
import { resolveEffectivePermissions } from '../lib/rolePresets'

/**
 * Grant (or revoke) a single permission on a user, by email.
 *
 * Exists because permissions can only be changed by a true ADMIN through the
 * app, so a non-ADMIN account cannot unblock itself — including for permissions
 * added to the code after that account's record was last saved.
 *
 * Usage:
 *   npx tsx tools/grant-permission.ts <email> <module.action> [true|false]
 *
 * Against Railway production:
 *   railway run npx tsx tools/grant-permission.ts you@example.com settings.manageMetrics
 *
 * Reads DATABASE_URL from the environment, so it acts on whichever database that
 * points at. It prints the target database host before writing.
 */

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]
  const path = process.argv[3]
  const valueArg = (process.argv[4] ?? 'true').toLowerCase()

  if (!email || !path) {
    console.error('Usage: npx tsx tools/grant-permission.ts <email> <module.action> [true|false]')
    console.error('Example: npx tsx tools/grant-permission.ts you@example.com settings.manageMetrics')
    process.exit(1)
  }

  const [module, action] = path.split('.')
  if (!module || !action) {
    console.error(`Invalid permission path "${path}". Expected <module>.<action>, e.g. settings.manageMetrics`)
    process.exit(1)
  }

  if (valueArg !== 'true' && valueArg !== 'false') {
    console.error(`Invalid value "${valueArg}". Expected true or false.`)
    process.exit(1)
  }
  const value = valueArg === 'true'

  // Show which database is about to be written to. Host only — never the
  // password, since this output tends to end up pasted into chat logs.
  try {
    const url = new URL(process.env.DATABASE_URL ?? '')
    console.log(`Database: ${url.hostname}:${url.port || '5432'}${url.pathname}`)
  } catch {
    console.error('DATABASE_URL is not set or is not a valid URL.')
    process.exit(1)
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, permissions: true },
  })

  if (!user) {
    console.error(`No user found with email "${email}".`)
    const all = await prisma.user.findMany({ select: { email: true, role: true } })
    console.error('Users in this database:')
    for (const u of all) console.error(`  ${u.email}  (${u.role})`)
    process.exit(1)
  }

  if (user.role === 'ADMIN') {
    console.log(`\n${user.email} is ADMIN and already passes every permission check.`)
    console.log('Nothing to change. If something is still denied, the cause is not permissions.')
    return
  }

  // Start from the effective set so untouched keys keep their role default
  // rather than being written back as explicit denials.
  const effective = resolveEffectivePermissions(user.role, user.permissions) as unknown as Record<
    string,
    Record<string, boolean>
  >

  if (!(module in effective)) {
    console.error(`\nUnknown permission module "${module}". Available modules:`)
    for (const key of Object.keys(effective)) console.error(`  ${key}`)
    process.exit(1)
  }
  if (!(action in effective[module])) {
    console.error(`\nUnknown action "${action}" on module "${module}". Available actions:`)
    for (const key of Object.keys(effective[module])) console.error(`  ${module}.${key}`)
    process.exit(1)
  }

  const before = effective[module][action]
  const updated = {
    ...effective,
    [module]: { ...effective[module], [action]: value },
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { permissions: updated },
  })

  console.log(`\n${user.email}  (role ${user.role})`)
  console.log(`  ${path}: ${before} -> ${value}`)
  console.log('\nThe session JWT revalidates against the database within 60 seconds.')
  console.log('Sign out and back in for it to take effect immediately.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
