import {
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  brotliCompressSync,
  gzipSync,
} from "node:zlib";

import type { ColorId } from "../../src/lib/water-sort/domain/colors";
import {
  LevelManifestSchema,
  RawLevelSchema,
} from "../../src/lib/water-sort/levels/schemas";

const DEFAULT_INPUT_DIRECTORY = "levels";
const DEFAULT_OUTPUT_FILE =
  "src/lib/water-sort/levels/levels.generated.ts";

interface RuntimeLevelSource {
  id: string;
  capacity: number;
  board: ColorId[][];
  development: {
    optimalMoveCount: number;
    difficultyScore?: number;
  };
}

function formatBytes(bytes: number): string {
  return bytes < 1024
    ? `${bytes} B`
    : `${(bytes / 1024).toFixed(1)} KiB`;
}

async function findUnlistedLevelIds(
  inputDirectory: string,
  listedIds: ReadonlySet<string>,
): Promise<string[]> {
  const files = await readdir(inputDirectory);

  return files
    .filter((name) => name !== "manifest.json" && name.endsWith(".json"))
    .map((name) => name.slice(0, -".json".length))
    .filter((id) => !listedIds.has(id))
    .sort();
}

function createGeneratedModule(
  ids: readonly string[],
  index: readonly {
    id: string;
    optimalMoveCount: number;
    difficultyScore?: number;
  }[],
  levels: Readonly<Record<string, RuntimeLevelSource>>,
): string {
  return `/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Sources:
 *   levels/manifest.json
 *   levels/<id>.json
 *
 * Regenerate:
 *   pnpm compile:levels
 */

import type {Level} from "../domain/types";

export const LEVEL_IDS = ${JSON.stringify(ids, null, 2)} as const;

export type LevelId = (typeof LEVEL_IDS)[number];

export const LEVEL_INDEX = ${JSON.stringify(index, null, 2)} as const;

export const LEVELS = ${JSON.stringify(levels, null, 2)} as const satisfies Record<LevelId, Level>;
`;
}

async function main(): Promise<void> {
  const inputDirectory = path.resolve(
    process.argv[2] ?? DEFAULT_INPUT_DIRECTORY,
  );
  const outputFile = path.resolve(
    process.argv[3] ?? DEFAULT_OUTPUT_FILE,
  );

  const manifest = LevelManifestSchema.parse(
    JSON.parse(
      await readFile(
        path.join(inputDirectory, "manifest.json"),
        "utf8",
      ),
    ),
  );

  const ids = manifest.levels.map(({id}) => id);
  if (ids.length === 0) {
    throw new Error("Manifest must contain at least one level.");
  }

  const listedIds = new Set(ids);
  if (listedIds.size !== ids.length) {
    const seen = new Set<string>();
    const duplicates = ids.filter((id) => {
      if (seen.has(id)) return true;
      seen.add(id);
      return false;
    });

    throw new Error(
      `Manifest contains duplicate level IDs: ${[
        ...new Set(duplicates),
      ].join(", ")}.`,
    );
  }

  const unlistedIds = await findUnlistedLevelIds(
    inputDirectory,
    listedIds,
  );
  if (unlistedIds.length > 0) {
    throw new Error(
      `Level files are not listed in manifest.json: ${unlistedIds.join(", ")}.`,
    );
  }

  const levels: Record<string, RuntimeLevelSource> = {};
  const index: Array<{
    id: string;
    optimalMoveCount: number;
    difficultyScore?: number;
  }> = [];

  for (const id of ids) {
    const levelPath = path.join(
      inputDirectory,
      `${id}.json`,
    );

    let rawText: string;
    try {
      rawText = await readFile(levelPath, "utf8");
    } catch (error: unknown) {
      if (
        error instanceof Error
        && "code" in error
        && error.code === "ENOENT"
      ) {
        throw new Error(
          `Manifest references missing level file: ${id}.json.`,
        );
      }
      throw error;
    }

    const raw = RawLevelSchema.parse(
      JSON.parse(rawText),
    );

    if (raw.id !== id) {
      throw new Error(
        `Manifest level ID "${id}" does not match level file ID "${raw.id}".`,
      );
    }

    if (raw.development === undefined) {
      throw new Error(
        `Level ${id} is missing development metadata.`,
      );
    }

    const development = {
      optimalMoveCount:
        raw.development.optimalMoveCount,
      ...(raw.development.difficultyScore === undefined
        ? {}
        : {
            difficultyScore:
              raw.development.difficultyScore,
          }),
    };

    index.push({
      id,
      ...development,
    });

    levels[id] = {
      id,
      capacity: raw.capacity,
      board: raw.vials.map(
        (vial) => [...vial].reverse(),
      ),
      development,
    };
  }

  const generated = createGeneratedModule(
    ids,
    index,
    levels,
  );

  await writeFile(
    outputFile,
    generated,
    "utf8",
  );

  console.log(`Compiled ${ids.length} levels.`);
  console.log(
    `Runtime source: ${formatBytes(
      Buffer.byteLength(generated, "utf8"),
    )}`,
  );
  console.log(
    `gzip: ${formatBytes(
      gzipSync(generated).byteLength,
    )}`,
  );
  console.log(
    `brotli: ${formatBytes(
      brotliCompressSync(generated).byteLength,
    )}`,
  );
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
