# Local-First Flashcard PWA — Codex Project Brief

## Mission
Build a free, mobile-first Quizlet-style flashcard Progressive Web App (PWA) primarily for **iPhone**, also usable on a computer. It must function offline after installation and initial caching, without requiring a computer to remain on. Users import their own Quizlet-formatted `.txt` sets through the iOS Files picker (including Google Drive as a Files provider), and optionally import entire folders on supported desktop browsers.

**Start by implementing a working vertical slice, not merely a mockup.** Work in small, testable iterations. Do not build a paid backend, require accounts, or integrate the Google Drive API for v1.

## Important product constraints
- **Cost:** Free tools and hosting, no subscription, no mandatory server/backend, no paid APIs.
- **Platform:** iPhone Safari installed via Add to Home Screen first; desktop Chrome/Edge/Safari second.
- **Stack:** React + TypeScript + Vite, Tailwind CSS, IndexedDB via Dexie, Vite PWA plugin (`vite-plugin-pwa`), React Router if routing is useful. Use accessible, touch-friendly UI components.
- **Hosting:** Static deploy on GitHub Pages (public repository on free plan) or equivalent static hosting; no need for developer's computer to stay running. Build paths/base URLs must work under GitHub Pages repository subpaths; document deployment process.
- **Offline:** Cache app shell/assets via service worker. Imported sets and study state live in IndexedDB. Imported flashcards are device-local: **no automatic sync** between iPhone and computer. Offer explicit backup/restore for transfer.
- **Terminology:** Use 'flashcards', 'study sets', 'Learn', 'Test', 'Folders', and 'Progress'. Create an original interface inspired by modern study apps rather than copying Quizlet branding/assets or exact appearance.
- **No Google integration for v1:** iOS Files can expose Google Drive if enabled. Users select files manually. A web app cannot assume persistent access to an iPhone's Drive folder or silently monitor Drive changes.

## Core UX / information architecture
Bottom navigation on mobile: **Library**, **Study**, **Progress**, **Settings**.

### Library screen
- Display app-managed folders and sets, with names, card count, last studied, mastery progress, offline availability.
- Add Folder; rename/move/delete folder or set with confirmation for destructive actions.
- Search/filter sets, optionally by folder.
- Primary **Import Files** button opens iOS Files picker; accept `.txt` and `.tsv` (optionally `.csv` in later milestone); support selecting multiple files where browser allows.
- Each imported file defaults to a separate study set, with title derived from filename (editable before saving).
- Provide **Refresh / Reimport** flow: user manually chooses a new copy of a file; no automatic Drive monitoring.
- Desktop: support conventional multi-file import first; progressive enhancement for folder import via `webkitdirectory` or File System Access API when available, with clear fallback. Do not promise reliable folder-picker support on iPhone.

### iPhone file-import wizard
1. User taps **Import Files**.
2. Open browser's native file picker (e.g. `<input type="file" accept=".txt,.tsv,text/plain,text/tab-separated-values" multiple>`). In iOS Files, user can browse **Google Drive** under Locations when the Google Drive app/provider is enabled. Avoid claiming all iOS versions/providers support every selection behavior.
3. Read files entirely on-device with `File.text()`; avoid uploading file content anywhere.
4. Parse and validate; show detected cards, preview the first few, counts of accepted/invalid/duplicate rows, filename, editable title, and errors with line numbers.
5. Confirm import into IndexedDB and show success summary; navigate to set.
6. If title/source appears to match an existing set, ask whether to **Import as new**, **Merge**, or **Replace**. No automatic destructive overwrite. Preserve study progress for unchanged cards when merging/replacing, using a stable normalized card identity or explicit mapping. Warn before deleting any cards.

### Import format (v1)
Each nonempty line is one card: `Hindi<TAB>English` (or more generally `term<TAB>definition`). The **front must be the literal Hindi term/phrase** and the back its English meaning, **with no additional '[Lesson]' tags, bracketed labels, or explanatory prefixes inserted**. Preserve user-authored text and punctuation.

