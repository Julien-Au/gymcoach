// ============================================================
// Dexie : IndexedDB pour la queue offline
// ============================================================
// Une seule table pour le MVP : les sets en attente de sync.
// Les autres données (programmes, exos, sessions GET) sont gérées
// par le service worker (cache HTTP), pas besoin d'IndexedDB.
//
// IMPORTANT : ce module ne doit JAMAIS être importé côté serveur.
// L'instance Dexie n'est créée que côté client. Les composants
// doivent vérifier `typeof window !== 'undefined'` ou utiliser
// dexie-react-hooks (qui le fait déjà).

import Dexie, { type Table } from 'dexie';

export type PendingSetStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface PendingSet {
  // Identifiant local (cuid client) utilisé comme clé primaire et pour
  // l'affichage optimiste avant la confirmation serveur.
  localId: string;

  // Référence à la session courante. Quand la sync réussit, le set serveur
  // est créé sous ce sessionId.
  sessionId: string;

  exerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
  rir: number | null;
  notes: string | null;
  isWarmup: boolean;
  isDropSet: boolean;

  createdAt: number;        // epoch ms
  status: PendingSetStatus;
  // Si syncé : id serveur retourné par l'API. Permet la réconciliation
  // avec le state UI et évite les double-POST en cas de retry.
  serverId: string | null;
  syncedAt: number | null;
  // Compteur de tentatives ratées (pour backoff éventuel).
  attempts: number;
  lastError: string | null;
}

class GymCoachDB extends Dexie {
  pendingSets!: Table<PendingSet, string>;

  constructor() {
    super('GymCoachDB');
    this.version(1).stores({
      // Clé primaire : localId. Index secondaires : sessionId (pour filtrer
      // les sets d'une session), status (pour scanner les pending).
      pendingSets: 'localId, sessionId, status, createdAt',
    });
  }
}

let _db: GymCoachDB | null = null;

export function getDB(): GymCoachDB {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB n\'est disponible que côté client.');
  }
  if (!_db) _db = new GymCoachDB();
  return _db;
}

// Génère un cuid simple côté client (suffisant pour les localIds).
// On utilise crypto.randomUUID si dispo, sinon fallback Math.random.
export function generateLocalId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `loc_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  }
  return `loc_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}
