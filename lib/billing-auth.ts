import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

/**
 * Resolve a company's Stripe customer id, or null if none on file.
 */
export async function getCompanyCustomerId(companyId: string): Promise<string | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { stripeCustomerId: true },
  })
  return company?.stripeCustomerId ?? null
}

/**
 * Verify that `paymentMethodId` is actually attached to `companyId`'s Stripe
 * customer. Prevents cross-company payment-method tampering: without this, a
 * caller could pass any pm_… id to a /billing/cards route and detach or mutate
 * another company's card. Returns false on any mismatch, missing customer, or
 * Stripe error (fail closed).
 */
export async function paymentMethodBelongsToCompany(
  companyId: string,
  paymentMethodId: string
): Promise<boolean> {
  const customerId = await getCompanyCustomerId(companyId)
  if (!customerId) return false
  try {
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId)
    const attached =
      typeof pm.customer === 'string' ? pm.customer : pm.customer?.id ?? null
    return attached === customerId
  } catch {
    return false
  }
}
