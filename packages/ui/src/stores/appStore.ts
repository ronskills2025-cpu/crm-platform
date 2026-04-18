import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ChannelCounters {
  sent: number;
  failed: number;
  queued: number;
}

interface Counters {
  whatsapp: ChannelCounters;
  sms: ChannelCounters;
  email: ChannelCounters;
  telegram: ChannelCounters;
  messenger: ChannelCounters;
  instagram: ChannelCounters;
}

const defaultCounters: Counters = {
  whatsapp:  { sent: 0, failed: 0, queued: 0 },
  sms:       { sent: 0, failed: 0, queued: 0 },
  email:     { sent: 0, failed: 0, queued: 0 },
  telegram:  { sent: 0, failed: 0, queued: 0 },
  messenger: { sent: 0, failed: 0, queued: 0 },
  instagram: { sent: 0, failed: 0, queued: 0 },
};

interface InboxUnread {
  whatsapp: number;
  sms: number;
  email: number;
  instagram: number;
  telegram: number;
  messenger: number;
}

const defaultInboxUnread: InboxUnread = {
  whatsapp: 0, sms: 0, email: 0, instagram: 0, telegram: 0, messenger: 0,
};

interface AppState {
  sidebarOpen: boolean;
  theme: 'dark' | 'light';
  counters: Counters;
  inboxUnread: InboxUnread;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  updateCounters: (channel: keyof Counters, data: Partial<ChannelCounters>) => void;
  setInboxUnread: (unread: InboxUnread) => void;
  decrementInboxUnread: (channel: keyof InboxUnread, count?: number) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: 'dark',
      counters: defaultCounters,
      inboxUnread: defaultInboxUnread,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setTheme: (theme) => {
        const root = document.documentElement;
        // Remove both classes first
        root.classList.remove('dark', 'light');
        // Add the new theme class
        root.classList.add(theme);
        // Update color-scheme for native elements
        root.style.colorScheme = theme;
        set({ theme });
      },
      updateCounters: (channel, data) =>
        set((s) => ({
          counters: {
            ...s.counters,
            [channel]: { ...s.counters[channel], ...data },
          },
        })),
      setInboxUnread: (unread) => set({ inboxUnread: unread }),
      decrementInboxUnread: (channel, count = 1) =>
        set((s) => ({
          inboxUnread: {
            ...s.inboxUnread,
            [channel]: Math.max(0, (s.inboxUnread[channel] || 0) - count),
          },
        })),
    }),
    {
      name: 'crm-app-store',
      partialize: (state) => ({ sidebarOpen: state.sidebarOpen, theme: state.theme }),
      onRehydrateStorage: () => (state) => {
        if (state?.theme) {
          const root = document.documentElement;
          root.classList.remove('dark', 'light');
          root.classList.add(state.theme);
          root.style.colorScheme = state.theme;
        }
      },
    }
  )
);
