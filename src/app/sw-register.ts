export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", function () {
    // Determine if we're in development or production
    const isProduction = process.env.NODE_ENV === "production";
    // Use the base path for GitHub Pages in production
    const basePath = isProduction ? "/water-sort-puzzle" : "";

    navigator.serviceWorker
      .register(`${basePath}/sw.js`, { scope: basePath + "/" })
      .then(function (registration) {
        console.log(
          "ServiceWorker registration successful with scope: ",
          registration.scope,
        );

        // Add listener for service worker updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) {
            return;
          }

          newWorker.addEventListener("statechange", () => {
            if (
              !(
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              )
            ) {
              return;
            }

            // New content is available, notify user or reload
            if (!confirm("New version available! Reload to update?")) {
              return;
            }

            window.location.reload();
          });
        });

        return registration;
      })
      .catch(function (err: unknown) {
        console.log("ServiceWorker registration failed: ", err);
      });
  });

  // Check for updates when the page is visible again
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) {
      return;
    }

    refreshing = true;
    window.location.reload();
  });
}
