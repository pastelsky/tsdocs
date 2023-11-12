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
import logger from "./common/logger";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { FastifyAdapter } from "@bull-board/fastify";
import { queues } from "./server/queues";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;

const fastify = fastifyStart({
  logger: false,
});

const app = next({ dev, hostname, port });
const nextHandle = app.getRequestHandler();

const queueDashboardAdapter = new FastifyAdapter();

createBullBoard({
  queues: queues.map((queue) => new BullMQAdapter(queue)),
  serverAdapter: queueDashboardAdapter,
});

queueDashboardAdapter.setBasePath("/queue/ui");

app
  .prepare()
  .then(() => {
    fastify.register(fastifyStatic, {
      root: docsRootPath,
      index: ["index.html"],
      redirect: true,
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

    // fastify.route({
    //   method: "GET",
    //   url: "/api/package",
    //   schema: {
    //     querystring: {
    //       package: { type: "string" },
    //     },
    //   },
    //   handler: async (request, reply) => {
    //     return handlerAPI(request, reply);
    //   },
    // });

    queueDashboardAdapter.setBasePath("/queue/ui");

    fastify.register(queueDashboardAdapter.registerPlugin(), {
      basePath: "/",
      prefix: "/queue/ui",
    });

    fastify.route({
      method: "POST",
      url: `/api/docs/trigger/*`,
      handler: async (request, reply) => {
        return handlerAPIDocsTrigger(request, reply);
      },
    });

    fastify.route({
      method: "GET",
      url: `/api/docs/poll/:jobId`,
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

    fastify.setErrorHandler((error) => {
      logger.error(error);
    });

    // Run the server!
    const start = async () => {
      try {
        await fastify.listen({ port });
        console.log("Server started at ", `http://localhost:${port}`);
        console.log("Queue UI at ", `http://localhost:${port}/queue/ui`);
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
