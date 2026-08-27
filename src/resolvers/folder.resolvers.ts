// src/resolvers/index.ts (or wherever you're putting it)
import type { Context } from "../index";
import type { Prisma } from "../../generated/prisma/client";

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
      args: { folderId?: string; search?: string },
      context: Context
    ) => {

      const whereClause: Prisma.BookmarkWhereInput = {};

      if (args.folderId) {
        whereClause.folderId = args.folderId;
      }

      if (args.search) {
        whereClause.OR = [
          { title: { contains: args.search, mode: "insensitive" } },
        ];
      }

      return context.prisma.bookmark.findMany({
        where: whereClause,
      });
    },
  },
};