Example (these columns are separated by literal tab characters in the file):

```tsv
Namaste	Hello
Kya haal hai?	How are you?
Main theek hoon	I am fine
Ladka	Boy
Ladki	Girl
```

Parser rules:
- Handle UTF-8 BOM, CRLF/LF line endings, blank lines, surrounding whitespace.
- Split by first tab (or document how additional tabs are handled), validate both sides are nonempty.
- Preserve original order and Unicode/diacritics; avoid destructive normalization for display.
- Detect exact duplicate pairs within a file; report or optionally skip duplicates, but do not silently delete distinct cards sharing a term.
- Do not treat commas as delimiters in `.txt` by default.
- Provide actionable errors for rows with no tab, empty term/answer, read failure, or empty file.
- Enforce reasonable per-file size/card-count safeguards to avoid freezing mobile UI. Provide meaningful feedback.
- Implement parser as a pure, separately unit-tested function.

## Intermediate-level study features (v1 goal)

### Flashcards
- Tap/swipe-friendly flip cards; Previous / Next; shuffle; reverse term/definition direction; keyboard shortcuts on desktop.
- Mark cards **Again**, **Hard**, **Good**, or **Easy** for spaced-repetition review.
- Optional progress indicator and resume where the user left off.

### Learn mode
- Mix multiple-choice and typed-answer questions with a mode toggle.
- Retry missed cards more frequently within a session.
- Be sensitive to accent/whitespace/case normalization for typed answers; offer a setting for strict vs lenient matching, and show the expected answer when wrong.
- Multiple-choice distractors must come from real definitions in that set; gracefully handle tiny sets.
- Show immediate feedback and end-of-session summary.

### Test mode
- Generate customizable randomized tests (multiple choice and written answers), with score and review of mistakes; do not count the same card twice unless explicitly chosen.

### Spaced repetition and progress
- Use a documented simple scheduling algorithm (e.g., SM-2-like or an easier deterministic interval model). Track per-card repetitions, ease/difficulty, due date, last reviewed, and learning state.
- Clearly separate **study session correctness** from **long-term mastery**.
- Show due cards, mastery counts, accuracy, and recent activity. Review scheduling must be testable and deterministic, with time injected into functions for tests.

### Editing
- Create a set manually, add/edit/delete cards, reorder cards, rename sets, and manage folders.
- Allow exporting a set as Quizlet-compatible tab-separated `.txt` with no extraneous labels.

## Data/storage design
Use IndexedDB (Dexie) with a versioned schema and explicit migrations. Suggested entities:

- `Folder`: `{ id, name, parentId?, createdAt, updatedAt }` (nested folders optional in MVP).
- `StudySet`: `{ id, folderId?, title, description?, sourceFilename?, importedAt?, updatedAt, createdAt }`.
- `Flashcard`: `{ id, setId, front, back, position, normalizedKey?, createdAt, updatedAt }`.
- `CardProgress`: `{ cardId, dueAt?, repetitions, intervalDays, easeFactor?, state, lastReviewedAt?, correctCount, incorrectCount }`.
- `StudySession`: `{ id, setId, mode, startedAt, finishedAt?, totalQuestions, correctAnswers }`.
- `Settings`: study direction, answer comparison mode, theme, etc.

Use UUIDs or similar stable identifiers. Deleting a set should cascade/reconcile dependent progress and sessions; migration and reset behavior must be tested.

## Backups and data safety
- Implement **Export Library Backup** to generate a versioned JSON file containing folders, sets, cards, progress, settings, and study history.
- Implement **Restore Backup** with validation, preview, and clear choice of replace vs merge; reject invalid versions/formats safely. Do not destroy existing data before validating a backup.
- Make it easy to save the downloaded backup to Files / Google Drive using the iOS Share sheet / Files workflow when available; do not assume direct write access to a Drive folder.
- Show concise warning: local iPhone browser data can be lost if website data is cleared, storage is evicted, or the app is removed. A backup is recommended.
- Ask for persistent storage where supported, but treat it as best effort rather than guaranteed on iOS.
- No analytics, trackers, or uploads of imported content by default.

