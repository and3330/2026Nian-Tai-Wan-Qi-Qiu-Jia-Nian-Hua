import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { authMiddleware } from "./middlewares/authMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { handleStripeWebhook } from "./routes/payments";
import { ensureDefaultTemplates } from "./services/email-service";
import { startReminderScheduler } from "./services/reminder-scheduler";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());

// Stripe webhook MUST receive the raw request body to verify the signature.
// Register this route BEFORE express.json() / express.urlencoded() parsers.
app.post(
  "/api/payments/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    const sig = Array.isArray(signature) ? signature[0] : signature || "";
    try {
      await handleStripeWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (err) {
      logger.error({ err }, "[Stripe webhook] error");
      res.status(400).json({ error: "Webhook handling failed" });
    }
  },
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

app.use("/api", router);

// Boot-time setup
ensureDefaultTemplates()
  .then(() => {
    startReminderScheduler();
  })
  .catch((err) => {
    logger.error({ err }, "[Startup] Failed to seed email templates / start reminders");
  });

export default app;
