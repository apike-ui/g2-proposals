/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 14: serverExternalPackages is under experimental
  experimental: {
    serverComponentsExternalPackages: ['xlsx', 'pptxgenjs'],
  },
}

export default nextConfig
