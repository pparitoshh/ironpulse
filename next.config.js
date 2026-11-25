/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // config/llm.yaml is read at runtime by lib/ai.ts; ship it with every API route.
    outputFileTracingIncludes: { '/api/**/*': ['./config/**'] },
  },
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
}

module.exports = nextConfig
