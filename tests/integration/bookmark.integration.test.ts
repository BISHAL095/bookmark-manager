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
  
  const result = await resolvers.Query.bookmarks(null, { folderId: folder.id }, context);
  
  expect(result).toContainEqual(bookmark);
});

