# Recall

A private, mobile-first flashcard library built from `QUIZLET_PWA_CODEX_PROJECT.md`. Milestones 1–4 are implemented with React, TypeScript, Vite, Tailwind CSS, Dexie, and `vite-plugin-pwa`. There is no backend, account, analytics, Google API, or file upload. No demo sets are seeded.

## Run locally

Use Node.js 24 and pnpm 11.19.0 (the package manager version is pinned in `package.json`).

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the local address printed by Vite. Development mode does not install a service worker. For an offline-capable production preview:

```sh
pnpm build
pnpm preview
```

The default build base is `/`. To test a GitHub Pages repository subpath in PowerShell:

```powershell
$env:VITE_BASE_PATH = '/quizrep/'
pnpm build
pnpm preview
```

Open `http://127.0.0.1:4173/quizrep/`. On macOS/Linux, use `VITE_BASE_PATH=/quizrep/ pnpm build`. A nonroot base must start and end with `/`. Routes use URL hashes so set links work on static hosting without rewrite rules. Keep the site origin and base stable: local storage is tied to the browser origin, and changing hosts does not transfer a library.

## What works

- Responsive Library and Set detail screens, search, sort, safe-area-aware mobile navigation, system/light/dark theme, keyboard focus states and native modal focus trapping.
- Local multi-file `.txt`/`.tsv` import via the browser Files picker: editable titles, accepted/invalid/duplicate counts, first-three-card preview, line-numbered errors, selection, confirmation and success summary.
- Explicit acknowledgment before skipping invalid rows, creating duplicate sets, merging cards, or replacing cards. Cancel saves nothing. All selected files are saved in one transaction.
- Manual set/card creation, title/description editing, card editing, reorder, confirmed card removal and confirmed set deletion.
- Persistent IndexedDB storage, transactional CRUD, cascading deletion of associated cards/progress/history, and an explicit v1 → v2 migration that backfills normalized identity keys without changing display text.
- Offline app-shell precaching, manifest and PNG install icons, subpath support, and a user-controlled update prompt. Updates wait until editors/import dialogs are closed and you leave Study. First installation claims the open page once caching completes; updates still require user confirmation.
- Best-effort persistent-storage request and clear local-data limitations in Settings.

## Study modes (Milestone 2)

Open a set and tap **Study this set**, or select it from the **Study** tab.

- **Flashcards:** tap to flip, Previous/Next, swipe left/right, shuffle and reverse direction. Space flips and arrow keys navigate when no interactive control has focus. The revealed-card count is a session browsing count, not correctness or mastery.
- **Learn:** choose Mixed, Multiple choice or Written answers. Immediate feedback shows the expected answer. Misses return after up to two other questions, with at most three attempts per card. The summary separates first-attempt accuracy from correctness across all attempts and lists mistakes.
- **Test:** choose 1–100 unique cards (bounded by set size), direction, question style and matching rules. Questions are randomized without repeats. Submitted answers are final; score and mistake review appear after the last question.
- Multiple-choice options come from the actual set and exclude equivalent or alternate correct answers. A question falls back to written when no distinct incorrect answer exists, including one-card sets. Identical prompts with distinct definitions accept any corresponding definition when typed.
- Both matching modes ignore capitalization and word punctuation (including smart apostrophes and Hindi danda). Lenient also ignores extra whitespace and Latin accents; Strict keeps accents and internal spacing significant. Hindi vowel signs and nukta stay significant in both. Numeric punctuation and mathematical symbols remain significant: `1.5` is not `15`, and `-1` is not `1`. This is deterministic matching, not semantic/AI grading. Already-submitted historical answers are not regraded.
- Every submitted answer, feedback state and Flashcards action is saved to IndexedDB before moving on. **Pause session**, or reopen the set's study options and choose **Resume**. Completed sessions offer **View results**. Unsubmitted text is not saved. The ten most recent sessions for the set appear in the UI; older history remains in storage.
- Sessions keep a snapshot of their starting card text so edits do not silently change grading mid-session. Start a new session to include edits. Deleting the set cascades its sessions. Storage failures show an error and retain the current question for retry.

## Spaced repetition and progress (Milestone 3)

