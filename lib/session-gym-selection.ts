// Keep the live-session RSC payload deliberately small. In particular, do not
// select GymEquipment.imageData here: equipment photos can be several MiB each
// and the runner only needs identity/name plus exercise compatibility.
export const liveSessionGymInclude = {
  exerciseConfigs: true,
  equipment: {
    select: {
      id: true,
      name: true,
      exerciseLinks: { select: { exerciseId: true } },
    },
  },
} as const;
