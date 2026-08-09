"use client";

import { useEffect } from "react";

/**
 * Root error boundary — replaces the whole root layout when it (or a provider)
 * throws, so globals.css / Tailwind are unavailable. Styles are inline on
 * purpose. Renders its own <html>/<body> as Next requires.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.25rem",
          padding: "1.5rem",
          textAlign: "center",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "#f7faf9",
          color: "#141f1b",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
            Something went wrong
          </h1>
          <p style={{ margin: "0.5rem auto 0", maxWidth: "20rem", fontSize: "0.875rem", color: "#5c6b64" }}>
            The app hit an unexpected error while starting up. Reloading usually fixes it.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          style={{
            border: "none",
            borderRadius: "9999px",
            padding: "0.625rem 1.25rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "#ffffff",
            background: "#0f9d6e",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
