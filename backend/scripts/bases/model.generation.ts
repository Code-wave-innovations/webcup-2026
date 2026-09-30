import fs from "fs";
import path from "path";
import { capitalize, prismaToTypeScriptType, uncapitalize } from "./utils";
import { PrismaScalarType, prismaScalarTypes } from "../types/types";

const generateModel = (tableName: string, allFields: Array<string>) => {
    const table = uncapitalize(tableName)
    const fileName = `${table}.model.ts`;
    const className = `${table}Model`;
    const filePath = path.join(__dirname, "../..", "src", "model", fileName);

    if (fs.existsSync(filePath)) {
      console.error("❌ File already exists.");
      process.exit(1);
    }

    // Generate all 
    let fieldContent = ``
    let fieldContentFile = ``
    let fieldParamsContent = ``
    let fieldParamsContentFile = ``;

    for (let fieldString of allFields) {
        const fieldArray = fieldString.split(":");
        const field = fieldArray[0];
        const type = capitalize(fieldArray[1]) as PrismaScalarType;
        // Check if field is a file
        const isFile = fieldArray[2] == "file";

        // Check if type exist
        const isScalarType = prismaScalarTypes.has(type);
        if(!isScalarType) {
            console.log(`❌ Type ${type} is not a prisma scalar type`);
            return false;
        }
        if(!isFile) {
            // for data field
            fieldContent += field+",\n\t\t\t\t\t\t";
            // for function params
            fieldParamsContent += field+": "+prismaToTypeScriptType(type)+",\n\t\t";
        } else {
            fieldContentFile += field+",\n\t\t\t\t\t\t";
            fieldParamsContentFile += field+": "+prismaToTypeScriptType(type)+",\n\t\t";
        }
    }

    // Genrate the code content
    const codeContent = `
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const ${className} = {
    getAll: () => {
        return new Promise(async (resolve, reject) => {
            try {
                let result = await prisma.${table}.findMany({
                    orderBy: {
                        id: "desc"
                    }
                })        
                resolve(result)
            } catch (error) {
                reject(new Error("Data error: "+ error))
            } 
        })
    },
    getOne: (id: number) => {
        return new Promise(async (resolve, reject) => {
            try {
                let result = await prisma.${table}.findUnique({
                    where: {
                        id
                    }
                })
                resolve(result)
            } catch (error) {
                reject(new Error("Data error: "+ error))
            } 
        })
    },
    create: (
        ${fieldParamsContent}
        // file
        ${fieldParamsContentFile}
    ) =>{
        return new Promise(async (resolve, reject) => {
            try {
                let result = await prisma.${table}.create({
                    data: {
                        ${fieldContent}
                        // file
                        ${fieldContentFile}
                    }
                })
                resolve(result)
            } catch (error) {
                reject(new Error("Data error: "+ error))
            } 
        })
    },
    update: (
        id: number,
        ${fieldParamsContent}
        // file
        ${fieldParamsContentFile}
    ) =>{
        return new Promise(async (resolve, reject) => {
            try {
                let result = await prisma.${table}.update({
                    where: {
                        id
                    },
                    data: {
                        ${fieldContent}
                        // file
                        ${fieldContentFile}
                    }
                })
                resolve(result)
            } catch (error) {
                reject(new Error("Data error: "+ error))
            } 
        })
    },
    delete: (id: number) => {
        return new Promise(async (resolve, reject) => {
            try {
                let result = await prisma.${table}.delete({
                    where: {
                        id
                    }
                })
                resolve(result)
            } catch (error) {
                reject(new Error("Data error: "+ error))
            } 
        })
    },
}

export default ${className};
    `;

    try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, codeContent.trim());
        console.log(`✅ Model ${tableName} created successfuly.`);
        return true;
    } catch (error) {
        console.log("❌ Failed to write file:", error);
        return false;
    }

}

export {
    generateModel
}