/**
 * Integration test for the production bug:
 *   "Could not find the 'email' column of 'users' in the schema cache"
 *
 * Proves the POST /api/admin/users handler retries the insert WITHOUT email
 * when the deployed DB lacks the email column, and still creates the user.
 */

// Admin session
jest.mock('iron-session', () => ({
  getIronSession: jest.fn(async () => ({ isLoggedIn: true, role: 'admin' })),
}))

// Mock Supabase: first insert (with email) fails with the real PostgREST error;
// insert without an email key succeeds.
const inserts: Array<Record<string, unknown>> = []
jest.mock('@/lib/db', () => {
  const actual = jest.requireActual('@/lib/db')
  const supabaseAdmin = {
    from() {
      let payload: Record<string, unknown> = {}
      const b: Record<string, unknown> = {
        insert(p: Record<string, unknown>) { payload = p; inserts.push(p); return b },
        select() { return b },
        order() { return b },
        single() { return b },
        then(resolve: (v: unknown) => unknown) {
          const hasEmail = Object.prototype.hasOwnProperty.call(payload, 'email')
          const result = hasEmail
            ? { data: null, error: { message: "Could not find the 'email' column of 'users' in the schema cache" } }
            : { data: { id: 'u1', username: payload.username, display_name: payload.display_name, role: payload.role }, error: null }
          return Promise.resolve(result).then(resolve)
        },
      }
      return b
    },
  }
  return { ...actual, supabaseAdmin }
})

import { POST } from '@/app/api/admin/users/route'

function makeReq(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof POST>[0]
}

describe('POST /api/admin/users — email-column fallback', () => {
  beforeEach(() => { inserts.length = 0 })

  it('creates the user even when the email column is missing', async () => {
    const res = await POST(makeReq({
      username: 'enterprise', displayName: 'Strat', password: 'Enterprise123', role: 'admin', email: 'apike@g2.com',
    }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.error).toBeUndefined()
    expect(json.user).toMatchObject({ username: 'enterprise', role: 'admin' })
    // Never leak the password hash
    expect('password_hash' in json.user).toBe(false)

    // Proves the fallback fired: first attempt included email, retry omitted it
    expect(inserts.length).toBe(2)
    expect('email' in inserts[0]).toBe(true)
    expect('email' in inserts[1]).toBe(false)
  })

  it('rejects an invalid role before touching the DB', async () => {
    const res = await POST(makeReq({ username: 'x', password: 'y12345678', role: 'superadmin' }))
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toMatch(/Role must be admin or user/)
    expect(inserts.length).toBe(0)
  })
})
