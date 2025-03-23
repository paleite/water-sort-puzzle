module.exports = {
  globDirectory: "out/",
  globPatterns: ["**/*.{js,css,html,png,jpg,jpeg,gif,svg,ico,json}"],
  swDest: "out/sw.js",
  // Define runtime caching rules
  runtimeCaching: [
    {
      // Match any request that ends with .png, .jpg, .jpeg or .svg
      urlPattern: /\.(?:png|jpg|jpeg|svg|ico)$/,
      // Apply a cache-first strategy
      handler: "CacheFirst",
      options: {
        // Use a custom cache name
        cacheName: "images",
        // Only cache 100 images
        expiration: {
          maxEntries: 100,
        },
      },
    },
    {
      // Match any request that starts with the same URL as the app
      urlPattern: new RegExp(
        process.env.NODE_ENV === "production"
          ? "^https://patrickeriksson.github.io/water-sort-puzzle"
          : "^http://localhost:3000",
      ),
      // Apply a network-first strategy
      handler: "NetworkFirst",
      options: {
        // Use a custom cache name
        cacheName: "app-shell",
        // Cache for a maximum of 1 day
        expiration: {
          maxAgeSeconds: 60 * 60 * 24,
        },
      },
    },
  ],
  // Skip waiting so new SW activates immediately
  skipWaiting: true,
  clientsClaim: true,
};
