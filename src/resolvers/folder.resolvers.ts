import type { Context } from "../index";
import type { Prisma } from "../../generated/prisma/client";
import { GraphQLError } from "graphql";


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
};