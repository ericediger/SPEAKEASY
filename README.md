# SpeakEasy

AI-powered Chrome extension that summarizes web articles and reads them aloud using OpenAI's APIs.

## Features

- **Article Extraction** - Automatically extracts article content from any webpage
- **Multiple Summary Modes** - TL;DR (~2min), Short (~4min), Long (~8min), or Full article
- **9 Voice Options** - Alloy, Ash, Coral, Echo, Fable, Nova, Onyx, Sage, Shimmer
- **6 Speaking Styles** - Neutral, Energetic, Calm, Professional, Conversational, Storytelling
- **Real-time Controls** - Change voice or style mid-playback, audio regenerates automatically
- **Speed Control** - Adjustable from 0.5x to 2.0x in 0.1 increments
- **Smart Caching** - Summaries and audio cached locally to avoid redundant API calls

## Installation

### Prerequisites
- Node.js 18+
- OpenAI API key ([get one here](https://platform.openai.com/api-keys))

### Setup

```bash
# Clone the repository
git clone https://github.com/ericediger/SPEAKEASY.git
cd SPEAKEASY

# Install dependencies
npm install

# Build the extension
npm run build
```

### Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `dist` folder

### Configure

1. Click the SpeakEasy extension icon
2. Click the settings icon (top right)
3. Enter your OpenAI API key
4. Click **Validate** then **Save Settings**

## Usage

1. Navigate to any article or blog post
2. Click the SpeakEasy extension icon
3. Select a summary mode (TL;DR, Short, Long, Full)
4. Click the play button to generate and play audio
5. Adjust voice, style, or speed as needed

## Development

```bash
# Start dev server with hot reload
npm run dev

# Build for production
npm run build
```

## Tech Stack

- **Frontend**: React 18, TypeScript
- **Build**: Vite + CRXJS
- **Storage**: Chrome Storage API (settings), IndexedDB (cache)
- **APIs**: OpenAI Chat Completions (summarization), OpenAI TTS (text-to-speech)

## Project Structure

```
src/
├── background/
│   └── service-worker.ts    # API orchestration, message handling
├── content/
│   └── extractor.ts         # Article content extraction
├── lib/
│   ├── cache.ts             # IndexedDB caching layer
│   ├── openai.ts            # OpenAI API client
│   ├── storage.ts           # Chrome storage utilities
│   └── types.ts             # TypeScript types
├── popup/
│   ├── Popup.tsx            # Main popup UI
│   └── components/          # UI components
├── options/
│   └── Options.tsx          # Settings page
└── styles/
    └── popup.css            # Styling
```

## License

MIT
