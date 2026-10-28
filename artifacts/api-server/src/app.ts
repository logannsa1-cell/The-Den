import express, { type Express, type ErrorRequestHandler } from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import pinoHttp from "pino-http";
import router from "./routes";
import sourceExtractionRouter from "./routes/source-extraction";
import { requireAuth } from "./middlewares/requireAuth";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

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
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors({ credentials: true, origin: true }));
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

// Authenticate large uploads before parsing their body; keep the normal API limit.
app.use(sourceExtractionRouter);
// Expanded notes can include multibyte text. Only authenticated study saves
// receive the larger body budget; unrelated routes retain their existing limit.
app.use("/api/study-sets", requireAuth, express.json({ limit: "4mb" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/api", router);
const bodyLimitError: ErrorRequestHandler = (error, _req, res, next) => {
  if (error?.type === "entity.too.large") {
    res.status(413).json({ error: "This study set is too large to save in one request. No shortened copy was saved. Keep this page open and download your notes." });
    return;
  }
  next(error);
};
app.use(bodyLimitError);

export default app;