- Reveal a Flashcard, then rate it **Again**, **Hard**, **Good**, or **Easy**. Each button previews the next interval. One rating is recorded per card per session; flips alone do not count as reviews.
- The first answer to each card in a Learn/Test session schedules **Good** if correct and **Again** if incorrect. Learn retries still affect the session score but never repeatedly promote a card. Both directions share one card schedule.
- **Progress** shows due, new, learning and mastered counts; a long-term mastery bar; first-attempt quiz accuracy; and the latest 20 review events (filterable by set). Library tiles and set details show mastery, due counts and last review date. Counts refresh every 30 seconds and when returning to the app.
- **Review due cards** opens a set containing only currently due cards. Flashcards keeps oldest-due order; Learn/Test still randomize. Unseen cards are shown separately as new and are not labelled overdue. Extra practice is available at any time.
- Earlier session history is retained but never retroactively scheduled. The first review after this update starts a card's schedule. Deleting a set removes its reviews; editing a card's meaning resets that card's schedule and removes its review events, while retaining historical session scores. Old session snapshots cannot recreate progress for changed cards.
- Review events, progress, session state and saved options are written in one transaction. Unique session/card event IDs prevent double counting. Session revisions reject conflicting writes from another tab; pause and resume the saved version after a conflict. Failed writes retain the current question.

### Scheduling rule

`src/domain/scheduler.ts` is pure and receives the current time explicitly. It uses elapsed 24-hour days (not local calendar-day boundaries), independent of daylight-saving changes:

| Rating | Next interval when due/new | Other effects |
| --- | --- | --- |
| Again | 10 minutes | Reset successful repetitions; return to learning; ease −0.2 |
| Hard | At least 1 day, otherwise previous interval ×1.2 rounded up | Reset successful repetitions; learning; ease −0.15 |
| Good | 1 day initially, then at least 3 days or previous interval ×ease rounded up | One successful repetition |
| Easy | At least 4 days or previous interval ×(ease +0.5) rounded up | One successful repetition; ease +0.15 |

Ease starts at 2.5 and is bounded to 1.3–3.0. Intervals are capped at 365 days. A card is **mastered** after at least three successful scheduled reviews and an interval of at least seven days; this is an explicit app heuristic, not a guarantee of permanent recall. Practising early does not advance repetitions or postpone the due date. Early Hard demotes to learning without moving the due date; Again always schedules a short retry. A later failure removes mastery. No streak is displayed, avoiding misleading day/time-zone assumptions.

### Readability and correct-answer feedback

A higher-contrast navy/indigo palette replaces the low-contrast muted greens, with distinct text, input boundaries, focus rings and selected states in light and dark themes. Automated tests read the actual CSS tokens and check text at ≥4.5:1 and key control/focus boundaries at ≥3:1. This follows [WCAG text contrast](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html); it is not a claim of a full accessibility audit. Correct/incorrect states also have text and icons, so color is not the only cue.

