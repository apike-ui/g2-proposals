'use client'

import { useState, useRef, DragEvent } from 'react'
import Link from 'next/link'

interface UploadResult {
  success: boolean
  total: number
  created: number
  updated: number
  errors: string[]
}

export default function UploadPage() {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) selectFile(dropped)
  }

  function selectFile(f: File) {
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) {
      setError('Only .xlsx, .xls, or .csv files are supported')
      return
    }
    setFile(f)
    setError('')
    setResult(null)
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError('')
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Upload failed')
      } else {
        setResult(data)
        setFile(null)
        if (inputRef.current) inputRef.current.value = ''
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  async function downloadTemplate() {
    const res = await fetch('/api/upload')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cpq-product-template.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Import SKUs</h1>
        <p className="text-gray-500 mt-1 text-sm">Upload an Excel or CSV file to add or update products in your CPQ catalog.</p>
      </div>

      {/* Column Guide */}
      <div className="card mb-6">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900">File Format Guide</h2>
          <button onClick={downloadTemplate} className="btn-secondary btn-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Template
          </button>
        </div>
        <div className="p-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 pr-4 font-semibold text-gray-700">Column</th>
                <th className="text-left py-2 pr-4 font-semibold text-gray-700">Required</th>
                <th className="text-left py-2 font-semibold text-gray-700">Accepted Header Names</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { col: 'SKU', req: true, names: 'SKU, Code, ProductCode, Part Number, item_number' },
                { col: 'Name', req: true, names: 'Name, Title, Product Name, item_name' },
                { col: 'Description', req: false, names: 'Description, Desc, Long Description' },
                { col: 'Price', req: false, names: 'Price, Unit Price, Cost, List Price, MSRP' },
                { col: 'Category', req: false, names: 'Category, Type, Product Type' },
                { col: 'Unit', req: false, names: 'Unit, UOM, Unit of Measure' },
              ].map((r) => (
                <tr key={r.col}>
                  <td className="py-2 pr-4 font-medium text-gray-900">{r.col}</td>
                  <td className="py-2 pr-4">
                    {r.req
                      ? <span className="badge-red">Required</span>
                      : <span className="badge-gray">Optional</span>}
                  </td>
                  <td className="py-2 text-gray-500 text-xs font-mono">{r.names}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 mt-3">
            If a product with the same SKU already exists, it will be updated. New SKUs will be created.
          </p>
        </div>
      </div>

      {/* Drop Zone */}
      <div className="card mb-6">
        <div className="p-6">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && selectFile(e.target.files[0])}
            />
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            {file ? (
              <div>
                <p className="font-semibold text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
              </div>
            ) : (
              <div>
                <p className="font-medium text-gray-700">Drop your Excel or CSV file here</p>
                <p className="text-sm text-gray-400 mt-1">or click to browse · .xlsx, .xls, .csv supported</p>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {file && !error && (
            <div className="mt-4 flex justify-end">
              <button onClick={handleUpload} disabled={uploading} className="btn-primary">
                {uploading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Importing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Import {file.name}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className={`card p-6 border-2 ${result.errors.length === 0 ? 'border-green-200' : 'border-yellow-200'}`}>
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            {result.errors.length === 0
              ? <><span className="text-green-600">✓</span> Import Complete</>
              : <><span className="text-yellow-600">⚠</span> Import Complete with Errors</>}
          </h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{result.total}</p>
              <p className="text-xs text-gray-500">Total Rows</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-700">{result.created}</p>
              <p className="text-xs text-green-600">New Products</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
              <p className="text-xs text-blue-600">Updated</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-sm font-medium text-red-800 mb-2">Errors ({result.errors.length}):</p>
              <ul className="space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-xs text-red-700">{e}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4">
            <Link href="/products" className="btn-primary btn-sm">
              View Products →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
