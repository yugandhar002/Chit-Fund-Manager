import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase, ChitRepository, Chit } from '../database';

interface ChitContextType {
  selectedChitId: number | null;
  selectedChit: Chit | null;
  setSelectedChitId: (id: number | null) => Promise<void>;
  refreshChit: () => Promise<void>;
  loading: boolean;
}

const ChitContext = createContext<ChitContextType | undefined>(undefined);

const SELECTED_CHIT_KEY = '@selected_chit_id';

export const ChitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedChitId, setSelectedChitIdState] = useState<number | null>(null);
  const [selectedChit, setSelectedChit] = useState<Chit | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSelection = useCallback(async () => {
    try {
      const storedId = await AsyncStorage.getItem(SELECTED_CHIT_KEY);
      const db = await getDatabase();
      const chitRepo = new ChitRepository(db);

      let id = storedId ? parseInt(storedId) : null;
      
      // If no stored ID, try to get the most recent active chit
      if (!id) {
        const active = await chitRepo.getActiveChit();
        id = active ? active.id : null;
      }

      if (id) {
        const chit = await chitRepo.getChitById(id);
        if (chit) {
          setSelectedChitIdState(id);
          setSelectedChit(chit);
        } else {
          // Stored ID no longer exists
          setSelectedChitIdState(null);
          setSelectedChit(null);
        }
      }
    } catch (e) {
      console.error('Failed to load chit selection', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const setSelectedChitId = async (id: number | null) => {
    try {
      if (id) {
        await AsyncStorage.setItem(SELECTED_CHIT_KEY, id.toString());
        const db = await getDatabase();
        const chitRepo = new ChitRepository(db);
        const chit = await chitRepo.getChitById(id);
        setSelectedChit(chit);
      } else {
        await AsyncStorage.removeItem(SELECTED_CHIT_KEY);
        setSelectedChit(null);
      }
      setSelectedChitIdState(id);
    } catch (e) {
      console.error('Failed to save chit selection', e);
    }
  };

  const refreshChit = async () => {
    if (selectedChitId) {
      const db = await getDatabase();
      const chitRepo = new ChitRepository(db);
      const chit = await chitRepo.getChitById(selectedChitId);
      setSelectedChit(chit);
    }
  };

  useEffect(() => {
    loadSelection();
  }, [loadSelection]);

  return (
    <ChitContext.Provider value={{ selectedChitId, selectedChit, setSelectedChitId, refreshChit, loading }}>
      {children}
    </ChitContext.Provider>
  );
};

export const useChit = () => {
  const context = useContext(ChitContext);
  if (context === undefined) {
    throw new Error('useChit must be used within a ChitProvider');
  }
  return context;
};
