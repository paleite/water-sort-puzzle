import {
  LevelManifestSchema,
  RawLevelSchema,
  rawLevelToLevel,
  type LevelManifest,
} from "./schemas";
import type { Level } from "../domain/types";

const publicPath = (path: string) =>
  `${process.env["NEXT_PUBLIC_BASE_PATH"] ?? ""}${path}`;

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    cache: "no-store",
    ...(signal === undefined ? {} : {signal}),
  });
  if (!response.ok) {
    throw new Error(`Failed to load ${url}. HTTP ${response.status}.`);
  }
  return response.json();
}

export async function loadLevel(levelId: string, signal?: AbortSignal): Promise<Level> {
  const rawJson = await fetchJson(
    publicPath(`/levels/${encodeURIComponent(levelId)}.json`),
    signal,
  );
  return rawLevelToLevel(RawLevelSchema.parse(rawJson));
}

export async function loadLevelManifest(signal?: AbortSignal): Promise<LevelManifest> {
  const rawJson = await fetchJson(publicPath("/levels/manifest.json"), signal);
  return LevelManifestSchema.parse(rawJson);
}
