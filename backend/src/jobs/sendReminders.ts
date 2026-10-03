// F40: one-shot reminder run, for a cPanel Cron Job. Passenger puts the app to sleep when it
// gets no traffic, which pauses the in-process scheduler; this job does not depend on it.
// Cron (every 5 min): cd ~/<app folder> && <node path from cPanel> dist/src/jobs/sendReminders.js
require("dotenv").config();
import prisma from "../lib/prisma";
import { sendDueReminders } from "../lib/scheduler";

sendDueReminders()
  .then((sent) => console.log(`${new Date().toISOString()} reminders sent: ${sent}`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
