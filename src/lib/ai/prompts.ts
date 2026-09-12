/**
 * Client-safe constants for the Assistant.
 *
 * Deliberately its own module with no imports: the composer is a client
 * component, and pulling these from `answer.ts` would drag the whole analysis
 * engine — and through it `next/headers` — into the browser bundle.
 */

export const SUGGESTED_QUESTIONS = [
  "How is the farm doing?",
  "Which flock needs attention?",
  "How much feed do I have left?",
  "Am I making money this month?",
  "How are my eggs doing?",
  "What is my mortality?",
  "What is due this week?",
  "Which of my customers owes me money?",
];
