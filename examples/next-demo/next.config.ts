import type { NextConfig } from 'next'

const config: NextConfig = {
  transpilePackages: [
    '@ericgallitto/feedback-react',
    '@ericgallitto/feedback-core',
    '@ericgallitto/feedback-contract',
  ],
  // Proxy /api/feedback to the standalone feedback-api server.
  //
  // Both rules are needed. The :path* form matches /api/feedback/<id> but also
  // matches the bare /api/feedback with an empty path, which rewrote to the
  // server's root and 404'd every submit. The exact rule is listed first so the
  // bare collection URL resolves before the wildcard sees it.
  async rewrites() {
    const api = process.env['FEEDBACK_API_URL'] ?? 'http://localhost:3210'
    return [
      { source: '/api/feedback', destination: `${api}/feedback` },
      { source: '/api/feedback/:path*', destination: `${api}/feedback/:path*` },
    ]
  },
}

export default config
