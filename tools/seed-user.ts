import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2] || 'admin@crm.com'
  const password = process.argv[3] || 'admin123'
  const name = process.argv[4] || 'Admin'

  const hashed = await bcrypt.hash(password, 12)

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hashed, name },
    create: { email, password: hashed, name, role: 'ADMIN' },
  })

  console.log(`User ready: ${user.email} / ${password}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
