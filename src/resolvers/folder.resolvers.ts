import type { Context } from "../index";
import type { Prisma } from "../../generated/prisma/client";
import { GraphQLError } from "graphql";
import { decodeCursor, encodeCursor } from "../lib/cursor";


export const resolvers = {
  Query: {
    folders: async (_parent: unknown, _args: unknown, context: Context) => {
      return context.prisma.folder.findMany();
    },
    folder: async (_parent: unknown, args: { id: string }, context: Context) => {
      return context.prisma.folder.findUnique({
        where: { id: args.id },
      });
    },
    bookmarks: async (
      _parent: unknown,
      args: { folderId?: string; search?: string, take?: number; cursor?: string },
      context: Context
    ) => {

      const conditions: Prisma.BookmarkWhereInput[] = [];

      if (args.folderId) {
        conditions.push({ folderId: args.folderId });
      }

      if (args.search) {
        conditions.push({
          OR: [{ title: { contains: args.search, mode: "insensitive" } }],
        });
      }

      if (args.cursor) {
        const decoded = decodeCursor(args.cursor);
        conditions.push({
          OR: [
            { createdAt: { lt: new Date(decoded.createdAt) } },
            { createdAt: new Date(decoded.createdAt), id: { lt: decoded.id } },
          ],
        });
      }

      const whereClause = conditions.length > 0 ? { AND: conditions } : {};
      const limit = args.take ?? 20;
      const rows = await context.prisma.bookmark.findMany({
        where: whereClause,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      });
      const lastRow = rows[limit - 1];
      return {
        items: rows.slice(0, limit),
        nextCursor: rows.length > limit && lastRow
          ? encodeCursor(lastRow.createdAt, lastRow.id)
          : null,
        hasNextPage: rows.length > limit,
      };
    },
  },
  Mutation: {
    createFolder: async (_parent: unknown, args: { name: string }, context: Context) => {
      return context.prisma.folder.create({
        data: { name: args.name },
      });
    },
    createBookmark: async (
      _parent: unknown,
      args: { title: string; url: string; tags: string[]; folderId: string },
      context: Context
    ) => {
      if (!args.title.trim()) {
        throw new GraphQLError("Title cannot be empty", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      try {
        new URL(args.url);
      } catch {
        throw new GraphQLError("Invalid URL", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      return context.prisma.bookmark.create({
        data: {
          title: args.title,
          url: args.url,
          tags: args.tags,
          folderId: args.folderId,
        },
      });
    },
    updateBookmark: async (
      _parent: unknown,
      args: { id: string; title?: string; url?: string; tags?: string[] },
      context: Context
    ) => {
      if (args.title !== undefined && !args.title.trim()) {
        throw new GraphQLError("Title cannot be empty", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      if (args.url !== undefined) {
        try {
          new URL(args.url);
        } catch {
          throw new GraphQLError("Invalid URL", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }
      }
      try {
        return await context.prisma.bookmark.update({
          where: { id: args.id },
          data: {
            title: args.title,
            url: args.url,
            tags: args.tags,
          },
        });
      } catch (error) {
        throw new GraphQLError("Bookmark not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
    },
    deleteBookmark: async (_parent: unknown, args: { id: string }, context: Context) => {
      try {
        await context.prisma.bookmark.delete({ where: { id: args.id } });
        return args.id;
      } catch (error) {
        throw new GraphQLError("Bookmark not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
    },
    moveBookmark: async (
      _parent: unknown,
      args: { id: string; folderId: string },
      context: Context
    ) => {
      const folder = await context.prisma.folder.findUnique({
        where: { id: args.folderId },
      });
      if (!folder) {
        throw new GraphQLError("Folder not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      try {
        return await context.prisma.bookmark.update({
          where: { id: args.id },
          data: { folderId: args.folderId },
        });
      } catch (error) {
        throw new GraphQLError("Bookmark not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
    },
  },
  Bookmark: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
  },
};