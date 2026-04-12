/** @type {import('next').NextConfig} */
const nextConfig = {
  // xlsx is kept external so it is require()'d at runtime rather than bundled.
  // Combined with dynamic import() in lib/excel.ts this ensures xlsx loads
  // lazily inside the request handler — not during module initialization —
  // so any load error returns a proper JSON 500 instead of crashing Vercel cold starts.
  serverExternalPackages: ['xlsx'],
}

export default nextConfig
