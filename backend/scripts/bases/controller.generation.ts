import fs from "fs";
import path from "path";
import { capitalize, prismaToTypeScriptType, uncapitalize } from "./utils";
import { PrismaScalarType, prismaScalarTypes } from "../types/types";

const generateController = (tableName: string, allFields: Array<string>) => {
    const table = uncapitalize(tableName)
    const fileName = `${table}.controller.ts`;
    const className = `${table}Controller`;
    const modelName = `${table}Model`;
    const filePath = path.join(__dirname, "../..", "src", "controller", fileName);

    if (fs.existsSync(filePath)) {
      console.error("❌ File already exists.");
      process.exit(1);
    }

    // Variable for all logic
    let fieldContent = ``;
    let fieldParamsContent = ``;
    let fileVariableHandler = ``;
    let fileConditionHandler = ``;
    let fileCodeHandler = ``;
    let fileVariableToSend = ``;
    let hasFile = false;

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
            fieldContent += field+",\n\t\t\t\t";
            // for function params
            fieldParamsContent += field+": "+prismaToTypeScriptType(type)+",\n\t\t";
        } else {
            // case of file create a variable to handle the file
            hasFile = true;
            fileVariableHandler += `let file_for_${field} : any = null;\n\t\t`;
            fileConditionHandler += `&& req.files.${field}`+"\n\t\t\t\t";
            fileCodeHandler += `
            \tfile_for_${field} = await uploadFile(
                \t"./public/",
                \treq.files.${field},
                \treq.body.${field}.replace(" ", "_")
            \t);
            `;
            fileVariableToSend += `file_for_${field}`+",\n\t\t\t\t";
        }
    }

    // Genrate the code content
    const codeContent = `
import { Response, Request } from "express";
import ${modelName} from "../model/${table}.model";
import { uploadFile } from "../services/services";

const ${className} = {
    getAll: async (req: Request, res: Response) => {
        try {
            let result = await ${modelName}.getAll();
            res.status(200).send(result)
        } catch (error: any) {
            console.log(error)
            res.status(500).send(error)
        }
    },
    getOne: async (req: Request, res: Response) => {
        try {
            let { id } = req.params
            let result = await ${modelName}.getOne(parseInt(id));
            res.status(200).send(result)
        } catch (error: any) {
            console.log(error)
            res.status(500).send(error)
        }
    },
    create: async (req: Request, res: Response) => {
        let { 
            ${fieldContent}
        } = req.body
        // file
        ${fileVariableHandler}
        try {
            ${hasFile ? (`
            if (
                req.files 
                ${fileConditionHandler}
            ) {
            ${fileCodeHandler}
            } else {
                res.status(400).send("There is empty file you given")
            }
            `) : '\n'} 
            let result = await ${modelName}.create(
                ${fieldContent}
                // file
                ${fileVariableToSend}
            )
            res.status(200).send(result)            
        }
        catch (error: any) {
            console.log(error)
            res.status(500).send(error)
        }
    },
    update: async (req: Request, res: Response) => {
        let { 
            ${fieldContent}
        } = req.body
        let id = parseInt(req.body.id)
        ${fileVariableHandler}
        try {
            ${hasFile ? (`
            if (
                req.files 
                ${fileConditionHandler}
            ) {
            ${fileCodeHandler}
            } else {
                res.status(400).send("There is empty file you given")
            }
            `) : '\n'} 
            let result = await ${modelName}.update(
                id,
                ${fieldContent}
                // file
                ${fileVariableToSend}
            )
            res.status(200).send(result)            
        }
        catch (error: any) {
            console.log(error)
            res.status(500).send(error)
        }
    },
    delete: async (req: Request, res: Response) => {
        let id = parseInt(req.body.id)
        try {
            let result = await ${modelName}.delete(
                id
            )
            res.status(200).send(result)            
        }
        catch (error: any) {
            console.log(error)
            res.status(500).send(error)
        }
    },
}

export default ${className};
    `;

    try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, codeContent.trim());
        console.log(`✅ Controller ${tableName} created successfuly.`);
        return true;
    } catch (error) {
        console.log("❌ Failed to write file:", error);
        return false;
    }

}

export {
    generateController
}