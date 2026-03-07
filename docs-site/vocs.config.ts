import { defineConfig } from 'vocs'

export default defineConfig({
  title: 'Inkd Protocol',
  description: 'On-chain project registry for AI agents and developers. Built on Base, stored on Arweave.',
  logoUrl: '/logo.svg',
  iconUrl: '/favicon.svg',
  baseUrl: 'https://docs.inkdprotocol.com',
  ogImageUrl: 'https://docs.inkdprotocol.com/og.png',

  theme: {
    accentColor: {
      light: '#6366f1',
      dark: '#818cf8',
    },
  },

  socials: [
    {
      icon: 'github',
      link: 'https://github.com/inkdprotocol/inkd-protocol',
    },
    {
      icon: 'x',
      link: 'https://twitter.com/inkdprotocol',
    },
    {
      icon: 'discord',
      link: 'https://discord.gg/inkd',
    },
  ],

  topNav: [
    { text: 'Docs', link: '/introduction' },
    { text: 'API Reference', link: '/api/overview' },
    {
      text: 'npm',
      link: 'https://www.npmjs.com/package/@inkd/sdk',
    },
  ],

  sidebar: [
    {
      text: 'Getting Started',
      items: [
        { text: 'Introduction', link: '/introduction' },
        { text: 'Quickstart', link: '/quickstart' },
      ],
    },
    {
      text: 'SDK',
      items: [
        { text: 'Installation', link: '/sdk/installation' },
        { text: 'Projects Client', link: '/sdk/projects-client' },
        { text: 'Agent Vault', link: '/sdk/agent-vault' },
      ],
    },
    {
      text: 'CLI',
      items: [
        { text: 'Overview', link: '/cli/overview' },
      ],
    },
    {
      text: 'API Reference',
      items: [
        { text: 'Overview', link: '/api/overview' },
        { text: 'Projects', link: '/api/projects' },
        { text: 'Upload', link: '/api/upload' },
      ],
    },
    {
      text: 'Concepts',
      items: [
        { text: 'x402 Payments', link: '/concepts/x402' },
        { text: 'Arweave Storage', link: '/concepts/arweave' },
        { text: 'Contracts', link: '/concepts/contracts' },
        { text: 'Metadata Standard', link: '/concepts/metadata' },
      ],
    },
    {
      text: 'Security',
      items: [
        { text: 'Security Audit', link: '/security-audit' },
      ],
    },
  ],
})
