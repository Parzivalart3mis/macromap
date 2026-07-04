import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return jsonError(error.code, error.message, error.status);
  }
  console.error(error);
  return jsonError("internal_error", "Something went wrong", 500);
}

export async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new ApiError("unauthorized", "Sign in required", 401);
  }
  return userId;
}

/**
 * Auth plus a users-row upsert so foreign keys hold even if the Clerk webhook
 * has not fired yet (e.g. local dev without a tunnel). Use on write routes.
 */
export async function requireDbUser(): Promise<string> {
  const session = await auth();
  if (!session.userId) {
    throw new ApiError("unauthorized", "Sign in required", 401);
  }
  const claims = session.sessionClaims as { email?: string } | null;
  await db
    .insert(users)
    .values({
      id: session.userId,
      email: claims?.email ?? `${session.userId}@pending.macromap.local`,
    })
    .onConflictDoNothing({ target: users.id });
  return session.userId;
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError("invalid_request", "Request body must be JSON", 400);
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue.path.join(".");
    throw new ApiError(
      "invalid_request",
      path ? `${path}: ${issue.message}` : issue.message,
      400,
    );
  }
  return result.data;
}
