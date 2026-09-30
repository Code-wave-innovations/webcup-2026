export type PrismaScalarType =
  | 'String'
  | 'Int'
  | 'BigInt'
  | 'Float'
  | 'Decimal'
  | 'Boolean'
  | 'DateTime'
  | 'Json'
  | 'Bytes'
  | 'Unsupported'; 

export const prismaScalarTypes = new Set([
  "String",
  "Int",
  "BigInt",
  "Float",
  "Decimal",
  "Boolean",
  "DateTime",
  "Json",
  "Bytes",
  "Unsupported",
]);

// mapping TypeScript <-> Prisma
export type PrismaToTypeScriptTypeMap = {
  String: string;
  Int: number;
  BigInt: bigint;
  Float: number;
  Decimal: number; // selon l'usage
  Boolean: boolean;
  DateTime: Date;
  Json: any;
  Bytes: Buffer;
  Unsupported: unknown;
};
