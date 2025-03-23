export function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
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
          return registration;
        })
        .catch(function (err) {
          console.log("ServiceWorker registration failed: ", err);
        });
    });
  }
}
