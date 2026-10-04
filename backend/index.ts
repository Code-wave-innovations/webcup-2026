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
import securityRouter from './src/router/security.router';
import serviceInterruptionRouter from './src/router/serviceInterruption.router';
import transitRouter from './src/router/transit.router';
import appointmentRouter from './src/router/appointment.router';
import settingsRouter from './src/router/settings.router';
import auditRouter from './src/router/audit.router';
import permissionRouter from './src/router/permission.router';
import { startScheduler } from './src/lib/scheduler';
import { errorHandler, notFoundHandler } from './src/middleware/error';

const app = express();
app.disable('x-powered-by');
// Behind a reverse proxy, set TRUST_PROXY=1 so req.ip (used by the login guard) is the client IP
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
const port = process.env.PORT || 9002;

// CORS_ORIGINS: comma-separated list of allowed front-end origins (every origin when unset)
const corsOrigins = process.env.CORS_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean);
// Retry-After (F37 lockouts, rate limits) must be readable by the front, which runs on another origin
app.use(cors({ origin: corsOrigins?.length ? corsOrigins : true, exposedHeaders: ["Retry-After", "Content-Disposition", "X-Alert-Next-At"] }))
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
  res.send('Hello from API Terra Nova');
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
app.use('/api/security', securityRouter);
app.use('/api/service-interruptions', serviceInterruptionRouter);
app.use('/api/transit', transitRouter);
app.use('/api/appointments', appointmentRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/audit-logs', auditRouter);
app.use('/api/permissions', permissionRouter);

const localImages = process.env.ENV && process.env.ENV == "development" ? './public' : '../public'
app.use('/public', express.static(path.join(__dirname, localImages)));

// Keep last: JSON 404 for unknown /api routes, then the shared error formatter
app.use('/api', notFoundHandler);
app.use(errorHandler);

// F40: appointment reminders
startScheduler();

app.listen(port, () => {
  console.log(`🚀 Server is running at http://localhost:${port}`);
});
