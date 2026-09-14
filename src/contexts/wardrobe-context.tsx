import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type WardrobeItem = {
  id: string;
  uri: string;
  name: string;
  category: string;
  color: string;
  style: string;
};

type AddWardrobeItemInput = Omit<WardrobeItem, 'id'>;

type WardrobeContextValue = {
  items: WardrobeItem[];
  addItem: (item: AddWardrobeItemInput) => void;
};

const WardrobeContext = createContext<WardrobeContextValue | null>(null);

export function WardrobeProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WardrobeItem[]>([]);

  const addItem = useCallback((item: AddWardrobeItemInput) => {
    setItems((current) => [
      ...current,
      {
        ...item,
        id: `${Date.now()}-${item.uri}`,
      },
    ]);
  }, []);

  const value = useMemo(() => ({ items, addItem }), [items, addItem]);

  return <WardrobeContext.Provider value={value}>{children}</WardrobeContext.Provider>;
}

export function useWardrobe() {
  const context = useContext(WardrobeContext);

  if (!context) {
    throw new Error('useWardrobe must be used within WardrobeProvider');
  }

  return context;
}
