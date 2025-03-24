export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", function () {
    // Determine if we're in development or production
    const isProduction = process.env.NODE_ENV === "production";
    // Use the base path for GitHub Pages in production
    const basePath = isProduction ? "/water-sort-puzzle" : "";

    // First, unregister any existing service workers
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
      for (let registration of registrations) {
        registration.unregister().then(function () {
          console.log("ServiceWorker unregistered");
        });
      }

      // Then register a new service worker
      navigator.serviceWorker
        .register(`${basePath}/sw.js`, {
          scope: basePath + "/",
          updateViaCache: "none", // Bypass browser cache when checking for updates
        })
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
              console.log("Service worker state changed:", newWorker.state);

              if (
                !(
                  newWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                )
              ) {
                return;
              }

              console.log("New service worker installed and ready");
              // New content is available, automatically reload
              window.location.reload();
            });
          });

          return registration;
        })
        .catch(function (err: unknown) {
          console.log("ServiceWorker registration failed: ", err);
        });
    });
  });

  // Check for updates when the page is visible again
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) {
      return;
    }

    console.log("Service worker controller changed - reloading page");
    refreshing = true;
    window.location.reload();
  });
}
