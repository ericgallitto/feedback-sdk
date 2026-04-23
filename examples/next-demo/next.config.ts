import type { NextConfig } from 'next'

const config: NextConfig = {
  // Proxy /api/feedback to the standalone feedback-api server
  async rewrites() {
    return [
      {
        source: '/api/feedback/:path*',
        destination: `${process.env['FEEDBACK_API_URL'] ?? 'http://localhost:3210'}/:path*`,
      },
    ]
  },
}

export default config
