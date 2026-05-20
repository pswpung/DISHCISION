import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
