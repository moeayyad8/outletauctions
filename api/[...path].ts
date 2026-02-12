import express, { type NextFunction, type Request, type Response } from "express";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

let appPromise: Promise<express.Express> | null = null;

async function createApiApp(): Promise<express.Express> {
  const app = express();

  app.use(
    express.json({
      limit: "50mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false, limit: "50mb" }));

  const { registerRoutes } = await import("../server/routes");
  await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  return app;
}

export default async function handler(req: Request, res: Response) {
  try {
    if (!appPromise) {
      appPromise = createApiApp();
    }
    const app = await appPromise;
    return app(req, res);
  } catch (error: any) {
    console.error("API bootstrap failed:", error);
    appPromise = null;
    return res.status(500).json({
      message: "API bootstrap failed",
      error: error?.message || "Unknown error",
    });
  }
}
