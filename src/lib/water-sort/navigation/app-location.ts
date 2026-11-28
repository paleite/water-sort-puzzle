export type AppDestination =
  | { kind: "home" }
  | { kind: "levels" }
  | { kind: "game"; levelId: string };

export function readAppLocation(search: string): AppDestination {
  const parameters = new URLSearchParams(search);
  const levelId = parameters.get("level");
  if (levelId !== null) return { kind: "game", levelId };
  if (parameters.get("view") === "levels") return { kind: "levels" };
  return { kind: "home" };
}

export function getAppHref(destination: AppDestination, basePath = ""): string {
  const root = `${basePath}/`;
  switch (destination.kind) {
    case "home": return root;
    case "levels": return `${root}?view=levels`;
    case "game": return `${root}?level=${encodeURIComponent(destination.levelId)}`;
  }
}
