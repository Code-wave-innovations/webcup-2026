require('dotenv').config()
import express from 'express';
import { Response, Request } from "express"
import fileUpload from "express-fileupload";
import compression from 'compression';
import cors from "cors"
import path from 'path';
import userRouter from './src/router/user.router';
import authRouter from './src/router/auth.router';
import meRouter from './src/router/me.router';
import districtRouter from './src/router/district.router';
import serviceCategoryRouter from './src/router/serviceCategory.router';
import cityServiceRouter from './src/router/cityService.router';
import procedureRouter from './src/router/procedure.router';
import translationRouter from './src/router/translation.router';
import citizenRequestRouter from './src/router/citizenRequest.router';
import announcementRouter from './src/router/announcement.router';
import alertRouter from './src/router/alert.router';
import notificationRouter from './src/router/notification.router';
import dashboardRouter from './src/router/dashboard.router';
import searchRouter from './src/router/search.router';
import homeRouter from './src/router/home.router';
import terraNovaRouter from './src/router/terraNova.router';
import { errorHandler, notFoundHandler } from './src/middleware/error';

const app = express();
const port = process.env.PORT || 9002;

app.use(cors())
app.use(express.urlencoded({extended : true}))
app.use(express.json());
// @ts-ignore
app.use(fileUpload({
  createParentPath: true,
  limits: { fileSize: 10 * 1024 * 1024 },
  abortOnLimit: true,
}));
// @ts-ignore
app.use(compression());

// Test route
app.get('/', (req: Request, res: Response) => {
  res.send('Hello from Backend boilerplate');
});

app.get('/api', (req: Request, res: Response) => {
  res.send('Hello from API boilerplate');
});

// All router here
app.use('/api/auth', authRouter);
app.use('/api/me', meRouter);
app.use('/api/users', userRouter);
app.use('/api/districts', districtRouter);
app.use('/api/service-categories', serviceCategoryRouter);
app.use('/api/services', cityServiceRouter);
app.use('/api/procedures', procedureRouter);
app.use('/api/translations', translationRouter);
app.use('/api/requests', citizenRequestRouter);
app.use('/api/announcements', announcementRouter);
app.use('/api/alerts', alertRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/search', searchRouter);
app.use('/api/home', homeRouter);
app.use('/api/terra-nova', terraNovaRouter);

const localImages = process.env.ENV && process.env.ENV == "development" ? './public' : '../public'
app.use('/public', express.static(path.join(__dirname, localImages)));

// Keep last: JSON 404 for unknown /api routes, then the shared error formatter
app.use('/api', notFoundHandler);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`🚀 Server is running at http://localhost:${port}`);
});
