import fastifyStart from "fastify";
import fastifyStatic from "@fastify/static";
import next from "next";
import {
  handlerAPIDocsPoll,
  handlerAPIDocsTrigger,
  handlerDocsHTML,
} from "./server/package";
import path from "path";
import { docsRootPath } from "./server/package/utils";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { FastifyAdapter } from "@bull-board/fastify";
import { allQueues } from "./server/queues";
import {
  CustomError,
  PackageNotFoundError,
  PackageVersionMismatchError,
} from "./server/package/CustomError";
import logger from "./common/logger";
import fastifyBasicAuth from "@fastify/basic-auth";
import "dotenv/config";

import heapdump from "heapdump";

import v8 from "v8";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;

const fastify = fastifyStart({
  logger: {
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
    level: "warn",
  },
});

const app = next({ dev, hostname, port });
const nextHandle = app.getRequestHandler();

const queueDashboardAdapter = new FastifyAdapter();

createBullBoard({
  queues: allQueues.map((queue) => new BullMQAdapter(queue)),
  serverAdapter: queueDashboardAdapter,
});

queueDashboardAdapter.setBasePath("/queue/ui");

app
  .prepare()
  .then(() => {
    fastify.register(fastifyStatic, {
      root: docsRootPath,
      index: ["index.html"],
      redirect: false,
      allowedPath: (pathName) => {
        if (pathName.includes("..")) {
          return false;
        }
        return true;
      },
      extensions: ["html", "js", "css"],
      list: false,
      // list: {
      //   format: "html",
      //   render: (dirs, files) => {
      //     return `
      //       <html>
      //       <head>
      //            <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/yegor256/tacit@gh-pages/tacit-css-1.6.0.min.css"/>
      //       </head>
      //       <body>
      //
      //       <ul>
      //         ${dirs
      //           .map(
      //             (dir) =>
      //               `<li><a href="${`/docs/` + dir.href}">${dir.name}</a></li>`,
      //           )
      //           .join("\n  ")}
      //       </ul>
      //       <ul>
      //         ${files
      //           .map(
      //             (file) =>
      //               `<li><a href="${"/docs" + file.href}">${
      //                 file.name
      //               }</a></li>`,
      //           )
      //           .join("\n  ")}
      //       </ul>
      //       </body></html>
      //       `;
      //   },
      // },
      serve: false,
    });

    fastify.register(fastifyBasicAuth, {
      validate(username, password, _req, reply, done) {
        if (
          username === "tsdocs" &&
          password === process.env["TSDOCS_PASSWORD"]
        ) {
          done();
        } else {
          reply.status(401).send("Unauthorized");
        }
      },
      authenticate: true,
    });

    fastify.register(fastifyStatic, {
      root: path.join(__dirname, "shared-dist"),
      redirect: true,
      prefix: "/shared-dist/",
      allowedPath: (pathName) => {
        if (pathName.includes("..")) {
          return false;
        }
        return true;
      },
      extensions: ["js", "css"],
      list: false,
      serve: true,
      decorateReply: false,
      cacheControl: false,
    });

    queueDashboardAdapter.setBasePath("/queue/ui");

    fastify.register(queueDashboardAdapter.registerPlugin(), {
      basePath: "/",
      prefix: "/queue/ui",
    });

    fastify.route({
      method: "POST",
      url: `/api/docs/trigger/*`,
      handler: handlerAPIDocsTrigger,
    });

    fastify.setErrorHandler(function (error, request, reply) {
      logger.error(error);

      if (error instanceof CustomError) {
        const payload = {
          name: error.name,
          extra: error.extra,
        };

        switch (error.name) {
          case PackageVersionMismatchError.name:
          case PackageNotFoundError.name:
            reply.status(404).send(payload);
            break;
          default:
            reply.status(500).send(payload);
        }
      }
      reply.status(500).send(error);
    });

    fastify.route({
      method: "GET",
      url: `/api/docs/poll/*`,
      handler: async (request, reply) => {
        return handlerAPIDocsPoll(request, reply);
      },
    });

    fastify.route({
      method: "GET",
      url: `/docs/*`,
      handler: async (request, reply) => {
        return handlerDocsHTML(request, reply);
      },
    });

    fastify.setNotFoundHandler((request, reply) =>
      nextHandle(request.raw, reply.raw),
    );

    fastify.addHook("onRequest", (req, reply, next) => {
      if (
        !req.url.startsWith("/queue/ui") ||
        !process.env["BULL_MQ_DASHBOARD_KEY"]
      ) {
        return next();
      }
      fastify.basicAuth(req, reply, function (error) {
        if (!error) {
          return next();
        }

        if (error.name === "FastifyError") {
          reply.redirect(401, "/queue/ui");
        }
        reply.code(500).send({ error: error.message });
      });
    });

    // Run the server!
    const start = async () => {
      try {
        await fastify.listen({ port });
        console.log("Server started at ", `http://localhost:${port}`);
        console.log("Queue UI at ", `http://localhost:${port}/queue/ui`);
        // For PM2 to know that our server is up
        if (process.send) process.send("ready");
      } catch (err) {
        console.error("server threw error on startup: ", err);
        fastify.log.error(err);
        process.exit(1);
      }
    };
    start();
  })
  .catch((err) => {
    console.log("Failed to prepare app with error: ", err);
  });

// Set your memory limit (in bytes)
const memoryLimit = 1 * 1024 * 1024 * 1024; // 1 GB

let heapDumped = false;
setInterval(function () {
  if (heapDumped) return;

  const rssUsed = process.memoryUsage().rss;
  const heapUsed = process.memoryUsage().heapUsed;
  console.log({
    heapUsed: heapUsed / (1024 * 1024),
    rssUsed: rssUsed / (1024 * 1024),
  });
  if (heapUsed > memoryLimit) {
    console.log("Memory limit exceeded... writing heapdump");
    require("fs").mkdirSync("./heapdumps", { recursive: true });
    heapdump.writeSnapshot("./heapdumps/" + Date.now() + ".heapsnapshot");
    heapDumped = true;
  }
}, 1000);
