import { useState, useEffect } from 'react';
import { apiRequest } from '../../../services/api';
import type { CollectionSummary } from '../types';

const STORAGE_KEY = 'lastCollectionId';

interface UseCollectionsReturn {
  collections: CollectionSummary[];
  selectedId: number | null;
  selectedCollection: CollectionSummary | undefined;
  loading: boolean;
  select: (id: number) => void;
}

export function useCollections(): UseCollectionsReturn {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore last-played from localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    const savedId = saved ? parseInt(saved, 10) : null;

    // Fetch collections from API
    apiRequest<{ collections: CollectionSummary[] }>('/api/game/collections')
      .then(({ collections }) => {
        setCollections(collections);
        // Select: saved if valid, else first collection (lowest sortOrder = Federal Civics default)
        const validSaved = savedId && collections.find(c => c.id === savedId);
        setSelectedId(validSaved ? savedId : (collections[0]?.id ?? null));
      })
      .catch((error) => {
        console.error('Failed to fetch collections:', error);
        // On error, set empty array and stop loading
        setCollections([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const select = (id: number) => {
    setSelectedId(id);
    localStorage.setItem(STORAGE_KEY, String(id));
  };

  // Derive selected collection from collections and selectedId
  const selectedCollection = collections.find(c => c.id === selectedId);

  return {
    collections,
    selectedId,
    selectedCollection,
    loading,
    select,
  };
}
