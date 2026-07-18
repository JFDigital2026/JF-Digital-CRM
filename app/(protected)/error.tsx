'use client'

import { useEffect } from 'react'

// Matches the various shapes a failed JS/CSS chunk load throws across browsers
// and Next.js versions. After a deploy, a client still running the previous
// build holds references to chunk filenames that no longer exist on the server;
// the next soft navigation fails to fetch one and React renders this boundary.
const CHUNK_ERROR_RE =
  /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|error loading dynamically imported module/i

// Only auto-reload if we haven't just done so — a genuinely missing asset would
// otherwise reload forever. A full reload fetches the fresh app shell (which
// server-renders fine), which is exactly the manual refresh that recovers today.
const RELOAD_KEY = 'chunk-reload-ts'
const RELOAD_WINDOW_MS = 10_000

export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const isChunkError =
    error?.name === 'ChunkLoadError' || CHUNK_ERROR_RE.test(error?.message ?? '')

  useEffect(() => {
    if (!isChunkError) return
    try {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
      if (Date.now() - last > RELOAD_WINDOW_MS) {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
        window.location.reload()
      }
    } catch {
      // sessionStorage unavailable — fall through to the manual UI below.
    }
  }, [isChunkError])

  if (isChunkError) {
    // The reload fires from the effect above; show a calm placeholder in the
    // meantime instead of a blank screen. If the reload was suppressed (already
    // reloaded within the window), the "Reload" button gives a manual path.
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-gray-500">Updating to the latest version…</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Reload now
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Something went wrong</h2>
        <p className="mt-1 text-sm text-gray-500">
          This page hit an unexpected error and couldn’t load.
        </p>
        {error?.message && (
          <p className="mt-2 max-w-md break-words text-xs text-gray-400">{error.message}</p>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => reset()}
          className="rounded-lg bg-[#0D1B2A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B263B]"
        >
          Try again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Reload page
        </button>
      </div>
    </div>
  )
}
