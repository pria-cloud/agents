/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [],
  // Enable hot reload for development
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      }
    }
    return config
  },
  // API configuration for Claude Code integration
  async rewrites() {
    return [
      {
        source: '/api/claude/:path*',
        destination: 'http://localhost:8080/api/claude/:path*'
      },
      {
        source: '/api/project/:path*',
        destination: 'http://localhost:8080/api/project/:path*'
      },
      {
        source: '/api/git/:path*',
        destination: 'http://localhost:8080/api/git/:path*'
      },
      {
        source: '/api/files/:path*',
        destination: 'http://localhost:8080/api/files/:path*'
      }
    ]
  }
}

module.exports = nextConfig