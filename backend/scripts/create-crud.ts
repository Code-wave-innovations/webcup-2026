// Create crud 
// Command: npm run generate:crud -- user name:string last_name:string:@unique

import { generateSchema } from "./bases/schema.generation";
import { capitalize } from "./bases/utils";
import { generateModel } from "./bases/model.generation";
import { generateController } from "./bases/controller.generation";
import { generateRouter } from "./bases/router.generation";

const args = process.argv.slice(2);
const tableName = capitalize(args[0]);
const allFields = args.slice(1);

if (!tableName) {
  console.error("❌ Please provide a table name.");
  process.exit(1);
}

console.log(`Creating table: ${tableName} \n`);

// Creating new prisma model
let schemaCreated = generateSchema(tableName, allFields);

if(!schemaCreated) {
  process.exit(1);
}

// Creating model file
const modelCreated = generateModel(tableName, allFields)

if(!modelCreated) {
  process.exit(1);
}

// Creating controller file
const controllerCreated = generateController(tableName, allFields)

if(!controllerCreated) {
  process.exit(1);
}

// Creating router file
const routerCreated = generateRouter(tableName, allFields)

if(!routerCreated) {
  process.exit(1);
}