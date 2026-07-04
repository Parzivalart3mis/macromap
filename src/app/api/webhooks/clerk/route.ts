import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { Webhook } from "svix";

import { jsonError } from "@/lib/api";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses?: Array<{ id: string; email_address: string }>;
    primary_email_address_id?: string;
    first_name?: string | null;
    last_name?: string | null;
  };
}

export async function POST(request: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return jsonError("not_configured", "Webhook secret not configured", 500);
  }

  const payload = await request.text();
  const headers = {
    "svix-id": request.headers.get("svix-id") ?? "",
    "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
    "svix-signature": request.headers.get("svix-signature") ?? "",
  };

  let event: ClerkWebhookEvent;
  try {
    event = new Webhook(secret).verify(payload, headers) as ClerkWebhookEvent;
  } catch {
    return jsonError("invalid_signature", "Webhook signature verification failed", 400);
  }

  const { type, data } = event;
  if (type === "user.created" || type === "user.updated") {
    const email =
      data.email_addresses?.find((e) => e.id === data.primary_email_address_id)
        ?.email_address ??
      data.email_addresses?.[0]?.email_address ??
      `${data.id}@pending.macromap.local`;
    const displayName =
      [data.first_name, data.last_name].filter(Boolean).join(" ") || null;
    await db
      .insert(users)
      .values({ id: data.id, email, displayName })
      .onConflictDoUpdate({ target: users.id, set: { email, displayName } });
  } else if (type === "user.deleted") {
    await db.delete(users).where(eq(users.id, data.id));
  }

  return NextResponse.json({ ok: true });
}
