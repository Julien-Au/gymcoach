import { exercises as english } from '../en/exercises';
import type { MessageShape } from '@/i18n/message-types';

export const exercises = {
  title: 'Каталог упражнений',
  savedCount:
    '{count, plural, =0 {Нет сохранённых упражнений.} one {Сохранено # упражнение.} few {Сохранено # упражнения.} many {Сохранено # упражнений.} other {Сохранено # упражнения.}}',
  search: 'Поиск упражнений по названию',
  emptyTitle: 'Нет упражнений',
  emptyDescription:
    'Каталог пуст. Добавьте первое упражнение, чтобы использовать его в программе.',
  noMatchTitle: 'Ничего не найдено',
  noMatchDescription: 'Упражнений по запросу «{query}» нет. Измените запрос.',
  restSeconds: 'отдых {seconds} с',
  editTitle: 'Изменить упражнение',
  addTitle: 'Добавить упражнение',
  formDescription: 'Укажите название, группу мышц и категорию.',
  muscleGroup: 'Группа мышц',
  category: 'Категория',
  defaultRest: 'Отдых по умолчанию (секунды)',
  bodyweight: 'Упражнение с собственным весом',
  bodyweightDescription:
    'Для подтягиваний, отжиманий и брусьев объём учитывает вес тела. Вводите только дополнительный вес; для противовеса укажите отрицательное значение.',
  notes: 'Заметки / инструкции (необязательно)',
  created: 'Упражнение создано.',
  updated: 'Упражнение обновлено.',
  deleted: 'Упражнение удалено.',
  saveError: 'Не удалось сохранить упражнение.',
  deleteError: 'Не удалось удалить упражнение.',
  deleteTitle: 'Удалить упражнение?',
  deleteDescription:
    '«{name}» будет удалено из каталога. Удаление невозможно, пока упражнение используется в программе или истории тренировок.',
  deleting: 'Удаление...',
  muscleGroups: {
    chest: 'Грудь',
    backWidth: 'Спина (ширина)',
    backThickness: 'Спина (толщина)',
    shouldersFront: 'Передние дельты',
    shouldersLateral: 'Средние дельты',
    shouldersRear: 'Задние дельты',
    biceps: 'Бицепс',
    triceps: 'Трицепс',
    forearms: 'Предплечья',
    quads: 'Квадрицепсы',
    hamstrings: 'Задняя поверхность бедра',
    glutes: 'Ягодицы',
    calves: 'Икры',
    abs: 'Пресс',
    lowerBack: 'Поясница',
    other: 'Другое',
  },
  categories: {
    compound: 'Базовое',
    isolation: 'Изолирующее',
    cardio: 'Кардио',
  },
} satisfies MessageShape<typeof english>;
