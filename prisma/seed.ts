import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // ─── Admin user ────────────────────────────────────────────────────────────
  const existing = await prisma.user.findUnique({ where: { email: 'admin@crm.com' } })

  if (!existing) {
    const hash = await bcrypt.hash('AdminCRM', 12)
    await prisma.user.create({
      data: {
        name: 'Admin',
        firstName: 'Admin',
        lastName: '',
        email: 'admin@crm.com',
        password: hash,
        role: 'ADMIN',
        active: true,
        permissions: {},
      },
    })
    console.log('Created admin user: admin@crm.com / AdminCRM')
  } else {
    console.log('Admin user already exists, skipping.')
  }

  // ─── Sample pipeline ───────────────────────────────────────────────────────
  const admin = await prisma.user.findUnique({ where: { email: 'admin@crm.com' } })
  if (!admin) throw new Error('Admin user not found after seed')

  const existingPipeline = await prisma.pipeline.findFirst({
    where: { userId: admin.id, name: 'Sales Pipeline' },
  })

  if (!existingPipeline) {
    const pipeline = await prisma.pipeline.create({
      data: {
        name: 'Sales Pipeline',
        userId: admin.id,
      },
    })

    const stages = [
      { name: 'Lead',        order: 0, color: '#778DA9' },
      { name: 'Qualified',   order: 1, color: '#415A77' },
      { name: 'Proposal',    order: 2, color: '#1B263B' },
      { name: 'Closed Won',  order: 3, color: '#0D1B2A' },
    ]

    for (const stage of stages) {
      await prisma.stage.create({
        data: { ...stage, pipelineId: pipeline.id },
      })
    }

    console.log(`Created pipeline "Sales Pipeline" with 4 stages.`)
  } else {
    console.log('Sample pipeline already exists, skipping.')
  }

  // ─── Default products ──────────────────────────────────────────────────────
  const existingSetupFee = await prisma.product.findFirst({
    where: { userId: admin.id, name: 'Setup Fee' },
  })

  if (!existingSetupFee) {
    await prisma.product.create({
      data: {
        name: 'Setup Fee',
        description: 'One-time setup charge',
        type: 'ONE_TIME',
        price: 0,
        active: true,
        userId: admin.id,
      },
    })
    console.log('Created product: Setup Fee')
  } else {
    console.log('Setup Fee product already exists, skipping.')
  }

  const existingRetainer = await prisma.product.findFirst({
    where: { userId: admin.id, name: 'Monthly Retainer' },
  })

  if (!existingRetainer) {
    await prisma.product.create({
      data: {
        name: 'Monthly Retainer',
        description: 'Recurring monthly service retainer',
        type: 'SUBSCRIPTION',
        price: 0,
        interval: 'MONTHLY',
        active: true,
        userId: admin.id,
      },
    })
    console.log('Created product: Monthly Retainer')
  } else {
    console.log('Monthly Retainer product already exists, skipping.')
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
