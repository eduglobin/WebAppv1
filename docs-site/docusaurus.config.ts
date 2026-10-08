import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'EduGlobin Documentation',
  tagline: 'High-Performance Study Space, Seat Booking & Physical Book Circulation ERP Platform',
  favicon: 'img/favicon.ico',

  markdown: {
    mermaid: true,
  },
  themes: ['@docusaurus/theme-mermaid'],

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true,
  },

  url: 'https://eduglobin.com',
  baseUrl: '/',

  organizationName: 'eduglobin',
  projectName: 'WebAppv1',

  onBrokenLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/docs',
          editUrl: 'https://github.com/eduglobin/WebAppv1/tree/master/docs-site/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'EduGlobin Docs',
      logo: {
        alt: 'EduGlobin Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          href: 'https://github.com/eduglobin/WebAppv1',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Architecture & Guides',
          items: [
            {
              label: 'System Design',
              to: '/docs/architecture/system-design',
            },
            {
              label: 'Database ER Diagram',
              to: '/docs/architecture/database-er',
            },
            {
              label: 'Module Catalog (1-45)',
              to: '/docs/modules/overview',
            },
          ],
        },
        {
          title: 'APIs & Integration',
          items: [
            {
              label: 'Admin APIs',
              to: '/docs/api/admin-endpoints',
            },
            {
              label: 'Operations & Setup',
              to: '/docs/operations/local-setup',
            },
            {
              label: 'Environment Variables',
              to: '/docs/operations/environment-variables',
            },
          ],
        },
        {
          title: 'Platform',
          items: [
            {
              label: 'GitHub Repository',
              href: 'https://github.com/eduglobin/WebAppv1',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} EduGlobin. All rights reserved.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
