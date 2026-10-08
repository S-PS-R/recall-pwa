export interface Folder { id: string; name: string; parentId?: string; createdAt: number; updatedAt: number }
export interface StudySet { id: string; folderId?: string; title: string; description?: string; sourceFilename?: string; importedAt?: number; createdAt: number; updatedAt: number }
export interface Flashcard { id: string; setId: string; front: string; back: string; position: number; normalizedKey: string; createdAt: number; updatedAt: number }
export interface CardProgress { cardId: string; dueAt?: number; repetitions: number; intervalDays: number; easeFactor?: number; state: 'new' | 'learning' | 'review' | 'mastered'; lastReviewedAt?: number; correctCount: number; incorrectCount: number }
export interface StudySession { id: string; setId: string; mode: 'flashcards' | 'learn' | 'test'; startedAt: number; finishedAt?: number; totalQuestions: number; correctAnswers: number; run?: import('./study').StudyRun }
export interface Setting { key: string; value: string }
export interface CardInput { front: string; back: string }
// Case and accents remain significant. JSON framing avoids separator collisions.
export const cardKey = (card: CardInput) => JSON.stringify([card.front.trim().normalize('NFC'), card.back.trim().normalize('NFC')]);
