import { ManifestV3Export } from '@crxjs/vite-plugin'

const manifest: ManifestV3Export = {
  manifest_version: 3,
  name: 'SpeakEasy',
  version: '2.1.0',
  description: 'AI-powered article summarization and text-to-speech',
  minimum_chrome_version: '116', // chrome.sidePanel.setPanelBehavior
  permissions: ['activeTab', 'storage', 'scripting', 'sidePanel'],
  host_permissions: ['https://api.openai.com/*'],
  // The player opens in the side panel (see setPanelBehavior in the service worker) so it stays open,
  // and keeps playing, while the user clicks around the page, switches tabs, or follows links
  side_panel: {
    default_path: 'src/popup/popup.html',
  },
  action: {
    default_title: 'Open SpeakEasy',
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
