import { defineConfig } from 'vocs'

export default defineConfig({
  title: 'Inkd Protocol',
  description: 'On-chain project registry for AI agents and developers. Built on Base, stored on Arweave.',
  logoUrl: '/logo.jpg',
  baseUrl: 'https://docs.inkdprotocol.com',
  ogImageUrl: 'https://inkdprotocol.com/og.png',

  theme: {
    accentColor: {
      light: '#6366f1',
      dark:  '#818cf8',
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
  ],

  topNav: [
    { text: 'Docs',      link: '/introduction' },
    { text: 'API',       link: '/api/overview' },
    { text: 'Security',  link: '/security-audit' },
    { text: 'npm',       link: 'https://www.npmjs.com/package/@inkd/sdk' },
    { text: 'GitHub',    link: 'https://github.com/inkdprotocol/inkd-protocol' },
  ],

  sidebar: [
    {
      text: 'Getting Started',
      items: [
        { text: 'Introduction',    link: '/introduction' },
        { text: 'Quickstart',      link: '/quickstart' },
      ],
    },
    {
      text: 'SDK',
      items: [
        { text: 'Installation',    link: '/sdk/installation' },
        { text: 'ProjectsClient',  link: '/sdk/projects-client' },
        { text: 'AgentVault',      link: '/sdk/agent-vault' },
      ],
    },
    {
      text: 'CLI',
      items: [
        { text: 'Overview',        link: '/cli/overview' },
      ],
    },
    {
      text: 'API Reference',
      items: [
        { text: 'Overview',        link: '/api/overview' },
        { text: 'Projects',        link: '/api/projects' },
        { text: 'Upload',          link: '/api/upload' },
        { text: 'Error Codes',     link: '/api/errors' },
      ],
    },
    {
      text: 'Concepts',
      items: [
        { text: 'x402 Payments',   link: '/concepts/x402' },
        { text: 'Fee Model',       link: '/concepts/fees' },
        { text: 'Arweave Storage', link: '/concepts/arweave' },
        { text: 'Contracts',       link: '/concepts/contracts' },
        { text: 'Metadata',        link: '/concepts/metadata' },
      ],
    },
    {
      text: 'Security',
      items: [
        { text: 'Security Audit',  link: '/security-audit' },
      ],
    },
  ],
})
