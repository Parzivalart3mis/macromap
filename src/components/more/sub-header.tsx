"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function SubHeader({ title }: { title: string }) {
  const router = useRouter();
  return (
    <header className="top-header app-chrome glass sticky top-0 z-30 border-b border-border/60 px-4 pb-3">
      <div className="flex items-center gap-2 pt-2">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Back"
          onClick={() => router.back()}
        >
          <ArrowLeft aria-hidden />
        </Button>
        <h1 className="flex-1 text-center text-lg font-bold">{title}</h1>
        <span className="size-9" aria-hidden />
      </div>
    </header>
  );
}
