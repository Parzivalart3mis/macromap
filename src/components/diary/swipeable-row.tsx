"use client";

import { Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

const LOCK_SLOP_PX = 10; // movement before we commit to a horizontal drag

/**
 * Swipe a row left or right to delete it. Vertical scrolling stays native
 * (touch-action: pan-y); a tap without a drag still clicks through to the
 * child, which remains the accessible path to deletion.
 */
export function SwipeableRow({
  onDelete,
  children,
}: {
  onDelete: () => void;
  children: React.ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [removing, setRemoving] = useState(false);
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

  function handlePointerDown(event: React.PointerEvent) {
    if (removing) return;
    start.current = { x: event.clientX, y: event.clientY };
    locked.current = false;
    dragged.current = false;
  }

  function handlePointerMove(event: React.PointerEvent) {
    if (!start.current || removing) return;
    const deltaX = event.clientX - start.current.x;
    const deltaY = event.clientY - start.current.y;
    if (!locked.current) {
      if (Math.abs(deltaX) < LOCK_SLOP_PX) return;
      if (Math.abs(deltaX) <= Math.abs(deltaY)) {
        // Vertical intent — let the page scroll and stop tracking.
        start.current = null;
        return;
      }
      locked.current = true;
      setDragging(true);
      container.current?.setPointerCapture(event.pointerId);
    }
    dragged.current = true;
    setDx(deltaX);
  }

  function handlePointerEnd() {
    if (!start.current && !locked.current) return;
    const width = container.current?.offsetWidth ?? 320;
    const threshold = Math.min(140, width * 0.35);
    if (locked.current && Math.abs(dx) > threshold) {
      setRemoving(true);
      setDragging(false);
      setDx(dx > 0 ? width : -width);
      // Let the slide-out play before the row disappears from the list.
      window.setTimeout(onDelete, 180);
      start.current = null;
      locked.current = false;
      return;
    }
    reset();
  }

  const revealed = Math.min(1, Math.abs(dx) / 90);

  return (
    <div
      ref={container}
      className={cn(
        "relative overflow-hidden rounded-2xl transition-[max-height,opacity] duration-300",
        removing && "pointer-events-none opacity-0",
      )}
      style={{ touchAction: "pan-y" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={reset}
      onClickCapture={(event) => {
        // A drag is not a tap — swallow the click so edit does not open.
        if (dragged.current) {
          event.preventDefault();
          event.stopPropagation();
          dragged.current = false;
        }
      }}
    >
      {/* Delete reveal behind the card */}
      <div
        aria-hidden
        className="absolute inset-0 flex items-center justify-between rounded-2xl bg-destructive px-5 text-white"
        style={{ opacity: revealed }}
      >
        <Trash2 className="size-5" />
        <Trash2 className="size-5" />
      </div>
      <div
        style={{ transform: `translateX(${dx}px)` }}
        className={cn(
          !dragging &&
            "transition-transform duration-300 [transition-timing-function:var(--ease-out-expo)]",
        )}
      >
        {children}
      </div>
    </div>
  );
}
