import type { StudySetInput } from '@workspace/api-client-react';
import type { StudySet } from '../study';

/** Never silently shorten generated notes while saving or syncing them. */
export function toInput(set: StudySet): StudySetInput {
  return {
    title: set.title.slice(0, 160) || 'Study set',
    sourceName: set.sourceName.slice(0, 160) || 'Notes',
    sourceText: set.sourceText,
    summary: set.summary,
    keyTerms: set.keyTerms,
    cramPoints: set.cramPoints,
    questions: set.questions,
    studyPlan: set.studyPlan,
    masteredTerms: set.masteredTerms ?? [],
    ...(set.theoryQuestions ? { theoryQuestions: set.theoryQuestions } : {}),
    ...(set.modes ? { modes: set.modes } : {}),
    ...(set.examMinutes ? { examMinutes: set.examMinutes } : {}),
    ...(set.tutorLesson ? { tutorLesson: set.tutorLesson } : {}),
  };
}
