export function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      // Use the base path for GitHub Pages
      const basePath = "/water-sort-puzzle";
      navigator.serviceWorker
        .register(`${basePath}/sw.js`, { scope: basePath + "/" })
        .then(
          function (registration) {
            console.log(
              "ServiceWorker registration successful with scope: ",
              registration.scope,
            );
          },
          function (err) {
            console.log("ServiceWorker registration failed: ", err);
          },
        );
    });
  }
}
