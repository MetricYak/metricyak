export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { headers: initHeaders, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    headers: { 'Content-Type': 'application/json', ...initHeaders },
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}
