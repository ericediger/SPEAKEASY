---
record: task-handoff
standard: coordination-v1
task_id: speakeasy-20261116-release-zip
title: Downloadable zip of the extension, with foolproof install steps
folder: SPEAKEASY
status: active
owner:
  tool: Claude Code
  session_id: unknown (desktop app session started 2026-11-16 ~15:15-05:00, ElevenLabs bonus voice)
  since: 2026-11-16T15:29-05:00
reviewers: []
coordinator: Pasta
project_owner: Eric
released_to: none
escalation_pending: false
closed_reason: none
branch: speakeasy-release-zip
base_branch: speakeasy-elevenlabs-bonus-voice (stacked on PR 5 so the first zip includes the bonus voice; retarget to main once PR 5 merges)
worktree: main checkout
latest_commit: d2eca21 (base)
uncommitted_changes: none from this task (committed on the task branch; see Log)
depends_on: [speakeasy-20261116-elevenlabs-bonus-voice]
blocks: []
milestones:
  implementation_complete: yes
  verified: no
  ready_for_owner_testing: yes
  accepted: no
  merged: no
  deployed: no
updated_at: 2026-11-16T15:33-05:00
updated_by: Claude Code (session unknown, see owner)
---

# speakeasy-20261116-release-zip: Downloadable zip of the extension, with foolproof install steps

## Goal

Let people without developer tools install SpeakEasy from a zip attached to a GitHub release, with install instructions anyone can follow.

## Acceptance criteria

- Eric (2026-11-16): "Yes, set up zip", then "update instructions or README to make it really, really, idiot-proof".

## Scope

- **In scope:** a packaging script and npm command, a plain-text install guide shipped inside the zip, the README install section, `.gitignore` (one line for the zip output folder).
- **Out of scope:** publishing the GitHub release (public action, Eric's OK needed), Chrome Web Store, the bonus-voice feature (task speakeasy-20261116-elevenlabs-bonus-voice, PR 5).
- **Shared resources touched:** none.

## Current state

`npm run package` builds the extension and writes `release/speakeasy-<version>.zip` (ignored by git), holding one `SpeakEasy` folder with the extension and `HOW TO INSTALL.txt`. The README now opens with a download link and a step-by-step install section for non-developers; building from source moved under Development. No GitHub release has been published. Unrelated uncommitted files in the checkout (`.gitignore` coordination block, `AGENTS.md`, `CLAUDE.md`, coordination docs, `explainer/`) predate this task and are not part of it.

## Completed

- `scripts/package.mjs`, `scripts/install-guide.txt`, `package.json` (`package` script), `README.md`, `.gitignore` (`release/` line only).

## Remaining

- Eric test-installs the zip in Chrome by following the guide.
- Push, PR, merge PR 5 then this one; then publish a GitHub release with the zip attached (each needs Eric's OK).

## Blockers

- none

## Decisions needed (from Eric)

- Version for the first release: the manifest still says 2.1.0, the same as the current `main` without the bonus voice. Bumping to 2.2.0 would mean editing `src/manifest.ts`, `package.json` and the settings-page footer.

## Next step

Eric unzips `release/speakeasy-2.1.0.zip` and installs it by following `HOW TO INSTALL.txt`.

## Verification

| Check | Command | Result | State tested | When |
|---|---|---|---|---|
| package | `npm run package` | passed: 72 KB zip, one `SpeakEasy` folder, every manifest-referenced file present, no `__MACOSX`/`.DS_Store`/`.vite` | working tree at d2eca21 + this task's changes | 2026-11-16T15:31-05:00 |

**Verification limits:** the zip was not loaded into Chrome, and the install guide hasn't been followed end to end on Mac or Windows. Windows "Extract All" behaviour is described from general knowledge, not tested.

## Evidence

- Commit on branch `speakeasy-release-zip` (see Log).

## Discrepancies found on resume

- none

## Log

- 2026-11-16T15:29-05:00 · Claude Code (session unknown) · created · requested by Eric in chat; branch created from main at 1dfbf4a
- 2026-11-16T15:30-05:00 · Claude Code (session unknown) · updated · branch reset onto speakeasy-elevenlabs-bonus-voice (d2eca21) before any commit, so the zip and README include the bonus voice
- 2026-11-16T15:33-05:00 · Claude Code (session unknown) · updated · implementation complete; npm run package passed; committed on the task branch
