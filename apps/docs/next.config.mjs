import { createMDX } from 'fumadocs-mdx/next';

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/docs/workflow', destination: '/docs/workflow/planning', permanent: true },
      {
        source: '/docs/spec/development/docs-first-workflow',
        destination: '/docs/workflow/development',
        permanent: true,
      },
      { source: '/docs/planning/vision', destination: '/docs/vision', permanent: true },
      {
        source: '/docs/planning/journeys',
        destination: '/docs/planning/stories/journeys',
        permanent: true,
      },
      {
        source: '/docs/planning/plans/:path*',
        destination: '/docs/development/plans/:path*',
        permanent: true,
      },
      { source: '/docs/design/system', destination: '/docs/spec/system-model', permanent: true },
      { source: '/docs/design/adr', destination: '/docs/development/adr', permanent: true },
      { source: '/docs/dev/cli', destination: '/docs/spec/cli', permanent: true },
      { source: '/docs/dev/cli/:path*', destination: '/docs/spec/cli/:path*', permanent: true },
      { source: '/docs/dev/data-model', destination: '/docs/spec/data-model', permanent: true },
      { source: '/docs/dev/system', destination: '/docs/spec/system-model', permanent: true },
      { source: '/docs/dev/adr', destination: '/docs/development/adr', permanent: true },
      { source: '/docs/dev/skill', destination: '/docs/agent/skill', permanent: true },
      { source: '/docs/dev', destination: '/docs/spec/system-model', permanent: true },
    ];
  },
  async rewrites() {
    return [
      { source: '/docs/:path*.md', destination: '/md/:path*' },
    ];
  },
};

const withMDX = createMDX();

export default withMDX(config);
