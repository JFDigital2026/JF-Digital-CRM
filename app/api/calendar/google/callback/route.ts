import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const userId = searchParams.get('state')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  if (!code || !userId) {
    return NextResponse.redirect(`${appUrl}/calendar?google=error`)
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = `${appUrl}/api/calendar/google/callback`

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId ?? '',
        client_secret: clientSecret ?? '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      return NextResponse.redirect(`${appUrl}/calendar?google=error`)
    }

    const tokens = await tokenRes.json() as {
      access_token: string
      refresh_token?: string
    }

    // Get user email
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    let googleEmail: string | null = null
    if (userInfoRes.ok) {
      const userInfo = await userInfoRes.json() as { email?: string }
      googleEmail = userInfo.email ?? null
    }

    // Store tokens in the most recently created CalendarConfig for this user
    const calendarConfig = await prisma.calendarConfig.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    if (calendarConfig) {
      await prisma.calendarConfig.update({
        where: { id: calendarConfig.id },
        data: {
          googleAccessToken: tokens.access_token,
          ...(tokens.refresh_token ? { googleRefreshToken: tokens.refresh_token } : {}),
          ...(googleEmail ? { googleConnectedEmail: googleEmail } : {}),
        },
      })
    }
  } catch (_err) {
    return NextResponse.redirect(`${appUrl}/calendar?google=error`)
  }

  return NextResponse.redirect(`${appUrl}/calendar?google=connected`)
}
