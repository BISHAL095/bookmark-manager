import { test, expect, mock, beforeEach } from "bun:test";
import { resolvers } from "../../src/resolvers/folder.resolvers";
import type { PrismaClient } from "../../generated/prisma/client";
import type { Context } from "../../src";

export const mockPrisma = {
  folder: {
    findUnique: mock(() => Promise.resolve(null)),
    findMany: mock(() => Promise.resolve([])),
    create: mock(() => Promise.resolve(null)),
  },
  bookmark: {
    findMany: mock(() => Promise.resolve([])),
  },
} as unknown as PrismaClient;

const mockContext: Context = { prisma: mockPrisma };

beforeEach(() => {
  mockPrisma.folder.findMany = mock(() => Promise.resolve([])) as unknown as PrismaClient["folder"]["findMany"];
  mockPrisma.folder.findUnique = mock(() => Promise.resolve(null)) as unknown as PrismaClient["folder"]["findUnique"];
  mockPrisma.folder.create = mock(() => Promise.resolve(null)) as unknown as PrismaClient["folder"]["create"];
  mockPrisma.bookmark.findMany = mock(() => Promise.resolve([])) as unknown as PrismaClient["bookmark"]["findMany"];
});

test("folders returns all folders from prisma", async () => {
  const fakeFolders = [
    { id: "1", name: "Work", createdAt: new Date("2024-01-01") },
    { id: "2", name: "Personal", createdAt: new Date("2024-01-02") },
  ];

  mockPrisma.folder.findMany = mock(() => Promise.resolve(fakeFolders)) as unknown as PrismaClient["folder"]["findMany"];

  const result = await resolvers.Query.folders(null, {}, mockContext);

  expect(result).toEqual(fakeFolders);
  expect(result).toHaveLength(2);
});

test("folder returns null when not found", async () => {

  mockPrisma.folder.findUnique = mock(() => Promise.resolve(null)) as unknown as PrismaClient["folder"]["findUnique"];
  
  const result = await resolvers.Query.folder(null, { id: "fake-id" }, mockContext);
  expect(result).toBeNull();
});

test("bookmarks passes empty where clause when no filters given", async () => {
  const findManySpy = mock(() => Promise.resolve([])) as unknown as PrismaClient["bookmark"]["findMany"];
  mockPrisma.bookmark.findMany = findManySpy;

  await resolvers.Query.bookmarks(null, {}, mockContext);

  expect(findManySpy).toHaveBeenCalledWith({ where: {} });
});

test("bookmarks filters by folderId when provided", async () => {
  const findManySpy = mock(() => Promise.resolve([])) as unknown as PrismaClient["bookmark"]["findMany"];
  mockPrisma.bookmark.findMany = findManySpy;

  await resolvers.Query.bookmarks(null, { folderId: "folder-1" }, mockContext);

  expect(findManySpy).toHaveBeenCalledWith({ where: { folderId: "folder-1" } });
});

test("bookmarks filters by search term when provided", async () => {
  const findManySpy = mock(() => Promise.resolve([])) as unknown as PrismaClient["bookmark"]["findMany"];
  mockPrisma.bookmark.findMany = findManySpy;

  await resolvers.Query.bookmarks(null, { search: "test" }, mockContext);

  expect(findManySpy).toHaveBeenCalledWith({
    where: {
      OR: [{ title: { contains: "test", mode: "insensitive" } }],
    },
  });
});

test("bookmarks filters by both folderId and search term when both provided", async () => {
  const findManySpy = mock(() => Promise.resolve([])) as unknown as PrismaClient["bookmark"]["findMany"];
  mockPrisma.bookmark.findMany = findManySpy;

  await resolvers.Query.bookmarks(null, { folderId: "folder-1", search: "test" }, mockContext);

  expect(findManySpy).toHaveBeenCalledWith({
    where: {
      folderId: "folder-1",
      OR: [{ title: { contains: "test", mode: "insensitive" } }],
    },
  });
}); 

test("createBookmark throws on empty title", async () => {
  await expect(
    resolvers.Mutation.createBookmark(
      null,
      { title: "", url: "https://example.com", tags: [], folderId: "1" },
      mockContext
    )
  ).rejects.toThrow(); // or a more specific GraphQLError check
});
