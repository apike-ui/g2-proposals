export interface ProductRow {
  sku: string
  name: string
  description?: string
  price?: number
  category?: string
  unit?: string
}

function findValue(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in row && row[key] !== '' && row[key] !== null && row[key] !== undefined) {
      return row[key]
    }
  }
  return ''
}

export async function parseExcelFile(buffer: Buffer): Promise<ProductRow[]> {
  const XLSX = await import('xlsx')

  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]

  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
  })

  if (!data || data.length === 0) {
    throw new Error('File is empty or has no data rows.')
  }

  const products: ProductRow[] = []

  for (const row of data) {
    const sku = findValue(row, [
      'sku', 'SKU', 'Sku', 'product_code', 'ProductCode', 'Code', 'code',
      'item_number', 'ItemNumber', 'ITEM_NUMBER', 'Part Number', 'part_number',
    ])
    const name = findValue(row, [
      'name', 'Name', 'NAME', 'product_name', 'ProductName', 'title', 'Title',
      'item_name', 'ItemName', 'Product Name', 'Description',
    ])

    if (!sku || !name) continue

    const description = findValue(row, [
      'description', 'Description', 'DESCRIPTION', 'desc', 'Desc',
      'Long Description', 'long_description', 'Details',
    ])
    const rawPrice = findValue(row, [
      'price', 'Price', 'PRICE', 'unit_price', 'UnitPrice', 'cost', 'Cost',
      'List Price', 'list_price', 'MSRP',
    ])
    const price = parseFloat(String(rawPrice).replace(/[^0-9.]/g, '')) || 0
    const category = findValue(row, [
      'category', 'Category', 'CATEGORY', 'type', 'Type',
      'product_type', 'ProductType', 'Product Type',
    ])
    const unit = findValue(row, [
      'unit', 'Unit', 'UNIT', 'uom', 'UOM', 'unit_of_measure',
      'UnitOfMeasure', 'Unit of Measure',
    ])

    products.push({
      sku: String(sku).trim(),
      name: String(name).trim(),
      description: description ? String(description).trim() : undefined,
      price: isNaN(price) ? 0 : price,
      category: category ? String(category).trim() : undefined,
      unit: unit ? String(unit).trim() : 'each',
    })
  }

  if (products.length === 0) {
    throw new Error(
      'No valid products found. Ensure your file has columns: SKU (or Code/Part Number) and Name (or Title/Product Name).',
    )
  }

  return products
}

export async function generateExcelTemplate(): Promise<Buffer> {
  const XLSX = await import('xlsx')

  const wb = XLSX.utils.book_new()

  const headers = ['SKU', 'Name', 'Description', 'Price', 'Category', 'Unit']
  const sampleData = [
    ['SKU-001', 'Enterprise Software License', 'Annual enterprise license for up to 50 users', 4999.00, 'Software', 'license/year'],
    ['SKU-002', 'Professional Services (per day)', 'Implementation and consulting services', 1500.00, 'Services', 'day'],
    ['SKU-003', 'Hardware Module A', 'High-performance compute module', 299.99, 'Hardware', 'each'],
  ]

  const wsData = [headers, ...sampleData]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  ws['!cols'] = [
    { width: 15 }, { width: 35 }, { width: 50 }, { width: 12 }, { width: 20 }, { width: 15 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Products')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}
