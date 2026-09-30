import fs from "fs";
import path from "path";
import { capitalize, prismaToTypeScriptType, uncapitalize } from "./utils";
import { PrismaScalarType, prismaScalarTypes } from "../types/types";

const generateRouter = (tableName: string, allFields: Array<string>) => {
    const table = uncapitalize(tableName)
    const fileName = `${table}.router.ts`;
    const className = `${table}Router`;
    const controllerName = `${table}Controller`;
    const filePath = path.join(__dirname, "../..", "src", "router", fileName);

    if (fs.existsSync(filePath)) {
      console.error("❌ File already exists.");
      process.exit(1);
    }

    // Generate all 
    let fieldContent = ``
    let fieldParamsContent = ``

    for (let fieldString of allFields) {
        const fieldArray = fieldString.split(":");
        const field = fieldArray[0];
        const type = capitalize(fieldArray[1]) as PrismaScalarType;

        // Check if type exist
        const isScalarType = prismaScalarTypes.has(type);
        if(!isScalarType) {
            console.log(`❌ Type ${type} is not a prisma scalar type`);
            return false;
        }
        // for data field
        fieldContent += field+",\n\t\t\t\t";
        // for function params
        fieldParamsContent += field+": "+prismaToTypeScriptType(type)+",\n\t\t";
    }

    // Genrate the code content
    const codeContent = `
import express from "express"
import ${controllerName} from "../controller/${table}.controller";
const ${className} = express.Router()

${className}.get('/', ${controllerName}.getAll)
${className}.get('/:id', ${controllerName}.getOne)
${className}.post('/', ${controllerName}.create)
${className}.put('/', ${controllerName}.update)
${className}.delete('/', ${controllerName}.delete)

export default ${className};
    `;

    try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, codeContent.trim());
        console.log(`✅ Router ${tableName} created successfuly.`);
        return true;
    } catch (error) {
        console.log("❌ Failed to write file:", error);
        return false;
    }

}

export {
    generateRouter
}