[Quizlet's grading guide](https://help.quizlet.com/hc/en-us/articles/360048313652-Using-grading-options-US) accepts case/punctuation differences even in Strict mode. Its [Learn](https://help.quizlet.com/hc/en-us/articles/360030986971-Studying-with-Learn) and [Write](https://help.quizlet.com/hc/en-us/articles/360030990531-Studying-with-Write-mode) guides describe answer entry and error correction, but do not establish the exact current correct-answer transition. We therefore do not claim identical behavior. Recall's revised correct-answer panel removes duplicate answer/expected-answer blocks, shows a concise checkmarked confirmation, and provides a wide **Next question** button plus Enter support. Wrong answers keep detailed feedback. Nothing advances on a timer, so learners and screen readers control the pace.

### Updating your installed app

You do not need to stop or uninstall the existing phone app during development. After the new milestone is pushed, run the existing GitHub Pages workflow. Once deployment succeeds, open Recall online, return to **Library**, and tap **Update app** when offered. If no update prompt appears, close and reopen it online. Keep the same URL and do not clear website data: existing sets and sessions remain in IndexedDB. The update prompt is hidden on Study so it cannot reload an active question.

## Export, backup, and organization (Milestone 4)

- **Folders:** Library → Add folder; rename or delete from the folder list. Open a set and use its Folder selector to move it. Filter the Library by folder or Unfiled while searching. Deleting a folder requires confirmation and keeps all its sets, cards, progress and history in Unfiled. Folder nesting is not exposed in this version.
- **Refresh / Reimport:** open a set, tap Refresh / Reimport, then manually choose the latest TXT/TSV file. Choose Import as new, Merge, or Replace and select the destination. Merge keeps the existing order and adds new pairs. Replace follows file order and displays how many cards will be removed before confirmation. The preview title becomes the destination title; its description and folder remain unchanged. Unchanged NFC-normalized term/definition pairs retain their IDs, schedules and review events. Changed pairs are new cards; removed cards lose their schedules and review events, while historical session snapshots remain. A changed destination or repeated destination within one batch aborts the whole batch.
- **TXT export:** open a set → Export TXT. Exports literal terms, a tab, and definitions in displayed order, with no inserted labels. Additional tabs in definitions are retained. Terms containing tabs, or either side containing line breaks, cannot be represented by the import format; the UI directs you to JSON backup instead of silently changing the text. TXT exports do not contain progress.
- **Full backup:** Settings → Export library backup downloads a versioned JSON snapshot of all seven tables: folders, sets, cards, progress, sessions, settings and review events. Export reads one consistent transaction. On iPhone, open the browser download and use Share → Save to Files; choose Google Drive if its Files provider is enabled. Keep the file outside browser storage.
- **Restore:** Settings → Restore backup → select the JSON file → review counts and date. **Merge** adds every backed-up set/folder as a separate copy with its progress and sessions, retaining the current device’s preferences. It does not deduplicate or combine two devices’ progress; repeat imports create duplicates. **Replace** removes the current library and restores all backup data, including preferences, only after explicit confirmation. Both methods assign fresh IDs and remap all references, including deleted-card snapshots, so old open tabs cannot overwrite restored sessions. Card contents, scheduling dates and session states are preserved.
- Restore validates format/version, record types, unique identifiers, references, card identities, session indexes and answer totals before writing. Validation runs again at the write boundary. All restore writes, including replacement clearing, are one atomic transaction: a failure leaves the original library intact. Backup version 1 and files up to **25 MiB** are supported; larger or unsupported files fail with an explanation. Backups are plain JSON, not encrypted. No file contents are uploaded.
- **Desktop directory import:** Settings → Import desktop folder uses the browser’s directory picker when supported and selects TXT/TSV files recursively. The normal 20-file / 2 MiB-per-file / 5,000-row limits apply. Each file becomes a separate set; directory hierarchy is not converted to folders. Other files are ignored. On iPhone or unsupported browsers, use Import files instead.

No new dependency, backend, or database schema version is required for Milestone 4. Existing Milestone 3 scheduling, matching, feedback, and session persistence are unchanged. Data dialogs suppress the update prompt until they finish. Restore and reimport work offline once the app is cached and the source file is available locally.

## Import format and safeguards

Each nonempty line is `term<TAB>definition`, using a literal tab. Hindi and English are supported without inserted prefixes or tags. Files are read with `File.text()` entirely on-device. The parser trims surrounding whitespace but preserves case, Unicode, combining characters, punctuation and user-authored labels. UTF-8 BOM and CRLF/LF/CR are handled. The **first tab** is the delimiter; later tabs remain inside the definition. Commas are never inferred as separators.

Exact pairs after trimming are counted as duplicates and skipped, visibly in preview. Distinct definitions for the same term remain separate cards. Invalid rows require explicit acknowledgment before saving the valid subset. Empty/unreadable files cannot be imported. Limits: **2 MiB per file, 5,000 nonempty rows per file, 20 files per selection**; files are read sequentially. Error displays cap at 100 lines, with the total shown. Set details render cards in batches of 50.

Card identity uses a JSON-framed NFC-normalized pair for reimport reconciliation; display text is not normalized. Reordering and renaming preserve card IDs and progress. Changing a card's content resets that card's review progress. Removing a card deletes its progress. Deleting a set also deletes its session history.

## iPhone installation and Files

1. Visit the deployed HTTPS URL in Safari while online.
2. Use Share → Add to Home Screen, then open Recall from its icon.
3. Wait for **Ready offline** on the initial caching session before disconnecting. Previously cached installations may display “On this device” on a later online launch; verify with airplane mode.
4. Tap **Import files**, browse Files and choose `.txt` or `.tsv` files. If Google Drive is installed and enabled as a Files location, it can supply the files. Download a local copy first if a provider cannot read a file.
5. Review the preview and confirm. Multiple selection varies by iOS version and provider; importing files one at a time also works.

Imported data stays on this device/browser. There is no automatic iPhone/computer sync or persistent access to a Drive folder. Browser data clearing, eviction, or removing the app can lose the library. **Export library backups regularly and save them outside this browser.** A persistent-storage grant is best effort and does not replace backups.

## Validation

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

`test:e2e` first builds at `/quizrep/` and starts a production preview. Windows uses installed Microsoft Edge; other platforms use Playwright Chromium (`pnpm exec playwright install chromium` first). Set `PLAYWRIGHT_CHANNEL` to override the installed browser channel. The mobile project emulates an iPhone viewport in Chromium; it **does not claim to test iOS Safari**.

Milestone 4 tests cover reimport reconciliation, stale-preview rejection, atomic batch/restore rollback, malformed backups, all-table round trips, retained scheduling, resumed sessions without double reviews, deleted-card snapshots, merge isolation, folder lifecycle and TXT fidelity. Browser tests exercise these data flows offline and preserve the existing study regression suite.

Unit tests cover parser edge cases/limits/read failures, persistent reopen, validation, progress preservation/reset, foreign identity rejection, cascade deletion, v1 migration, and reset. Browser tests cover multi-file imports and skipped rows, no uploads/external requests, cancellation, duplicate-source acknowledgment, manual CRUD/reorder/confirmation, theme persistence, mobile overflow and actual service-worker offline reload at a repository subpath. Study tests cover matching rules, Hindi marks, unique test generation, alternate answers, tiny sets, retry limits, scoring, session persistence, keyboard controls, offline resume, and saved results. Screenshots and failing traces are written to ignored `test-results/`.

Verified in this Windows workspace: TypeScript passed, **44 unit tests passed**, **24 Edge/Chromium browser tests passed** across desktop and mobile emulation, and the production PWA build passed at `/quizrep/`. The generated service worker precaches approximately 460 KiB. Dependency peer checks report no issues. The editor pages through 25 cards at a time to avoid mounting thousands of text areas on a phone.

If pnpm is not available in your terminal, install the pinned pnpm version or use your environment's bundled pnpm executable. After dependency installation, you can also start development directly with `node node_modules/vite/bin/vite.js`.

Still verify on real iPhone Safari: Add to Home Screen and icon display; Files/Drive provider selection; VoiceOver and text scaling; keyboard and notch/safe-area behavior; cold start in airplane mode after installation; storage behavior after closing/reopening; app updates while an editor is open; rating button reachability; correct-answer Enter/Next interaction with VoiceOver; due counts after returning from the background. Also verify backup downloads → Share → Save to Files, JSON selection from Files/Drive, and restore on a second iPhone. Desktop emulation cannot establish these device-specific behaviors.

## Free static hosting

The included workflow runs **manually only**. Pushing a milestone does not automatically deploy the site.

1. Put this directory in a public GitHub repository (for free GitHub Pages).
2. In repository Settings → Pages, choose GitHub Actions as the source.
3. In Actions, run **Validate and deploy Recall**. It installs from the lockfile, typechecks, runs unit and browser tests, builds for the repository name, and publishes `dist/`.
4. Visit the URL reported by the workflow. For a repository called `quizrep`, the base is `/quizrep/`; for `username.github.io`, it is `/`.

You can also deploy `dist/` to a static HTTPS host with the matching base path. No developer computer needs to stay on after deployment.

For this project's `S-PS-R/recall-pwa` repository, open **Settings → Pages → Build and deployment → Source → GitHub Actions**, then **Actions → Validate and deploy Recall → Run workflow → main → Run workflow**. Once the workflow succeeds, the expected URL is `https://s-ps-r.github.io/recall-pwa/`. Open that URL in iPhone Safari and follow the installation steps above. The URL will not serve the app until Pages is enabled and the first deployment succeeds.

Completed milestones are committed and pushed to GitHub after validation, with immutable annotated `milestone-N` tags. After a later milestone is pushed, run the same deployment workflow again to update the phone-accessible site.

## Architecture and remaining milestones

`src/app` owns navigation/shell and PWA status; `src/features/library` owns the library/editor/detail screens; `src/features/import` contains the independent parser and wizard; `src/db` owns schema/migrations/transactional operations; `src/domain` defines stable entities and identity; `src/components` contains shared dialogs; `src/styles` contains Tailwind plus responsive component styles. Study logic lives in `src/domain/study.ts`, session writes in `src/db/study.ts`, and study UI in `src/features/study`, `flashcards`, `learn` and `test`. Milestone 2 adds an optional `run` payload to sessions. Milestone 3 upgrades IndexedDB from version 2 to version 3, adding a review-event table while retaining sets, cards, progress, settings and sessions. Migration tests verify this. Optional session revisions and source identity keys support safe concurrent saves and snapshot validation. Future schema/index changes must add a new Dexie version and migration test. `resetLibrary` is tested as an internal maintenance operation, not exposed as a destructive Settings button.

- Milestone 2 completed: flip/shuffle/reverse sessions, Learn, Test, local session resume and results.
- Milestone 3 completed: deterministic review scheduling, due queues, real progress/activity, high-contrast colors and improved answer matching/feedback.
- Milestone 4 completed: merge/replace reimports, TXT export, validated JSON backup/restore, folders, desktop directory import, accessible confirmation dialogs and responsive data tools. PDF generation is not included.

Original code-native icons live in `public/`; optional `scripts/generate-icons.py` regenerates the PNG icons using Pillow. Tailwind's Vite integration follows [its official installation guide](https://tailwindcss.com/docs/installation/using-vite), and service-worker registration follows [Vite PWA's guide](https://vite-pwa-org.netlify.app/guide/register-service-worker).
