import { io, Socket } from 'socket.io-client';

const ACCESS_CODE_KEY = 'modu_bluemarble_access_code';
const GAME_SESSION_KEY = 'modu_bluemarble_game_session';
const USER_PROFILE_KEY = 'modu_bluemarble_user_profile';

export interface SavedGameSession {
  roomId: string;
  playerToken: string;
  playerIndex: number;
  playerName: string;
  playerColor: string;
  status: 'waiting' | 'in_game';
  timestamp: number;
}

export interface SavedUserProfile {
  name: string;
  color: string;
}

export function getSavedAccessCode(): string | null {
  try {
    return sessionStorage.getItem(ACCESS_CODE_KEY) || localStorage.getItem(ACCESS_CODE_KEY);
  } catch {
    return null;
  }
}

export function saveAccessCode(code: string): void {
  try {
    sessionStorage.setItem(ACCESS_CODE_KEY, code);
    localStorage.setItem(ACCESS_CODE_KEY, code);
  } catch {
    // Ignore storage failure
  }
}

export function clearAccessCode(): void {
  try {
    sessionStorage.removeItem(ACCESS_CODE_KEY);
    localStorage.removeItem(ACCESS_CODE_KEY);
  } catch {
    // Ignore storage failure
  }
}

export function getSavedGameSession(): SavedGameSession | null {
  try {
    const raw = localStorage.getItem(GAME_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedGameSession;
    // Expire sessions older than 4 hours
    if (Date.now() - (parsed.timestamp || 0) > 4 * 60 * 60 * 1000) {
      clearGameSession();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveGameSession(session: Omit<SavedGameSession, 'timestamp'>): void {
  try {
    const fullSession: SavedGameSession = {
      ...session,
      timestamp: Date.now(),
    };
    localStorage.setItem(GAME_SESSION_KEY, JSON.stringify(fullSession));
  } catch {
    // Ignore storage failure
  }
}

export function clearGameSession(): void {
  try {
    localStorage.removeItem(GAME_SESSION_KEY);
  } catch {
    // Ignore storage failure
  }
}

export function getSavedUserProfile(): SavedUserProfile | null {
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveSavedUserProfile(profile: SavedUserProfile): void {
  try {
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage failure
  }
}

let socketInstance: Socket | null = null;

export function getSocket(code?: string): Socket {
  if (!socketInstance) {
    const authCode = code || getSavedAccessCode() || '964';
    const serverUrl = (import.meta as any).env?.VITE_SERVER_URL || undefined;
    socketInstance = serverUrl 
      ? io(serverUrl, {
          auth: { code: authCode },
          reconnectionAttempts: 15,
          reconnectionDelay: 1000,
          transports: ['websocket', 'polling'],
        })
      : io({
          auth: { code: authCode },
          reconnectionAttempts: 15,
          reconnectionDelay: 1000,
          transports: ['websocket', 'polling'],
        });
  }
  return socketInstance;
}

export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

