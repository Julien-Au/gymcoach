import type { Locale } from '@/i18n/config';

type ExerciseNameDictionary = Readonly<Record<string, string>>;

// Exercise identity stays in the database and API payloads exactly as stored.
// These dictionaries are display-only, so another locale can be added without
// coupling exercise data to the application's message catalog.
export const exerciseNameDictionaries: Partial<Record<Locale, ExerciseNameDictionary>> = {
  ru: {
    'Back extension (hyperextension)': 'Гиперэкстензия',
    'Back Squat': 'Приседания со штангой на спине',
    'Barbell bench press': 'Жим штанги лёжа',
    'Barbell Curl': 'Сгибание рук со штангой',
    'Barbell good morning': 'Наклоны «доброе утро» со штангой',
    'Barbell hip thrust (or machine)': 'Ягодичный мост со штангой (или в тренажёре)',
    'Barbell Row': 'Тяга штанги в наклоне',
    'Barbell wrist curl': 'Сгибание запястий со штангой',
    'Bench Press': 'Жим лёжа',
    'Bent-over barbell row': 'Тяга штанги в наклоне',
    'Bulgarian split squat': 'Болгарские выпады',
    'Bulgarian Split Squat': 'Болгарские выпады',
    'Cable crunch (kneeling)': 'Скручивания на верхнем блоке с колен',
    'Cable Curl': 'Сгибание рук на блоке',
    'Cable Fly': 'Сведение рук на блоках',
    'Cable glute kickback': 'Отведение ноги назад на нижнем блоке',
    'Cable lateral raises': 'Подъёмы рук в стороны на блоке',
    'Chest-supported machine row': 'Тяга в тренажёре с упором грудью',
    'Chin-up': 'Подтягивания обратным хватом',
    'Close-grip bench press': 'Жим лёжа узким хватом',
    'Concentration curl': 'Концентрированное сгибание руки',
    Cycling: 'Велотренировка',
    Deadlift: 'Становая тяга',
    'Dumbbell lateral raise': 'Подъёмы гантелей в стороны',
    'Dumbbell Romanian Deadlift': 'Румынская тяга с гантелями',
    'Dumbbell Row': 'Тяга гантели в наклоне',
    'EZ-bar curl': 'Сгибание рук с EZ-грифом',
    'EZ-bar skull crusher': 'Французский жим с EZ-грифом',
    'Face Pull': 'Тяга каната к лицу',
    'Face pull (rope)': 'Тяга каната к лицу',
    'Flat dumbbell bench press': 'Жим гантелей лёжа',
    'Front Squat': 'Фронтальные приседания',
    'Goblet squat': 'Гоблет-приседания',
    'Hammer Curl': 'Молотковые сгибания',
    'Hammer curl (dumbbell)': 'Молотковые сгибания с гантелями',
    'Hanging Leg Raise': 'Подъёмы ног в висе',
    'Hanging leg raises': 'Подъёмы ног в висе',
    'Hip adduction machine': 'Сведение ног в тренажёре',
    'Incline Bench Press': 'Жим штанги на наклонной скамье',
    'Incline dumbbell curl (bench 60 deg)': 'Сгибание рук с гантелями на наклонной скамье (60°)',
    'Incline Dumbbell Press': 'Жим гантелей на наклонной скамье',
    'Incline dumbbell press (30 deg)': 'Жим гантелей на наклонной скамье (30°)',
    'Jump rope': 'Прыжки со скакалкой',
    'Lat Pulldown': 'Тяга верхнего блока',
    'Lat pulldown (wide grip)': 'Тяга верхнего блока широким хватом',
    'Lateral Raise': 'Подъёмы рук в стороны',
    'Leg Curl': 'Сгибание ног',
    'Leg extension': 'Разгибание ног',
    'Leg Extension': 'Разгибание ног',
    'Leg Press': 'Жим ногами',
    'Leg press (45 deg)': 'Жим ногами под углом 45°',
    'Lying leg curl': 'Сгибание ног лёжа',
    'Machine chest press': 'Жим от груди в тренажёре',
    'Machine crunch': 'Скручивания в тренажёре',
    'Machine dips or parallel bars': 'Отжимания в тренажёре или на брусьях',
    'Machine rear delt fly': 'Обратная бабочка в тренажёре',
    'Machine squat (or Hack squat)': 'Приседания в тренажёре (или гакк-приседания)',
    'Neutral-grip lat pulldown': 'Тяга верхнего блока нейтральным хватом',
    'Overhead cable triceps extension': 'Разгибание рук из-за головы на блоке',
    'Overhead Press': 'Жим над головой',
    'Overhead Triceps Extension': 'Разгибание рук из-за головы',
    'Pec deck (or cable fly)': 'Сведение рук в тренажёре (или на блоках)',
    'Plank + side plank': 'Планка и боковая планка',
    'Power Clean': 'Взятие штанги на грудь',
    'Pronated pull-ups (weighted if possible)':
      'Подтягивания прямым хватом (по возможности с весом)',
    'Pull-up': 'Подтягивания',
    'Rear Delt Fly': 'Разведение рук на заднюю дельту',
    'Reverse EZ-bar curl': 'Сгибание рук обратным хватом с EZ-грифом',
    'Romanian Deadlift': 'Румынская тяга',
    'Rowing machine': 'Гребной тренажёр',
    Running: 'Бег',
    'Seated Cable Row': 'Горизонтальная тяга блока',
    'Seated cable row (close handles)': 'Горизонтальная тяга блока узким хватом',
    'Seated Calf Raise': 'Подъёмы на носки сидя',
    'Seated calf raise machine': 'Подъёмы на носки сидя в тренажёре',
    'Seated dumbbell overhead press': 'Жим гантелей над головой сидя',
    'Seated leg curl': 'Сгибание ног сидя',
    'Single-arm dumbbell row': 'Тяга гантели одной рукой',
    Skullcrusher: 'Французский жим лёжа',
    'Standing barbell overhead press': 'Жим штанги над головой стоя',
    'Standing cable curl (straight bar)': 'Сгибание рук на блоке с прямой рукоятью',
    'Standing Calf Raise': 'Подъёмы на носки стоя',
    'Standing calf raise (or machine)': 'Подъёмы на носки стоя (или в тренажёре)',
    'Straight-arm cable pulldown': 'Тяга верхнего блока прямыми руками',
    'Triceps Pushdown': 'Разгибание рук на верхнем блоке',
    'Triceps pushdown (rope)': 'Разгибание рук с канатом на верхнем блоке',
    'Walking lunges with dumbbells': 'Выпады в ходьбе с гантелями',

    // Alpha Progression imports used by the existing account.
    'Behind-the-Back Curls · Cable': 'Сгибание рук за спиной · Блок',
    'Bench Press with Close Grip · Barbell': 'Жим лёжа узким хватом · Штанга',
    'Bench Press · Barbell': 'Жим лёжа · Штанга',
    'Bench Press · Dumbbells': 'Жим лёжа · Гантели',
    'Bench Press · Smith machine': 'Жим лёжа · Машина Смита',
    'Bent-Over Rows with Reverse Grip · Barbell': 'Тяга в наклоне обратным хватом · Штанга',
    'Bulgarian Split Squats · Dumbbells': 'Болгарские выпады · Гантели',
    'Butterfly with Close Grip · Machine': 'Сведение рук узким хватом · Тренажёр',
    'Deadlifts · Barbell': 'Становая тяга · Штанга',
    'Decline Sit-Ups · Bodyweight': 'Подъёмы корпуса на наклонной скамье · Собственный вес',
    'Face Pulls with Rope · Cable': 'Тяга каната к лицу · Блок',
    'Hammer Curls · Dumbbells': 'Молотковые сгибания · Гантели',
    'Hyperextensions on Roman Chair · Bodyweight':
      'Гиперэкстензия на римском стуле · Собственный вес',
    'Incline Bench Press · Barbell': 'Жим на наклонной скамье · Штанга',
    'Incline Bench Press · Dumbbells': 'Жим на наклонной скамье · Гантели',
    'Incline Flys · Dumbbells': 'Разведение рук на наклонной скамье · Гантели',
    'Incline Reverse Flys · Dumbbells': 'Обратные разведения на наклонной скамье · Гантели',
    'Incline Skull Crushers · EZ bar': 'Французский жим на наклонной скамье · EZ-гриф',
    'Incline Twist Curls · Dumbbells': 'Сгибания с поворотом на наклонной скамье · Гантели',
    'Lat Pulldowns with Close Neutral Grip · Cable':
      'Тяга верхнего блока узким нейтральным хватом · Блок',
    'Lat Pulldowns with Close Overhand Grip · Cable':
      'Тяга верхнего блока узким прямым хватом · Блок',
    'Lateral Raises · Dumbbells': 'Подъёмы гантелей в стороны · Гантели',
    'Leg Curls on Leg Extension Machine · Machine':
      'Сгибание ног в тренажёре для разгибаний · Тренажёр',
    'Leg Extensions · Machine': 'Разгибание ног · Тренажёр',
    'Leg Press · Machine': 'Жим ногами · Тренажёр',
    'Leg Raises · Bodyweight': 'Подъёмы ног · Собственный вес',
    'Lying Leg Curls · Machine': 'Сгибание ног лёжа · Тренажёр',
    'One-Arm Rows · Dumbbells': 'Тяга гантели одной рукой · Гантели',
    'Overhead Triceps Extensions · EZ bar': 'Разгибание рук из-за головы · EZ-гриф',
    'Preacher Curls · EZ bar': 'Сгибание рук на скамье Скотта · EZ-гриф',
    'Pull-Ups with Wide Overhand Grip · Bodyweight':
      'Подтягивания широким прямым хватом · Собственный вес',
    'Pullovers on Bench · Dumbbells': 'Пуловер на скамье · Гантели',
    'Pullovers with Rope · Cable': 'Пуловер с канатом · Блок',
    'Reverse Curls · EZ bar': 'Сгибание рук обратным хватом · EZ-гриф',
    'Romanian Deadlifts · Barbell': 'Румынская тяга · Штанга',
    'Romanian Deadlifts · Smith machine': 'Румынская тяга · Машина Смита',
    'Rows with Close Grip · Cable': 'Горизонтальная тяга узким хватом · Блок',
    'Rows with Reverse Grip · Cable': 'Горизонтальная тяга обратным хватом · Блок',
    'Rows with Wide Grip · Cable': 'Горизонтальная тяга широким хватом · Блок',
    'Rows with Wide Neutral Grip · Cable': 'Горизонтальная тяга широким нейтральным хватом · Блок',
    'Seal Rows · Dumbbells': 'Тяга лёжа на скамье · Гантели',
    'Seated Calf Raises · Machine': 'Подъёмы на носки сидя · Тренажёр',
    'Seated Shoulder Press with Close Grip · Dumbbells': 'Жим гантелей сидя узким хватом · Гантели',
    'Seated Shoulder Press · Dumbbells': 'Жим гантелей сидя · Гантели',
    'Shrugs · Barbell': 'Шраги · Штанга',
    'Skull Crushers · EZ bar': 'Французский жим лёжа · EZ-гриф',
    'Squats with Feet Forward · Smith machine': 'Приседания с ногами впереди · Машина Смита',
    'Squats · Barbell': 'Приседания · Штанга',
    'Standing Shoulder Press · Barbell': 'Жим штанги стоя · Штанга',
    'Sumo Deadlifts · Barbell': 'Становая тяга сумо · Штанга',
    'Triceps Pushdowns with Rope · Cable': 'Разгибание рук с канатом · Блок',
    'Upright Rows · Dumbbells': 'Тяга к подбородку · Гантели',
    'Upright Rows · EZ bar': 'Тяга к подбородку · EZ-гриф',
  },
};

const normalizedDictionaries = new Map<Locale, Map<string, string>>();

for (const [locale, dictionary] of Object.entries(exerciseNameDictionaries)) {
  if (!dictionary) continue;
  normalizedDictionaries.set(
    locale as Locale,
    new Map(
      Object.entries(dictionary).map(([name, translation]) => [
        normalizeExerciseName(name),
        translation,
      ]),
    ),
  );
}

function normalizeExerciseName(name: string): string {
  return name.trim().toLocaleLowerCase('en-US');
}

export function getExerciseDisplayName(name: string, locale: string): string {
  const dictionary = normalizedDictionaries.get(locale as Locale);
  return dictionary?.get(normalizeExerciseName(name)) ?? name;
}
