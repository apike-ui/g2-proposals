import { Client } from '@hubspot/api-client'

export function getHubSpotClient() {
  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN
  if (!accessToken) {
    throw new Error('HUBSPOT_ACCESS_TOKEN is not configured. Add it to your .env.local file.')
  }
  return new Client({ accessToken })
}

export async function syncProductToHubSpot(product: {
  sku: string
  name: string
  description: string | null
  price: number
}): Promise<string> {
  const client = getHubSpotClient()

  const properties = {
    name: product.name,
    description: product.description || '',
    price: product.price.toString(),
    hs_sku: product.sku,
  }

  // Search for existing product by SKU
  const searchResponse = await client.crm.products.searchApi.doSearch({
    filterGroups: [
      {
        filters: [
          {
            propertyName: 'hs_sku',
            operator: 'EQ' as never,
            value: product.sku,
          },
        ],
      },
    ],
    properties: ['name', 'hs_sku'],
    limit: 1,
    after: '0',
    sorts: [],
  })

  if (searchResponse.results.length > 0) {
    const existingId = searchResponse.results[0].id
    await client.crm.products.basicApi.update(existingId, { properties })
    return existingId
  } else {
    const created = await client.crm.products.basicApi.create({ properties })
    return created.id
  }
}

export async function getHubSpotContacts(limit = 100) {
  const client = getHubSpotClient()

  const response = await client.crm.contacts.basicApi.getPage(
    limit,
    undefined,
    ['firstname', 'lastname', 'email', 'company'],
  )

  return response.results.map((contact) => ({
    id: contact.id,
    firstName: contact.properties.firstname || '',
    lastName: contact.properties.lastname || '',
    email: contact.properties.email || '',
    company: contact.properties.company || '',
  }))
}

export async function createHubSpotDeal(deal: {
  dealname: string
  amount: number
  contactId?: string
}): Promise<string> {
  const client = getHubSpotClient()

  const properties = {
    dealname: deal.dealname,
    amount: deal.amount.toString(),
    dealstage: 'appointmentscheduled',
    pipeline: 'default',
  }

  const created = await client.crm.deals.basicApi.create({ properties })

  if (deal.contactId) {
    try {
      await client.crm.deals.associationsApi.create(
        created.id,
        'contact',
        deal.contactId,
        [{ associationCategory: 'HUBSPOT_DEFINED' as never, associationTypeId: 3 }],
      )
    } catch {
      // Association failed, but deal was created
    }
  }

  return created.id
}
