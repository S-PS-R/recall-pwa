# Recall

A private, mobile-first flashcard library built from `QUIZLET_PWA_CODEX_PROJECT.md`. Milestones 1 and 2 are implemented with React, TypeScript, Vite, Tailwind CSS, Dexie, and `vite-plugin-pwa`. There is no backend, account, analytics, Google API, or file upload. No demo sets are seeded.

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
- Explicit acknowledgment before skipping invalid rows or importing a matching title/source as a **new** set. Nothing is overwritten. Cancel saves nothing. All selected sets are saved in one transaction.
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
- Lenient matching ignores case, extra whitespace and Latin accents. Hindi vowel signs and nukta stay significant. Strict matching retains case, accents and internal spacing. Both trim outer whitespace and consider canonically equivalent Unicode equal; neither removes punctuation.
- Every submitted answer, feedback state and Flashcards action is saved to IndexedDB before moving on. **Pause session**, or reopen the set's study options and choose **Resume**. Completed sessions offer **View results**. Unsubmitted text is not saved. The ten most recent sessions for the set appear in the UI; older history remains in storage.
- Sessions keep a snapshot of their starting card text so edits do not silently change grading mid-session. Start a new session to include edits. Deleting the set cascades its sessions. Storage failures show an error and retain the current question for retry.

No per-card review scheduling or mastery values are created by Milestone 2. Those belong to Milestone 3. Progress explains this distinction; actual session summaries are available under each set's study options.

### Updating your installed app

You do not need to stop or uninstall the existing phone app during development. After the new milestone is pushed, run the existing GitHub Pages workflow. Once deployment succeeds, open Recall online, return to **Library**, and tap **Update app** when offered. If no update prompt appears, close and reopen it online. Keep the same URL and do not clear website data: existing sets and sessions remain in IndexedDB. The update prompt is hidden on Study so it cannot reload an active question.

## Import format and safeguards

Each nonempty line is `term<TAB>definition`, using a literal tab. Hindi and English are supported without inserted prefixes or tags. Files are read with `File.text()` entirely on-device. The parser trims surrounding whitespace but preserves case, Unicode, combining characters, punctuation and user-authored labels. UTF-8 BOM and CRLF/LF/CR are handled. The **first tab** is the delimiter; later tabs remain inside the definition. Commas are never inferred as separators.

Exact pairs after trimming are counted as duplicates and skipped, visibly in preview. Distinct definitions for the same term remain separate cards. Invalid rows require explicit acknowledgment before saving the valid subset. Empty/unreadable files cannot be imported. Limits: **2 MiB per file, 5,000 nonempty rows per file, 20 files per selection**; files are read sequentially. Error displays cap at 100 lines, with the total shown. Set details render cards in batches of 50.

Card identity uses a JSON-framed NFC-normalized pair for future reconciliation; display text is not normalized. Reordering and renaming preserve card IDs and progress. Changing a card's content resets that card's review progress. Removing a card deletes its progress. Deleting a set also deletes its session history.

## iPhone installation and Files

1. Visit the deployed HTTPS URL in Safari while online.
2. Use Share → Add to Home Screen, then open Recall from its icon.
3. Wait for **Ready offline** on the initial caching session before disconnecting. Previously cached installations may display “On this device” on a later online launch; verify with airplane mode.
4. Tap **Import files**, browse Files and choose `.txt` or `.tsv` files. If Google Drive is installed and enabled as a Files location, it can supply the files. Download a local copy first if a provider cannot read a file.
5. Review the preview and confirm. Multiple selection varies by iOS version and provider; importing files one at a time also works.

Imported data stays on this device/browser. There is no automatic iPhone/computer sync or persistent access to a Drive folder. Browser data clearing, eviction, or removing the app can lose the library. **Keep original source files until backup/restore is implemented.** A persistent-storage grant is best effort and does not replace backups.

## Validation

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

`test:e2e` first builds at `/quizrep/` and starts a production preview. Windows uses installed Microsoft Edge; other platforms use Playwright Chromium (`pnpm exec playwright install chromium` first). Set `PLAYWRIGHT_CHANNEL` to override the installed browser channel. The mobile project emulates an iPhone viewport in Chromium; it **does not claim to test iOS Safari**.

Unit tests cover parser edge cases/limits/read failures, persistent reopen, validation, progress preservation/reset, foreign identity rejection, cascade deletion, v1 migration, and reset. Browser tests cover multi-file imports and skipped rows, no uploads/external requests, cancellation, duplicate-source acknowledgment, manual CRUD/reorder/confirmation, theme persistence, mobile overflow and actual service-worker offline reload at a repository subpath. Study tests cover matching rules, Hindi marks, unique test generation, alternate answers, tiny sets, retry limits, scoring, session persistence, keyboard controls, offline resume, and saved results. Screenshots and failing traces are written to ignored `test-results/`.

Verified in this Windows workspace: TypeScript passed, **24 unit tests passed**, **14 Edge/Chromium browser tests passed** across desktop and mobile emulation, and the production PWA build passed at `/quizrep/`. The generated service worker precaches approximately 425 KiB. Dependency peer checks report no issues. The editor pages through 25 cards at a time to avoid mounting thousands of text areas on a phone.

If pnpm is not available in your terminal, install the pinned pnpm version or use your environment's bundled pnpm executable. After dependency installation, you can also start development directly with `node node_modules/vite/bin/vite.js`.

Still verify on real iPhone Safari: Add to Home Screen and icon display; Files/Drive provider selection; VoiceOver and text scaling; keyboard and notch/safe-area behavior; cold start in airplane mode after installation; storage behavior after closing/reopening; app updates while an editor is open. Desktop emulation cannot establish these device-specific behaviors.

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

`src/app` owns navigation/shell and PWA status; `src/features/library` owns the library/editor/detail screens; `src/features/import` contains the independent parser and wizard; `src/db` owns schema/migrations/transactional operations; `src/domain` defines stable entities and identity; `src/components` contains shared dialogs; `src/styles` contains Tailwind plus responsive component styles. Study logic lives in `src/domain/study.ts`, session writes in `src/db/study.ts`, and study UI in `src/features/study`, `flashcards`, `learn` and `test`. Milestone 2 adds an optional `run` payload to existing session records without changing indexes, so the version-2 database remains compatible and no migration/reset is needed. Future schema/index changes must add a new Dexie version and migration test. `resetLibrary` is tested as an internal maintenance operation, not exposed as a destructive Settings button.

- Milestone 2 completed: flip/shuffle/reverse sessions, Learn, Test, local session resume and results.
- Milestone 3: deterministic review scheduling and real progress/activity.
- Milestone 4: merge/replace reimports, TXT export, validated JSON backup/restore, folders and optional desktop directory import, further accessibility polish. Search and basic responsive/offline handling were brought forward.

Original code-native icons live in `public/`; optional `scripts/generate-icons.py` regenerates the PNG icons using Pillow. Tailwind's Vite integration follows [its official installation guide](https://tailwindcss.com/docs/installation/using-vite), and service-worker registration follows [Vite PWA's guide](https://vite-pwa-org.netlify.app/guide/register-service-worker).
