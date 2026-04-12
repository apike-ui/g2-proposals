/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent bundling of packages that use Node.js native APIs
  // xlsx uses 'fs' internally and must be required at runtime, not bundled
  serverExternalPackages: ['xlsx'],
}

export default nextConfig
