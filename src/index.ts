import { createYoga, createSchema } from "graphql-yoga";
import { createServer } from "node:http";
import { prisma } from "./lib/prisma";
import type { PrismaClient } from "../generated/prisma/client";
import { resolvers } from "./resolvers/folder.resolvers";

export type Context = {
  prisma: PrismaClient;
};

const typeDefs = await Bun.file('src/schema/schema.graphql').text();


const yoga = createYoga<Context>({
  schema: createSchema({
    typeDefs, 
    resolvers,
  }),
  context: (): Context => ({ prisma }),
});

const server = createServer(yoga);
server.listen(4000, () => {
  console.log("Server running on http://localhost:4000/graphql");
});