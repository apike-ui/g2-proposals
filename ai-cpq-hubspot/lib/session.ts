import { SessionOptions } from 'iron-session'

export interface SessionData {
  username?: string
  isLoggedIn: boolean
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || 'cpq-session-secret-minimum-32-characters-long!!',
  cookieName: 'cpq-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 1 week
  },
}
