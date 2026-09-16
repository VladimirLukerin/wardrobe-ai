import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { type FamilyMember, type FamilyRole } from '@/constants/family';

type AddFamilyMemberInput = {
  name: string;
  role: FamilyRole;
};

type FamilyContextValue = {
  members: FamilyMember[];
  addMember: (member: AddFamilyMemberInput) => void;
};

const FamilyContext = createContext<FamilyContextValue | null>(null);

export function FamilyProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<FamilyMember[]>([]);

  const addMember = useCallback((member: AddFamilyMemberInput) => {
    const trimmedName = member.name.trim();

    if (!trimmedName) {
      return;
    }

    setMembers((current) => [
      ...current,
      {
        id: `${Date.now()}-${trimmedName}`,
        name: trimmedName,
        role: member.role,
      },
    ]);
  }, []);

  const value = useMemo(() => ({ members, addMember }), [members, addMember]);

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily() {
  const context = useContext(FamilyContext);

  if (!context) {
    throw new Error('useFamily must be used within FamilyProvider');
  }

  return context;
}
