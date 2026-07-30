import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "MacroMap — Nutrition tracking, reimagined",
  description:
    "Log meals, chain-store orders, and custom builds in seconds — with barcode scanning, AI label reading, and goals that flex with your week.",
};

export default async function Page() {
  const { userId } = await auth();
  if (userId) redirect("/diary");
  return <LandingPage />;
}
