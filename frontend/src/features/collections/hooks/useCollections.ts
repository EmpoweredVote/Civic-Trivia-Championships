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
    // Deep-link pre-selection: an external link (e.g. from Essentials) may open
    // the Dashboard as `/?collection=<slug>` to land with that collection
    // pre-selected and its "Play Now" button primed. Takes precedence over the
    // last-played value; the game does NOT auto-start — the user still presses Play.
    const paramSlug = new URLSearchParams(window.location.search).get('collection');

    // Restore last-played from localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    const savedId = saved ? parseInt(saved, 10) : null;

    // Fetch collections from API
    apiRequest<{ collections: CollectionSummary[] }>('/api/game/collections')
      .then(({ collections }) => {
        setCollections(collections);
        // Precedence: ?collection= slug > valid last-played > USA/Federal default > first.
        const fromParam = paramSlug ? collections.find(c => c.slug === paramSlug) : undefined;
        const validSaved = savedId && collections.find(c => c.id === savedId);
        const defaultCollection = collections.find(c => c.tier === 'federal') ?? collections[0];

        if (fromParam) {
          setSelectedId(fromParam.id);
          // Persist so the selection survives in-app navigation after arriving via link.
          localStorage.setItem(STORAGE_KEY, String(fromParam.id));
        } else {
          setSelectedId(validSaved ? savedId : (defaultCollection?.id ?? null));
        }
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
