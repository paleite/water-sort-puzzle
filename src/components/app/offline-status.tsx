"use client";

import { useEffect, useState } from "react";

export function OfflineStatus() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    let disposed = false;
    let channel: MessageChannel | undefined;
    const check = () => {
      channel?.port1.close();
      setReady(false);
      const controller = navigator.serviceWorker.controller;
      if (controller === null) return;
      const nextChannel = new MessageChannel();
      channel = nextChannel;
      nextChannel.port1.onmessage = (event: MessageEvent<unknown>) => {
        if (!disposed && channel === nextChannel) setReady(event.data === true);
        nextChannel.port1.close();
      };
      controller.postMessage({ type: "CHECK_OFFLINE" }, [nextChannel.port2]);
    };
    navigator.serviceWorker.addEventListener("controllerchange", check);
    window.addEventListener("pageshow", check);
    check();
    return () => {
      disposed = true;
      channel?.port1.close();
      navigator.serviceWorker.removeEventListener("controllerchange", check);
      window.removeEventListener("pageshow", check);
    };
  }, []);

  return ready ? (
    <p role="status" className="fixed inset-x-0 bottom-5 text-center text-xs text-slate-400">
      Ready to play offline
    </p>
  ) : null;
}
