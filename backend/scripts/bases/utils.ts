function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function uncapitalize(str: string) {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function prismaToTypeScriptType(prismaType: string): string {
  const typeMap: Record<string, string> = {
    String: "string",
    Int: "number",
    BigInt: "bigint",
    Float: "number",
    Decimal: "number",
    Boolean: "boolean",
    DateTime: "Date",
    Json: "any",
    Bytes: "Buffer",
    Unsupported: "any",
  };

  return typeMap[prismaType] ?? "unknown";
}


export { capitalize, uncapitalize, prismaToTypeScriptType };
