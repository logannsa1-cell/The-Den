import { BookOpen, GraduationCap, KeyRound, Layers, Lightbulb, ListChecks, PenLine, Timer } from 'lucide-react';
import type { StudyMode, StudySet } from '../study';

export type OutputTab = 'summary' | 'timed' | 'objective' | 'theory' | 'terms' | 'flashcards' | 'cram' | 'tutor';
export type StudyView = { id: OutputTab; label: string; Icon: typeof BookOpen };

export function setModes(set: Pick<StudySet, 'modes'>): StudyMode[] {
  return set.modes?.length ? (set.modes as StudyMode[]) : ['summary', 'objective'];
}

/** One ordered list for the desktop rail, phone and fullscreen selectors. */
export function studyViews(modes: StudyMode[], legacyCram = false): StudyView[] {
  const views: StudyView[] = [];
  if (modes.includes('timed')) views.push({ id: 'timed', label: 'Timed exam', Icon: Timer });
  if (modes.includes('tutor')) views.push({ id: 'tutor', label: 'Tutor lesson', Icon: GraduationCap });
  if (modes.includes('summary')) views.push(
    { id: 'summary', label: 'Notes', Icon: BookOpen },
    { id: 'terms', label: 'Key terms', Icon: KeyRound },
    { id: 'flashcards', label: 'Flashcards', Icon: Layers },
  );
  if (modes.includes('objective')) views.push({ id: 'objective', label: 'Objective', Icon: ListChecks });
  if (modes.includes('cram') || legacyCram) views.push({ id: 'cram', label: 'Cram sheet', Icon: Lightbulb });
  if (modes.includes('theory')) views.push({ id: 'theory', label: 'Theory', Icon: PenLine });
  return views.length ? views : [{ id: 'summary', label: 'Notes', Icon: BookOpen }];
}

export function setViews(set: Pick<StudySet, 'modes' | 'cramPoints'>): StudyView[] {
  return studyViews(setModes(set), !set.modes?.length && set.cramPoints.length > 0);
}
