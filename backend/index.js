"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require('dotenv').config();
const express_1 = __importDefault(require("express"));
const express_fileupload_1 = __importDefault(require("express-fileupload"));
const compression_1 = __importDefault(require("compression"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const user_router_1 = __importDefault(require("./src/router/user.router"));
const app = (0, express_1.default)();
const port = process.env.PORT || 9002;
app.use((0, cors_1.default)());
app.use(express_1.default.urlencoded({ extended: true }));
app.use(express_1.default.json());
// @ts-ignore
app.use((0, express_fileupload_1.default)({
    createParentPath: true
}));
// @ts-ignore
app.use((0, compression_1.default)());
// Test route
app.get('/', (req, res) => {
    res.send('Hello from Backend boilerplate');
});
app.get('/api', (req, res) => {
    res.send('Hello from API boilerplate');
});
// All router here
app.use('/api/users', user_router_1.default);
const localImages = process.env.ENV && process.env.ENV == "development" ? './public' : '../public';
app.use('/public', express_1.default.static(path_1.default.join(__dirname, localImages)));
app.listen(port, () => {
    console.log(`🚀 Server is running at http://localhost:${port}`);
});
