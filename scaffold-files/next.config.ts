/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  
  // Enable hot reload in Docker development environment
  ...(process.env.NODE_ENV === 'development' && {
    webpackDevMiddleware: (config: any) => {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      }
      return config
    },
  }),
  
  /* config options here */
};

export default nextConfig;
