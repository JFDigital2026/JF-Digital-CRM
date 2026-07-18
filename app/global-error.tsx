'use client'

import { useEffect } from 'react'

// Last-resort boundary: replaces the root layout when an error escapes every
// nested boundary (e.g. a chunk fails while the root layout itself is loading).
// Must render its own <html>/<body>. Mirrors the chunk-reload recovery in
// app/(protected)/error.tsx so a post-deploy stale chunk here also self-heals.
const CHUNK_ERROR_RE =
  /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|error loading dynamically imported module/i

const RELOAD_KEY = 'chunk-reload-ts'
const RELOAD_WINDOW_MS = 10_000

export default function GlobalError({
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
      // ignore
    }
  }, [isChunkError])

  return (
    <html>
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 32,
            textAlign: 'center',
            color: '#1B263B',
          }}
        >
          {isChunkError ? (
            <>
              <p style={{ fontSize: 14, color: '#6b7280' }}>Updating to the latest version…</p>
              <button
                onClick={() => window.location.reload()}
                style={{
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  padding: '8px 16px',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Reload now
              </button>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Something went wrong</h2>
              <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
                The app hit an unexpected error.
              </p>
              {error?.message && (
                <p style={{ fontSize: 12, color: '#9ca3af', maxWidth: 400, wordBreak: 'break-word' }}>
                  {error.message}
                </p>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => reset()}
                  style={{
                    borderRadius: 8,
                    background: '#0D1B2A',
                    color: '#fff',
                    padding: '8px 16px',
                    fontSize: 14,
                    fontWeight: 500,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Try again
                </button>
                <button
                  onClick={() => window.location.reload()}
                  style={{
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    padding: '8px 16px',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Reload page
                </button>
              </div>
            </>
          )}
        </div>
      </body>
    </html>
  )
}
