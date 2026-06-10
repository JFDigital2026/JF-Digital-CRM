import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const userId = searchParams.get('state')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:4000'

  if (!code || !userId) return NextResponse.redirect(`${appUrl}/calendar?google=error`)

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        redirect_uri: `${appUrl}/api/user/google/callback`,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) return NextResponse.redirect(`${appUrl}/calendar?google=error`)

    const tokens = await tokenRes.json() as { access_token: string; refresh_token?: string }

    // Get connected email
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const userInfo = userInfoRes.ok ? await userInfoRes.json() as { email?: string } : {}

    await prisma.user.update({
      where: { id: userId },
      data: {
        googleAccessToken: tokens.access_token,
        ...(tokens.refresh_token ? { googleRefreshToken: tokens.refresh_token } : {}),
        ...('email' in userInfo && userInfo.email ? { googleCalendarEmail: userInfo.email } : {}),
      },
    })
  } catch {
    return NextResponse.redirect(`${appUrl}/calendar?google=error`)
  }

  return NextResponse.redirect(`${appUrl}/calendar?google=connected`)
}
