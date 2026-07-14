export type ApiErrorItem = {
  error_type: string;
  error_code: string;
  message: string;
  attribute: string | null;
};

export class ApiError extends Error {
  readonly status: number;
  readonly errors: ApiErrorItem[];

  constructor(status: number, errors: ApiErrorItem[]) {
    super(errors[0]?.message ?? `API error ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

async function parseErrorBody(res: Response): Promise<ApiErrorItem[]> {
  try {
    const body = await res.json();
    return Array.isArray(body) ? body : [];
  } catch {
    return [];
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { headers: initHeaders, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    headers: { 'Content-Type': 'application/json', ...initHeaders },
  });

  if (!res.ok) {
    const errors = await parseErrorBody(res);
    if (errors.length > 0) throw new ApiError(res.status, errors);
    throw new ApiError(res.status, [
      {
        error_type: 'unknown_error',
        error_code: 'unknown',
        message: `API error ${res.status}: ${res.statusText}`,
        attribute: null,
      },
    ]);
  }

  return res.json() as Promise<T>;
}
