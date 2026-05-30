import { isMissingColumnError } from '@/lib/db'

describe('isMissingColumnError', () => {
  it('detects the exact PostgREST schema-cache error for a missing email column', () => {
    // This is the real error returned by the deployed Supabase DB when the
    // users.email migration has not been applied.
    const err = { message: "Could not find the 'email' column of 'users' in the schema cache" }
    expect(isMissingColumnError(err, 'email')).toBe(true)
  })

  it('detects the PostgREST PGRST204 code', () => {
    expect(isMissingColumnError({ code: 'PGRST204', message: 'x' }, 'email')).toBe(true)
  })

  it('detects the Postgres undefined_column code (42703)', () => {
    expect(isMissingColumnError({ code: '42703', message: 'column "email" does not exist' }, 'email')).toBe(true)
  })

  it('detects a generic "does not exist" message', () => {
    expect(isMissingColumnError({ message: 'column users.email does not exist' }, 'email')).toBe(true)
  })

  it('does NOT match an unrelated unique-violation error', () => {
    expect(isMissingColumnError({ code: '23505', message: 'duplicate key value' }, 'email')).toBe(false)
  })

  it('does NOT match when a different column is missing', () => {
    const err = { message: "Could not find the 'phone' column of 'users' in the schema cache" }
    expect(isMissingColumnError(err, 'email')).toBe(false)
  })

  it('returns false for null/undefined errors', () => {
    expect(isMissingColumnError(null, 'email')).toBe(false)
    expect(isMissingColumnError(undefined, 'email')).toBe(false)
  })
})
