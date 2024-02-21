import { PrismaClient } from "j-gitadora-psup/node_modules/@prisma/client";

const prismaClient = new PrismaClient();
export default prismaClient;

/** PrismaClientとトランザクションのどちらも受け付けられる型 */
export type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;
