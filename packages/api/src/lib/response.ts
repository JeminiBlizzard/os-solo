export interface OkResponse<T> {
  success: true;
  data: T;
}

export interface FailResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = OkResponse<T> | FailResponse;

export function ok<T>(data: T): OkResponse<T> {
  return {
    success: true,
    data,
  };
}

export function fail(code: string, message: string): FailResponse {
  return {
    success: false,
    error: {
      code,
      message,
    },
  };
}
