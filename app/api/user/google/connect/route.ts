import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAppUrl } from '@/lib/app-url'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = process.env.GOOGLE_CLIENT_ID
  const appUrl = getAppUrl(req)

  if (!clientId) {
    return NextResponse.redirect(`${appUrl}/calendar?google=not_configured`)
  }

  const redirectUri = `${appUrl}/api/user/google/callback`
  const scope = 'https://www.googleapis.com/auth/calendar.readonly'

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    access_type: 'offline',
    prompt: 'consent',
    state: session.user.id,
  })

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
}
