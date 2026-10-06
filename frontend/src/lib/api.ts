/** One HTTP boundary for the local FastAPI server. No silent local-data fallback. */
export const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const TOKEN_KEY = 'mdlm:api:token';

export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const setToken = (token: string) => sessionStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => sessionStorage.removeItem(TOKEN_KEY);

export async function apiJson<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
  const token = getToken();
  if (authenticated && !token) throw new Error('Chưa đăng nhập vào API.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(authenticated && token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new Error(`Không thể kết nối API (${API_BASE}). Kiểm tra backend và Vite proxy.`);
  }
  if (!response.ok) {
    if (response.status === 401) clearToken();
    let detail = '';
    try {
      const body = await response.json();
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail || body);
    } catch { detail = response.statusText; }
    throw new Error(`API ${response.status}: ${detail}`);
  }
  return response.json() as Promise<T>;
}

// Preserve the order of writes triggered by React's synchronous lifecycle actions:
// e.g. create device -> create maintenance -> update device state.
let writeQueue: Promise<void> = Promise.resolve();
export function enqueueRecordWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation);
  writeQueue = result.then(() => undefined, () => undefined);
  return result;
}
