import { io, Socket } from 'socket.io-client';

const ACCESS_CODE_KEY = 'modu_bluemarble_access_code';

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

let socketInstance: Socket | null = null;

export function getSocket(code?: string): Socket {
  if (!socketInstance) {
    const authCode = code || getSavedAccessCode() || '964';
    socketInstance = io({
      auth: {
        code: authCode,
      },
      reconnectionAttempts: 10,
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
