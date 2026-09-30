import fs from "fs";
import path from "path";
import { capitalize } from "./utils";
import { prismaScalarTypes } from "../types/types";

const schemaPath = path.join(__dirname, '../..', 'prisma', 'schema.prisma');

const generateSchema = (tableName: string, allFields: Array<string>) => {
  let content = ``

  for (let fieldString of allFields) {
    let field = fieldString.split(":");
    let fieldSchema = '';

    for (let fieldIndex in field) {
      if(parseInt(fieldIndex) == 1) {
        // Check if the gived type exist on Prisma scalar type
        const type = capitalize(field[fieldIndex]);
        const isScalarType = prismaScalarTypes.has(type);
        if(!isScalarType) {
          console.log(`❌ Type ${type} is not a prisma scalar type`);
          return false;
        }
        fieldSchema += type + "\t";
      }
      else if(parseInt(fieldIndex) == 2) {
        // Dont whrite on schema if there is file
        if(field[fieldIndex] != 'file') {
          fieldSchema += field[fieldIndex] + "\t";
        }
      } 
      else {
        fieldSchema += field[fieldIndex] + "\t";
      }
    }

    content += fieldSchema+"\n\t";
  }

  const newModel = `
  model ${tableName} {
  id\tInt\t@id\t@default(autoincrement())
  created_at\tDateTime\t@default(now())
\t${content}
}
  `

  try {
    fs.appendFileSync(schemaPath, newModel.trimStart() + '\n');
    console.log(`✅ Model ${tableName} added to schema.prisma`);
    return true;
  } catch (err) {
    console.log("❌ Failed to write to schema.prisma:", err);
    return false;
  }
};

export { generateSchema };
