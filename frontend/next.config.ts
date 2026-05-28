import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable gzip/brotli compression for all responses — critical on mobile
  compress: true,

  // Remove X-Powered-By header (minor security + bandwidth saving)
  poweredByHeader: false,

  // Strict React mode helps catch bugs early
  reactStrictMode: true,

  // Ignore lint/type errors during production builds
  // (ESLint config issues shouldn't block deploys; TypeScript is checked in editor)
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  async rewrites() {
    return [
      {
        source: '/line/:path*',
        destination: 'http://localhost:8081/line/:path*',
      },
      {
        source: '/users/:path*',
        destination: 'http://localhost:8081/users/:path*',
      },
      {
        source: '/meetings/:path*',
        destination: 'http://localhost:8081/meetings/:path*',
      },
      {
        source: '/attendee/:path*',
        destination: 'http://localhost:8081/attendee/:path*',
      },
      {
        source: '/restaurant/:path*',
        destination: 'http://localhost:8081/restaurant/:path*',
      },
      {
        source: '/location/:path*',
        destination: 'http://localhost:8081/location/:path*',
      },
    ];
  },

  async headers() {
    return [
      // All pages: revalidate HTML on each load (prevents stale content)
      // Use no-cache (not no-store) so iOS LIFF's redirect dance can still use
      // cached responses during navigation — no-store breaks LIFF on iOS/WKWebView.
      // X-Frame-Options is intentionally omitted: LIFF renders in WKWebView from
      // LINE's origin, so SAMEORIGIN would block it on iOS.
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, must-revalidate',
          },
        ],
      },
      // Public static assets — 1 day cache
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      // Long-lived immutable cache for hashed static assets (JS, CSS, fonts)
      // Must be LAST so it overrides the no-cache rule above for /_next/static/*
      // Safe because Next.js always changes the filename hash on every build
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;

