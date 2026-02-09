import { faker } from "@faker-js/faker";

const MIME_TYPES = [
  "text/plain",
  "text/markdown",
  "application/json",
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/javascript",
  "text/typescript",
] as const;

const STORAGE_PROVIDERS = ["s3", "local"] as const;

export function createMockFile(overrides: Partial<MockFile> = {}): MockFile {
  const userId = overrides.userId ?? faker.string.cuid2();
  const fileId = overrides.id ?? faker.string.cuid2();
  const filename = overrides.name ?? faker.system.fileName();

  return {
    id: fileId,
    userId,
    sessionId: overrides.sessionId ?? null,
    name: filename,
    path: overrides.path ?? "/",
    mimeType: faker.helpers.arrayElement(MIME_TYPES),
    size: faker.number.int({ min: 100, max: 10_000_000 }),
    storageKey: `${userId}/${fileId}/${filename}`,
    storageProvider: "s3",
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    ...overrides,
  };
}

export function createMockFileVersion(
  overrides: Partial<MockFileVersion> = {}
): MockFileVersion {
  return {
    id: faker.string.cuid2(),
    fileId: faker.string.cuid2(),
    version: overrides.version ?? 1,
    storageKey: faker.string.alphanumeric(40),
    size: faker.number.int({ min: 100, max: 10_000_000 }),
    changeDescription: faker.lorem.sentence(),
    createdAt: faker.date.past().toISOString(),
    ...overrides,
  };
}

export function createMockFolder(
  overrides: Partial<MockFolder> = {}
): MockFolder {
  return {
    id: faker.string.cuid2(),
    userId: faker.string.cuid2(),
    name: faker.system.directoryPath().split("/").pop() ?? "folder",
    path: faker.system.directoryPath(),
    parentId: null,
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    ...overrides,
  };
}

export type MockFile = {
  id: string;
  userId: string;
  sessionId: string | null;
  name: string;
  path: string;
  mimeType: string;
  size: number;
  storageKey: string;
  storageProvider: (typeof STORAGE_PROVIDERS)[number];
  createdAt: string;
  updatedAt: string;
};

export type MockFileVersion = {
  id: string;
  fileId: string;
  version: number;
  storageKey: string;
  size: number;
  changeDescription: string | null;
  createdAt: string;
};

export type MockFolder = {
  id: string;
  userId: string;
  name: string;
  path: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
};
