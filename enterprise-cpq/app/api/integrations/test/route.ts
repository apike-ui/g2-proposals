import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { type, config } = body

  if (type === 'salesforce') {
    try {
      const { instanceUrl, clientId, clientSecret, username, password, securityToken } = config
      if (!instanceUrl || !clientId || !clientSecret || !username || !password) {
        return NextResponse.json({ error: 'All Salesforce fields are required' }, { status: 400 })
      }

      const fullPassword = securityToken ? `${password}${securityToken}` : password
      const tokenUrl = `${instanceUrl.replace(/\/$/, '')}/services/oauth2/token`

      const params = new URLSearchParams({
        grant_type: 'password',
        client_id: clientId,
        client_secret: clientSecret,
        username,
        password: fullPassword,
      })

      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      })

      if (res.ok) {
        return NextResponse.json({ success: true, message: 'Salesforce connection successful' })
      }
      const err = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: err.error_description || `HTTP ${res.status}: Authentication failed` },
        { status: 400 },
      )
    } catch (err) {
      return NextResponse.json(
        { error: `Connection failed: ${err instanceof Error ? err.message : 'Network error'}` },
        { status: 400 },
      )
    }
  }

  if (type === 'snowflake') {
    try {
      const { account, username, password, database } = config
      if (!account || !username || !password) {
        return NextResponse.json({ error: 'Account, username, and password are required' }, { status: 400 })
      }

      const loginUrl = `https://${account}.snowflakecomputing.com/session/v1/login-request${database ? `?databaseName=${database}` : ''}`
      const res = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ data: { LOGIN_NAME: username, PASSWORD: password } }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          return NextResponse.json({ success: true, message: 'Snowflake connection successful' })
        }
        return NextResponse.json({ error: data.message || 'Authentication failed' }, { status: 400 })
      }
      return NextResponse.json(
        { error: `HTTP ${res.status}: Check your account identifier and credentials` },
        { status: 400 },
      )
    } catch (err) {
      return NextResponse.json(
        { error: `Connection failed: ${err instanceof Error ? err.message : 'Network error'}` },
        { status: 400 },
      )
    }
  }

  return NextResponse.json({ error: `Unknown integration type: ${type}` }, { status: 400 })
}
