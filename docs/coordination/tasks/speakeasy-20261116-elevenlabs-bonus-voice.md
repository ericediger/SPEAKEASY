---
record: task-handoff
standard: coordination-v1
task_id: speakeasy-20261116-elevenlabs-bonus-voice
title: Add the creator's ElevenLabs voice as a bonus narration voice
folder: SPEAKEASY
status: active
owner:
  tool: Claude Code
  session_id: unknown (desktop app session started 2026-11-16 ~15:15-05:00, ElevenLabs bonus voice)
  since: 2026-11-16T15:19-05:00
reviewers: []
coordinator: Pasta
project_owner: Eric
released_to: none
escalation_pending: false
closed_reason: none
branch: speakeasy-elevenlabs-bonus-voice
base_branch: main
worktree: main checkout
latest_commit: 8c7693e
uncommitted_changes: none from this task (committed on the task branch; see Log)
depends_on: [ElevenLabs API key with text-to-speech access to the voice]
blocks: []
milestones:
  implementation_complete: yes
  verified: no
  ready_for_owner_testing: yes
  accepted: no
  merged: no
  deployed: no
updated_at: 2026-11-16T15:31-05:00
updated_by: Claude Code (session unknown, see owner)
---

# speakeasy-20261116-elevenlabs-bonus-voice: Add the creator's ElevenLabs voice as a bonus narration voice

## Goal

Alongside the OpenAI voices, offer the ElevenLabs voice "eMoney - Product Walkthroughs" (voice ID `G3qIj1Lb0GkRqMWsPD2C`) as a bonus voice from the creator.

## Acceptance criteria

- Eric (2026-11-16): "Along with the voice options from OpenAI, I want to enable the use of this voice", "as kind of a 'bonus voice' from the creator".
- Anything further: unknown.

## Scope

- **In scope:** `src/lib/` (types, storage, narration, new ElevenLabs client), `src/background/service-worker.ts`, `src/popup/Popup.tsx`, `src/options/Options.tsx`, `src/manifest.ts`, `README.md`.
- **Out of scope:** rebuilding `demo/app/` and demo audio, the explainer video, the reading test.
- **Shared resources touched:** extension settings in `chrome.storage.sync` (new `elevenLabsApiKey` key); new host permission for the ElevenLabs API.

## Current state

Implemented on the task branch: the creator's voice appears as "Creator" with a Bonus tag after the OpenAI voices in the side panel and the settings page. Choosing it narrates through ElevenLabs (`eleven_multilingual_v2`, 24 kHz PCM joined into the same WAV) with the user's ElevenLabs key, which is a new optional field in settings. Summaries still use OpenAI. Build and type-check pass; no live ElevenLabs call has been made. Unrelated uncommitted files in the checkout (`.gitignore`, `AGENTS.md`, `CLAUDE.md`, `docs/coordination/README.md`, `docs/coordination/HANDOFF_TEMPLATE.md`, `explainer/`) predate this task and are not part of it.

## Completed

- `src/lib/types.ts`: `CREATOR_VOICE` (`elevenlabs:<voice ID>`), `voiceLabel`, `isElevenLabsVoice`; `UserSettings.elevenLabsApiKey`.
- `src/lib/elevenlabs.ts` (new): segmented ElevenLabs narration with neighbouring-text stitching, retries on 429/5xx, style-to-voice-settings mapping, key validation against the voice.
- `src/background/service-worker.ts`: routes the bonus voice to ElevenLabs.
- `src/lib/storage.ts`, `src/lib/narration.ts` (exports only), `src/manifest.ts` (host permission), `src/popup/Popup.tsx`, `src/styles/popup.css`, `src/options/Options.tsx`, `src/options/options.css`, `README.md`.

## Remaining

- Eric tests the bonus voice in Chrome with his ElevenLabs key.
- Merge the PR: Eric only.
- Not done: `demo/app/` was not rebuilt, so the live demo does not show the bonus voice yet.

## Blockers

- none

## Decisions needed (from Eric)

- Display name: implemented as "Creator" with a "Bonus" tag. Change if he prefers another name.
- Other users can hear the voice only if their ElevenLabs account can use it (for example, if it is shared in the ElevenLabs voice library). Unknown whether it is shared.

## Next step

Eric loads `dist/` in Chrome, adds his ElevenLabs key in settings, and plays an article in the Creator voice.

## Verification

| Check | Command | Result | State tested | When |
|---|---|---|---|---|
| type-check | `npx --no-install tsc --noEmit -p .` | passed | working tree at 1dfbf4a + this task's changes | 2026-11-16T15:22-05:00 |
| build | `npm run build` | passed | working tree at 1dfbf4a + this task's changes | 2026-11-16T15:22-05:00 |
| reading test | `npm run test:reading` | not run (costs ~$1 of OpenAI credit; covers only the OpenAI path, whose code changed only in exports and types) | | |

**Verification limits:** no ElevenLabs request was made (no key available to the agent), and the side panel and settings page were not checked visually.

## Evidence

- Commit 8c7693e on branch `speakeasy-elevenlabs-bonus-voice`, pushed.
- PR: https://github.com/ericediger/SPEAKEASY/pull/5

## Discrepancies found on resume

- none

## Log

- 2026-11-16T15:19-05:00 · Claude Code (session unknown) · created · task requested by Eric in chat; branch created from main at 1dfbf4a
- 2026-11-16T15:22-05:00 · Claude Code (session unknown) · updated · implementation complete; type-check and build passed; committed on the task branch
- 2026-11-16T15:31-05:00 · Claude Code (session unknown) · updated · Eric approved push and PR in chat ("Push and open PR"); branch pushed, PR 5 opened
