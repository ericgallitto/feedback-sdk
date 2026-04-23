import type { Context, MiddlewareHandler } from 'hono'

export interface AuthConfig {
  publishableKey?: string
  secretKey?: string
  demoMode?: boolean
}

/** Middleware for public submit endpoint: checks publishable key when configured. */
export function requirePublishableKey(config: AuthConfig): MiddlewareHandler {
  return async (c: Context, next) => {
    if (config.demoMode || !config.publishableKey) {
      return next()
    }
    const key =
      c.req.header('X-Feedback-Key') ??
      c.req.query('key')

    if (key !== config.publishableKey) {
      return c.json({ error: 'Invalid or missing publishable key' }, 401)
    }
    return next()
  }
}

/** Middleware for admin endpoints: checks secret key. */
export function requireSecretKey(config: AuthConfig): MiddlewareHandler {
  return async (c: Context, next) => {
    if (config.demoMode || !config.secretKey) {
      return next()
    }
    const authHeader = c.req.header('Authorization')
    const headerKey = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : c.req.header('X-Feedback-Secret')

    if (headerKey !== config.secretKey) {
      return c.json({ error: 'Invalid or missing secret key' }, 401)
    }
    return next()
  }
}
