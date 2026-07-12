import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

export interface ResolvedCoupon {
  stripeCouponId: string
  name: string
  percentOff: number | null
  amountOff: number | null
}

/**
 * Validate a coupon CODE against a product and return the Stripe coupon id to
 * attach at checkout, or null if the code is invalid / not applicable.
 *
 * Security: never trust a coupon id supplied by the client — always resolve it
 * from the code here so a caller can't apply an arbitrary (e.g. 100%-off) coupon.
 */
export async function resolveCouponForCheckout(
  code: string,
  productId: string
): Promise<ResolvedCoupon | null> {
  const trimmed = code?.trim()
  if (!trimmed) return null

  // 1) Local coupon scoped to this product (or a global coupon, productId null).
  const local = await prisma.coupon.findFirst({
    where: {
      code: trimmed,
      active: true,
      OR: [{ productId }, { productId: null }],
    },
  })
  if (local) {
    if (local.expiresAt && local.expiresAt.getTime() < Date.now()) return null
    return {
      stripeCouponId: local.stripeId,
      name: local.name,
      percentOff: local.percentOff ?? null,
      amountOff: local.amountOff ?? null,
    }
  }

  // 2) Fall back to an active Stripe promotion code. The visitor must know the
  //    code, and Stripe enforces the coupon's own validity/restrictions.
  try {
    const promoCodes = await stripe.promotionCodes.list({ code: trimmed, limit: 1, active: true })
    const promo = promoCodes.data[0]
    if (!promo) return null
    const couponId = (promo as unknown as { coupon: { id: string } }).coupon.id
    const coupon = await stripe.coupons.retrieve(couponId)
    if (!coupon || (coupon as unknown as { valid?: boolean }).valid === false) return null
    return {
      stripeCouponId: coupon.id,
      name: coupon.name ?? trimmed,
      percentOff: coupon.percent_off ?? null,
      amountOff: coupon.amount_off ? coupon.amount_off / 100 : null,
    }
  } catch {
    return null
  }
}
