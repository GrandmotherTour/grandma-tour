const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const buildUrl = (url: string) => `${API_BASE_URL}${url}`;

const parseResponse = async <T>(response: Response): Promise<T> => {
  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const message = json?.message || `API request failed with ${response.status}`;
    throw new Error(message);
  }

  return json as T;
};

export const apiClient = {
  get: async <T>(url: string): Promise<T> => {
    const response = await fetch(buildUrl(url));
    return parseResponse<T>(response);
  },

  post: async <T>(url: string, body: unknown): Promise<T> => {
    const response = await fetch(buildUrl(url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    return parseResponse<T>(response);
  }
};
