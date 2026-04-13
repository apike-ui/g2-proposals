import { NextRequest, NextResponse } from 'next/server'

async function testSalesforce(config: Record<string, string>) {
  const { instanceUrl, clientId, clientSecret, username, password, securityToken } = config
  if (!instanceUrl || !clientId || !clientSecret || !username || !password) {
    throw new Error('Missing required Salesforce fields')
  }
  const tokenUrl = `${instanceUrl.replace(/\/$/, '')}/services/oauth2/token`
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: clientId,
    client_secret: clientSecret,
    username,
    password: password + (securityToken || ''),
  })
  const res = await fetch(tokenUrl, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
  const data = await res.json()
  if (!res.ok || !data.access_token) throw new Error(data.error_description || 'Authentication failed')
  return { message: `Connected to Salesforce as ${data.id?.split('/').pop() || username}` }
}

async function testSnowflake(config: Record<string, string>) {
  const { account, username, password, warehouse, database, schema } = config
  if (!account || !username || !password) {
    throw new Error('Missing required Snowflake fields')
  }
  // Snowflake REST API login test
  const host = `https://${account}.snowflakecomputing.com`
  const res = await fetch(`${host}/session/v1/login-request?warehouse=${warehouse || ''}&databaseName=${database || ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      data: { CLIENT_APP_ID: 'JavaScript', CLIENT_APP_VERSION: '1.0', LOGIN_NAME: username, PASSWORD: password },
    }),
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.message || 'Authentication failed')
  return { message: `Connected to Snowflake account ${account}` }
}

export async function POST(request: NextRequest) {
  try {
    const { type, config } = await request.json()
    let result
    if (type === 'salesforce') result = await testSalesforce(config)
    else if (type === 'snowflake') result = await testSnowflake(config)
    else return NextResponse.json({ error: 'Unknown integration type' }, { status: 400 })
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Connection failed' }, { status: 400 })
  }
}
