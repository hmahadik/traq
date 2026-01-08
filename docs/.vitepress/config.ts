import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Traq',
  description: 'Desktop activity tracker with automatic screenshots and analytics',
  base: '/activity-tracker/',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/activity-tracker/favicon.svg' }],
  ],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Download', link: '/download' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'What is Traq?', link: '/guide/what-is-traq' },
            { text: 'Getting Started', link: '/guide/getting-started' },
          ]
        },
        {
          text: 'Features',
          items: [
            { text: 'Timeline View', link: '/guide/timeline' },
            { text: 'Analytics', link: '/guide/analytics' },
            { text: 'Reports', link: '/guide/reports' },
          ]
        },
        {
          text: 'Configuration',
          items: [
            { text: 'Settings', link: '/guide/settings' },
            { text: 'Data Storage', link: '/guide/data-storage' },
          ]
        },
        {
          text: 'Help',
          items: [
            { text: 'FAQ', link: '/guide/faq' },
            { text: 'Troubleshooting', link: '/guide/troubleshooting' },
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/hmahadik/activity-tracker' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present'
    },

    search: {
      provider: 'local'
    }
  }
})
