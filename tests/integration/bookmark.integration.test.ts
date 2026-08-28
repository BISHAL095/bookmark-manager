import { test, expect, beforeEach, afterAll } from "bun:test";
import { PrismaClient } from "../../generated/prisma/client";
import { resolvers } from "../../src/resolvers/folder.resolvers"; 
import type { Context } from "../../src";

const prisma = new PrismaClient();
const context: Context = { prisma };

beforeEach(async () => {
  await prisma.bookmark.deleteMany();
  await prisma.folder.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

test("creates a folder and bookmark, then queries it back", async () => {
  
  const folder = await resolvers.Mutation.createFolder(null, { name: "Test Folder" }, context);
  
  const bookmark = await resolvers.Mutation.createBookmark(
    null,
    { title: "Test Bookmark", url: "https://example.com", tags: ["test"], folderId: folder.id },
    context
  );
  
  
  const result = await resolvers.Query.bookmarks(null, { folderId: folder.id, take: 10 }, context);
  
  expect(result.items).toContainEqual(bookmark);
});

test("bookmarks paginates correctly with cursor", async () => {
  const folder = await resolvers.Mutation.createFolder(null, { name: "Pagination Folder" }, context);
  for (let i = 1; i <= 5; i++) {
    await resolvers.Mutation.createBookmark(
      null,
      { title: `Bookmark ${i}`, url: `https://example.com/${i}`, tags: [], folderId: folder.id },
      context
    );
  }

  const page1 = await resolvers.Query.bookmarks(null, { folderId: folder.id, take: 2 }, context);
  expect(page1.items).toHaveLength(2);
  expect(page1.hasNextPage).toBe(true);

  const page2 = await resolvers.Query.bookmarks(
    null,
    { folderId: folder.id, take: 2, cursor: page1.nextCursor! },
      context
  );
  expect(page2.items).toHaveLength(2);
  expect(page2.hasNextPage).toBe(true);

  const page3 = await resolvers.Query.bookmarks(
    null,
      { folderId: folder.id, take: 2, cursor: page2.nextCursor! },
      context
    );
    expect(page3.items).toHaveLength(1);
    expect(page3.hasNextPage).toBe(false);

    const allIds = [...page1.items, ...page2.items, ...page3.items].map((b) => b.id);
    expect(new Set(allIds).size).toBe(5);
});
