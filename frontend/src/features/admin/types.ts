export interface AdminQuestion {
  id: number;           // Database serial ID (used for API actions)
  externalId: string;   // Display ID like "q001"
  text: string;
  difficulty: string;
  expiresAt: string | null;
  status: 'active' | 'expired' | 'archived';
  collectionNames: string[];
  expirationHistory: Array<{
    action: 'expired' | 'renewed' | 'archived';
    timestamp: string;
    previousExpiresAt?: string;
    newExpiresAt?: string;
  }>;
}

export type StatusFilter = 'all' | 'expired' | 'expiring-soon' | 'archived';
