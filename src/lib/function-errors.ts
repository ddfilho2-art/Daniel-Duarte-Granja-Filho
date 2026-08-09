export interface EdgeFunctionErrorBody {
  success?: boolean;
  code?: string;
  error?: string;
  requestId?: string;
  retryAfter?: number;
}

export async function readEdgeFunctionError(
  error: unknown,
): Promise<EdgeFunctionErrorBody> {
  const context = (error as { context?: unknown } | null)?.context;

  if (context instanceof Response) {
    try {
      return (await context.clone().json()) as EdgeFunctionErrorBody;
    } catch {
      return {};
    }
  }

  return {};
}
