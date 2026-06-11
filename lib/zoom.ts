async function getAccessToken(): Promise<string> {
  const credentials = Buffer.from(
    `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
    {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}` },
    }
  )

  if (!res.ok) throw new Error(`Zoom token error: ${res.status}`)
  const data = await res.json()
  return data.access_token as string
}

export async function createZoomMeeting(
  topic: string,
  startTime: Date,
  durationMinutes: number
): Promise<{ joinUrl: string; startUrl: string; meetingId: string }> {
  const token = await getAccessToken()

  const res = await fetch('https://api.zoom.us/v2/users/me/meetings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic,
      type: 2,
      start_time: startTime.toISOString(),
      duration: durationMinutes,
      settings: {
        host_video: true,
        participant_video: true,
        waiting_room: true,
        join_before_host: false,
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Zoom create meeting error: ${res.status} ${err}`)
  }

  const data = await res.json()
  return {
    joinUrl: data.join_url as string,
    startUrl: data.start_url as string,
    meetingId: String(data.id),
  }
}
