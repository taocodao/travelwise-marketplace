/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use Turbopack (Next.js 16 default)
  turbopack: {
    resolveAlias: {
      // Alias React Native packages to empty modules for web
      '@react-native-async-storage/async-storage': { browser: './node_modules/@react-native-async-storage/async-storage/lib/module/index.js' },
    },
  },

  // Transpile packages that need it
  transpilePackages: ['@privy-io/react-auth', '@privy-io/wagmi'],

  // Image domains
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'maps.gstatic.com',
      },
    ],
  },
};

export default nextConfig;
