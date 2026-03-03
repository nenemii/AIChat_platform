import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  mode: "chat" | "rag" | "agent";
}

interface SessionStore {
  sessions: ChatSession[];
  activeSessionId: string | null;
  createSession: (title?: string) => string;
  setActiveSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;
  touchSession: (id: string) => void;
  removeSession: (id: string) => void;
  ensureSession: () => string;
  setSessionMode: (id: string, mode: ChatSession["mode"]) => void;
}

const generateId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,

      createSession: (title = "新会话") => {
        const id = generateId();
        const now = Date.now();
        const session: ChatSession = {
          id,
          title,
          createdAt: now,
          updatedAt: now,
          mode: "chat"
        };
        set((state) => ({
          sessions: [session, ...state.sessions],
          activeSessionId: id
        }));
        return id;
      },

      setActiveSession: (id) => {
        const { sessions } = get();
        if (!sessions.some((s) => s.id === id)) return;
        set({ activeSessionId: id });
        get().touchSession(id);
      },

      renameSession: (id, title) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, title, updatedAt: Date.now() } : s
          )
        }));
      },

      touchSession: (id) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, updatedAt: Date.now() } : s
          )
        }));
      },

      removeSession: (id) => {
        set((state) => {
          const filtered = state.sessions.filter((s) => s.id !== id);
          const nextActive =
            state.activeSessionId === id
              ? filtered[0]?.id ?? null
              : state.activeSessionId;
          return {
            sessions: filtered,
            activeSessionId: nextActive
          };
        });
      },

      ensureSession: () => {
        const { activeSessionId, sessions, createSession, setActiveSession } = get();
        if (activeSessionId && sessions.some((s) => s.id === activeSessionId)) {
          return activeSessionId;
        }
        if (sessions.length > 0) {
          const id = sessions[0].id;
          setActiveSession(id);
          return id;
        }
        return createSession();
      },

      setSessionMode: (id, mode) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, mode } : s
          )
        }));
      }
    }),
    {
      name: "chat-session-store"
    }
  )
);
