import { NextResponse } from "next/server";

export type ApiErrorBody = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

export function apiError(input: {
  code: string;
  message: string;
  status: number;
  headers?: HeadersInit;
}) {
  const body: ApiErrorBody = {
    ok: false,
    error: {
      code: input.code,
      message: input.message,
    },
  };
  return NextResponse.json(body, { status: input.status, headers: input.headers });
}

