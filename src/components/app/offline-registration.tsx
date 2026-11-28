"use client";

import { useEffect } from "react";

export function OfflineRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      void navigator.serviceWorker.register(`${basePath}/sw.js`, { updateViaCache: "none" })
        .catch((error: unknown) => console.warn("Offline installation unavailable", error));
    };
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}
