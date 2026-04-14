'use client'

import { useEffect, useState } from 'react'

interface Integration {
  id?: string
  type: string
  config: Record<string, string>
  enabled: boolean
}

type TabType = 'hubspot' | 'salesforce' | 'snowflake'

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('hubspot')
  const [integrations, setIntegrations] = useState<Record<string, Integration>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [saveMsg, setSaveMsg] = useState('')

  // Form states per integration
  const [hubspotForm, setHubspotForm] = useState({ apiKey: '', portalId: '' })
  const [salesforceForm, setSalesforceForm] = useState({ instanceUrl: '', clientId: '', clientSecret: '', username: '', password: '' })
  const [snowflakeForm, setSnowflakeForm] = useState({ account: '', username: '', password: '', database: '', warehouse: '', schema: '' })

  useEffect(() => {
    fetch('/api/integrations')
      .then(r => r.json())
      .then(data => {
        const map: Record<string, Integration> = {}
        for (const int of data.integrations || []) {
          map[int.type] = int
        }
        setIntegrations(map)

        const hs = map['hubspot']
        if (hs) setHubspotForm({ apiKey: hs.config.apiKey || '', portalId: hs.config.portalId || '' })

        const sf = map['salesforce']
        if (sf) setSalesforceForm({
          instanceUrl: sf.config.instanceUrl || '',
          clientId: sf.config.clientId || '',
          clientSecret: sf.config.clientSecret || '',
          username: sf.config.username || '',
          password: sf.config.password || '',
        })

        const sn = map['snowflake']
        if (sn) setSnowflakeForm({
          account: sn.config.account || '',
          username: sn.config.username || '',
          password: sn.config.password || '',
          database: sn.config.database || '',
          warehouse: sn.config.warehouse || '',
          schema: sn.config.schema || '',
        })
      })
      .finally(() => setLoading(false))
  }, [])

  async function saveIntegration(type: string, config: Record<string, string>) {
    setSaving(true)
    setSaveMsg('')
    try {
      const res = await fetch('/api/integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, config, enabled: true }),
      })
      const data = await res.json()
      if (res.ok) {
        setSaveMsg('Saved successfully')
        setIntegrations(prev => ({ ...prev, [type]: data.integration }))
      } else {
        setSaveMsg(data.error || 'Save failed')
      }
    } catch {
      setSaveMsg('Network error')
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(''), 3000)
    }
  }

  async function testIntegration(type: string, config: Record<string, string>) {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, config }),
      })
      const data = await res.json()
      setTestResult({ success: data.success, message: data.message || (data.success ? 'Connection successful' : 'Connection failed') })
    } catch {
      setTestResult({ success: false, message: 'Network error — could not reach test endpoint' })
    } finally {
      setTesting(false)
    }
  }

  const tabs: { id: TabType; label: string; logo: string }[] = [
    { id: 'hubspot', label: 'HubSpot', logo: 'HS' },
    { id: 'salesforce', label: 'Salesforce', logo: 'SF' },
    { id: 'snowflake', label: 'Snowflake', logo: 'SN' },
  ]

  const tabColors: Record<TabType, string> = {
    hubspot: 'bg-orange-500',
    salesforce: 'bg-blue-500',
    snowflake: 'bg-cyan-500',
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-gray-500 mt-1">Connect your CRM, ERP, and data warehouse systems</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setTestResult(null); setSaveMsg('') }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className={`w-5 h-5 rounded text-white text-[9px] font-bold flex items-center justify-center ${tabColors[tab.id]}`}>
              {tab.logo}
            </span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* HubSpot Tab */}
      {activeTab === 'hubspot' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <span className="text-orange-600 font-bold text-sm">HS</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">HubSpot CRM</h2>
              <p className="text-sm text-gray-500">Sync quotes and deals to HubSpot</p>
            </div>
            {integrations['hubspot']?.enabled && (
              <span className="ml-auto px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Connected</span>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">API Key (Private App Token)</label>
              <input
                type="password"
                value={hubspotForm.apiKey}
                onChange={e => setHubspotForm(f => ({ ...f, apiKey: e.target.value }))}
                placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="input"
              />
              <p className="text-xs text-gray-400 mt-1">Create a Private App in HubSpot → Settings → Integrations → Private Apps</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Portal ID</label>
              <input
                type="text"
                value={hubspotForm.portalId}
                onChange={e => setHubspotForm(f => ({ ...f, portalId: e.target.value }))}
                placeholder="12345678"
                className="input"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={() => saveIntegration('hubspot', hubspotForm)}
              disabled={saving || !hubspotForm.apiKey}
              className="btn-primary"
            >
              {saving ? 'Saving…' : 'Save Configuration'}
            </button>
            {saveMsg && (
              <span className={`text-sm ${saveMsg.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{saveMsg}</span>
            )}
          </div>

          {integrations['hubspot']?.enabled && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Sync Actions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'Sync Quotes to Deals', desc: 'Push CPQ quotes as HubSpot deals' },
                  { label: 'Sync Products', desc: 'Pull HubSpot product library' },
                  { label: 'Sync Contacts', desc: 'Import HubSpot contacts as customers' },
                  { label: 'Auto-close Won Deals', desc: 'Mark deals won when orders placed' },
                ].map(action => (
                  <div key={action.label} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 bg-gray-50">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{action.label}</p>
                      <p className="text-xs text-gray-500">{action.desc}</p>
                    </div>
                    <button className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap">Run</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Salesforce Tab */}
      {activeTab === 'salesforce' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <span className="text-blue-600 font-bold text-sm">SF</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Salesforce</h2>
              <p className="text-sm text-gray-500">Sync opportunities and price books</p>
            </div>
            {integrations['salesforce']?.enabled && (
              <span className="ml-auto px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Connected</span>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Instance URL</label>
              <input
                type="text"
                value={salesforceForm.instanceUrl}
                onChange={e => setSalesforceForm(f => ({ ...f, instanceUrl: e.target.value }))}
                placeholder="https://yourorg.my.salesforce.com"
                className="input"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Client ID (Consumer Key)</label>
                <input
                  type="text"
                  value={salesforceForm.clientId}
                  onChange={e => setSalesforceForm(f => ({ ...f, clientId: e.target.value }))}
                  placeholder="3MVG9…"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Client Secret</label>
                <input
                  type="password"
                  value={salesforceForm.clientSecret}
                  onChange={e => setSalesforceForm(f => ({ ...f, clientSecret: e.target.value }))}
                  placeholder="••••••••"
                  className="input"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
                <input
                  type="text"
                  value={salesforceForm.username}
                  onChange={e => setSalesforceForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="admin@yourorg.com"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password + Security Token</label>
                <input
                  type="password"
                  value={salesforceForm.password}
                  onChange={e => setSalesforceForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Password + token appended"
                  className="input"
                />
              </div>
            </div>
          </div>

          {testResult && (
            <div className={`mt-4 p-3 rounded-lg text-sm ${testResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {testResult.success ? '✓ ' : '✗ '}{testResult.message}
            </div>
          )}

          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={() => saveIntegration('salesforce', salesforceForm)}
              disabled={saving || !salesforceForm.instanceUrl}
              className="btn-primary"
            >
              {saving ? 'Saving…' : 'Save Configuration'}
            </button>
            <button
              onClick={() => testIntegration('salesforce', salesforceForm)}
              disabled={testing || !salesforceForm.instanceUrl}
              className="btn-secondary"
            >
              {testing ? 'Testing…' : 'Test Connection'}
            </button>
            {saveMsg && (
              <span className={`text-sm ${saveMsg.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{saveMsg}</span>
            )}
          </div>
        </div>
      )}

      {/* Snowflake Tab */}
      {activeTab === 'snowflake' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center">
              <span className="text-cyan-600 font-bold text-sm">SN</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Snowflake</h2>
              <p className="text-sm text-gray-500">Query your data warehouse for pricing data</p>
            </div>
            {integrations['snowflake']?.enabled && (
              <span className="ml-auto px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Connected</span>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Account Identifier</label>
              <input
                type="text"
                value={snowflakeForm.account}
                onChange={e => setSnowflakeForm(f => ({ ...f, account: e.target.value }))}
                placeholder="orgname-accountname"
                className="input"
              />
              <p className="text-xs text-gray-400 mt-1">Found in Snowflake URL: orgname-accountname.snowflakecomputing.com</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
                <input
                  type="text"
                  value={snowflakeForm.username}
                  onChange={e => setSnowflakeForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="ADMIN"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <input
                  type="password"
                  value={snowflakeForm.password}
                  onChange={e => setSnowflakeForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  className="input"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Database</label>
                <input
                  type="text"
                  value={snowflakeForm.database}
                  onChange={e => setSnowflakeForm(f => ({ ...f, database: e.target.value }))}
                  placeholder="CPQ_DB"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Warehouse</label>
                <input
                  type="text"
                  value={snowflakeForm.warehouse}
                  onChange={e => setSnowflakeForm(f => ({ ...f, warehouse: e.target.value }))}
                  placeholder="COMPUTE_WH"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Schema</label>
                <input
                  type="text"
                  value={snowflakeForm.schema}
                  onChange={e => setSnowflakeForm(f => ({ ...f, schema: e.target.value }))}
                  placeholder="PUBLIC"
                  className="input"
                />
              </div>
            </div>
          </div>

          {testResult && (
            <div className={`mt-4 p-3 rounded-lg text-sm ${testResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {testResult.success ? '✓ ' : '✗ '}{testResult.message}
            </div>
          )}

          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={() => saveIntegration('snowflake', snowflakeForm)}
              disabled={saving || !snowflakeForm.account}
              className="btn-primary"
            >
              {saving ? 'Saving…' : 'Save Configuration'}
            </button>
            <button
              onClick={() => testIntegration('snowflake', snowflakeForm)}
              disabled={testing || !snowflakeForm.account}
              className="btn-secondary"
            >
              {testing ? 'Testing…' : 'Test Connection'}
            </button>
            {saveMsg && (
              <span className={`text-sm ${saveMsg.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{saveMsg}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