## UI/UX quality bar
- Design **mobile-first** for typical iPhone screen widths; minimum ~44px tap targets; support safe areas/notches, portrait mode, dark/light themes, readable typography, VoiceOver labels, focus states, reduced-motion preferences.
- Fast launch, fluid but modest flip animation, helpful loading/empty/error states, responsive desktop layout.
- Use system fonts and icon packages. No copyrighted Quizlet logos/graphics.
- Make the study screen usable with one hand; avoid menus obscuring the answer.
- Clearly label mock/demo data; never pretend sample cards were imported.

## Suggested file structure
```text
src/
  app/             # routing, shell and providers
  components/      # shared UI elements
  features/
    library/
    import/
    flashcards/
    learn/
    test/
    progress/
    backup/
  db/              # Dexie schema/migrations
  domain/          # types, study scheduler, grading logic
  utils/
  styles/
public/            # icons, web manifest assets
```

## Implementation plan for Codex

### Milestone 1 — Scaffolding and persistent library
- Create Vite React TypeScript project with Tailwind and Dexie.
- Set up PWA manifest and offline service worker, including GitHub Pages base-path handling.
- Build polished responsive Library and Set detail screens.
- Create IndexedDB schema, CRUD, and seed **optional clearly marked demo data only**.
- Build tab-separated `.txt` parser with tests.
- Implement multi-file iOS Files import, validation, preview and confirmation; verify no backend/network upload.
- Implement manual card/set creation and editing.

### Milestone 2 — Study modes
- Implement flip/shuffle/reverse flashcards.
- Add Learn mode (multiple choice and typed-answer), retry behavior, and session scoring.
- Add Test mode with results and error review.

### Milestone 3 — Spaced repetition and progress
- Add review algorithm, due-card queue, progress summaries, streaks only if accurately computed.
- Track and persist progress across app restarts.

### Milestone 4 — Export, backup, and polish
- Add import-replace/merge behavior preserving progress on unchanged cards.
- Add `.txt` set export and JSON library backup/restore.
- Add folders, search, accessibility, offline/error states, and responsive polish.
- Provide clear README with iPhone installation and free deployment steps.

## Acceptance criteria
1. On iPhone Safari, selecting one or more TXT files from Files (including Google Drive when available) imports separate sets without uploading content to a server.
2. Imported cards display **exactly** as their Hindi/English sides were written, without bracket prefixes or lesson tags added by the app.
3. Imported sets and progress survive closing and reopening the installed PWA; the app can study them while offline after caching.
4. Learn and Test modes produce correct grading, summaries, and review scheduling; a small set doesn't crash multiple-choice generation.
5. Files can be reimported manually without accidental data loss; unchanged card progress is preserved when appropriate.
6. Library backups can be exported, validated and restored on another device.
7. PWA builds/deploys to free static hosting and works on mobile and desktop without leaving a developer computer running.
8. TypeScript typecheck, unit tests, and production build pass; document any iOS-specific behaviors that must be manually verified on a real device.

## Recommended testing
- Vitest + React Testing Library for parser, scheduler, grading, imports, and UI logic.
- Playwright for desktop functional flows; explicitly flag iOS Safari behaviors needing manual device testing.
- Test BOM, Unicode Hindi, CRLF, blank/malformed lines, duplicate terms, extra tabs, large files, backup corruption, offline startup, database migration, and merging changed sets.

## First instruction to Codex
**Implement Milestone 1 now.** Inspect the current repository first; if it is empty, scaffold it. Create the actual source files and tests, run the typecheck/test/build commands, fix failures, and summarize what runs and what remains. Prioritize a polished iPhone Library UI, a robust import wizard using the native Files picker, and reliable local persistence. Do not stop after writing a plan. Do not add a Google Drive OAuth/API integration, paid services, user accounts, or server-side dependencies.
