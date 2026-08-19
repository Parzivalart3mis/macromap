"use client";

import { RotateCcw } from "lucide-react";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

const LOCK_SLOP_PX = 10; // movement before we commit to a horizontal drag

/**
 * Right-swipe a card to fire an action (repeat last meal). Vertical scrolling
 * stays native (touch-action: pan-y); a left-swipe or plain tap is ignored, and
 * the card snaps back after firing (unlike delete, it stays). A tap still
 * clicks through to the child button — the accessible path.
 */
export function SwipeToRepeat({
  onRepeat,
  disabled,
  children,
}: {
  onRepeat: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const locked = useRef(false);
  const dragged = useRef(false);
  const container = useRef<HTMLDivElement>(null);

  function reset() {
    start.current = null;
    locked.current = false;
    setDragging(false);
    setDx(0);
  }

  function down(event: React.PointerEvent) {
    if (disabled) return;
    start.current = { x: event.clientX, y: event.clientY };
    locked.current = false;
    dragged.current = false;
  }

  function move(event: React.PointerEvent) {
    if (!start.current || disabled) return;
    const deltaX = event.clientX - start.current.x;
    const deltaY = event.clientY - start.current.y;
    if (!locked.current) {
      if (Math.abs(deltaX) < LOCK_SLOP_PX) return;
      // Commit only to a rightward drag; yield to vertical scroll or leftward.
      if (deltaX <= 0 || Math.abs(deltaX) <= Math.abs(deltaY)) {
        start.current = null;
        return;
      }
      locked.current = true;
      setDragging(true);
      container.current?.setPointerCapture(event.pointerId);
    }
    dragged.current = true;
    setDx(Math.max(0, deltaX));
  }

  function end() {
    if (!locked.current) return reset();
    const width = container.current?.offsetWidth ?? 320;
    const threshold = Math.min(140, width * 0.35);
    const fire = dx > threshold;
    reset();
    if (fire) onRepeat();
  }

  const revealed = Math.min(1, dx / 90);

  return (
    <div
      ref={container}
      className="relative overflow-hidden"
      style={{ touchAction: "pan-y" }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={reset}
      onClickCapture={(event) => {
        // A drag is not a tap — swallow the click so nothing behind it fires.
        if (dragged.current) {
          event.preventDefault();
          event.stopPropagation();
          dragged.current = false;
        }
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 flex items-center gap-2 bg-primary px-5 text-primary-foreground"
        style={{ opacity: revealed }}
      >
        <RotateCcw className="size-5" />
        <span className="text-sm font-semibold">Repeat</span>
      </div>
      <div
        style={{ transform: `translateX(${dx}px)` }}
        className={cn(
          "bg-card",
          !dragging &&
            "transition-transform duration-300 [transition-timing-function:var(--ease-out-expo)]",
        )}
      >
        {children}
      </div>
    </div>
  );
}
