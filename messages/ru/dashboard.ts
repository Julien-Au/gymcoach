import { dashboard as english } from '../en/dashboard';
import type { MessageShape } from '@/i18n/message-types';

export const dashboard = {
  activeSession: 'Активная тренировка',
  sessionFallback: 'Тренировка',
  startedOn: '{name}, начало: {date}',
  resumeSession: 'Продолжить тренировку',
  noActiveProgram: 'Нет активной программы',
  noActiveProgramDescription: 'Активируйте программу, чтобы начать тренировку.',
  viewPrograms: 'Открыть программы',
  emptyProgram: 'Пустая программа',
  emptyProgramDescription: 'В программе «{name}» не настроены тренировки.',
  configureProgram: 'Настроить программу',
  startSession: 'Начать тренировку',
  activeProgram: 'Активная программа: {name}',
  chooseSession: 'Выбрать тренировку',
  programSessions: 'Тренировки программы',
} satisfies MessageShape<typeof english>;
