import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Client } from '@/types';

interface ClientState {
  activeClient: Client | null;
  setActiveClient: (client: Client | null) => void;
}

export const useClientStore = create<ClientState>()(
  persist(
    (set) => ({
      activeClient: null,
      setActiveClient: (client) => set({ activeClient: client }),
    }),
    { name: 'nazar-active-client' },
  ),
);
