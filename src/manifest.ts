import { ManifestV3Export } from '@crxjs/vite-plugin'

const manifest: ManifestV3Export = {
  manifest_version: 3,
  name: 'SpeakEasy',
  version: '1.0.0',
  description: 'AI-powered article summarization and text-to-speech',
  permissions: ['activeTab', 'storage', 'scripting'],
  host_permissions: ['https://api.openai.com/*'],
  action: {
    default_popup: 'src/popup/popup.html',
    default_icon: {
      '16': 'icons/icon16.svg',
      '48': 'icons/icon48.svg',
      '128': 'icons/icon128.svg',
    },
  },
  options_ui: {
    page: 'src/options/options.html',
    open_in_tab: true,
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  icons: {
    '16': 'icons/icon16.svg',
    '48': 'icons/icon48.svg',
    '128': 'icons/icon128.svg',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/extractor.ts'],
      run_at: 'document_idle',
    },
  ],
}

export default manifest
