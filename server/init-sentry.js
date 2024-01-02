const Sentry = require("@sentry/node");
const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
});

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    includeLocalVariables: true,
    integrations: [
      new Sentry.Integrations.Console(),
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.OnUncaughtException(),
      new Sentry.Integrations.OnUnhandledRejection(),
      new Sentry.Integrations.ContextLines(),
      new Sentry.Integrations.LocalVariables(),
      new Sentry.Integrations.Undici(),
      new Sentry.Integrations.RequestData(),
    ],
    tracesSampleRate: 1.0,
  });
}
