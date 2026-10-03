import { PrismaClient } from "@prisma/client";

// Single shared client: one connection pool for the whole process.
const prisma = new PrismaClient();

export default prisma;
