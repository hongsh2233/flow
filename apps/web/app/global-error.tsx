'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="ko">
      <body>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontFamily: 'system-ui, sans-serif',
          padding: '20px',
          textAlign: 'center',
        }}>
          <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>
            오류가 발생했습니다
          </h2>
          <p style={{ color: '#666', marginBottom: '24px', fontSize: '14px' }}>
            잠시 후 다시 시도해주세요.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              border: '1px solid #ddd',
              background: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  )
}
