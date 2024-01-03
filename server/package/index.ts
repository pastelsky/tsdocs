import path from "path";

import { docsRootPath, getDocsPath } from "./utils";
import { resolvePackageJSON } from "./resolvers";
import semver from "semver";
import { generateDocsQueue, generateDocsQueueEvents } from "../queues";
import { packageFromPath } from "../../common/utils";
import { PackageNotFoundError } from "./CustomError";
import logger from "../../common/logger";
import { parse } from "node-html-parser";
import fs from "fs";
import * as stackTraceParser from "stacktrace-parser";
import { LRUCache } from "lru-cache";

export async function resolveDocsRequest({
  packageName,
  packageVersion,
  force,
}: {
  packageName: string;
  packageVersion: string;
  force: boolean;
}): Promise<
  | {
      type: "hit";
      packageName: string;
      packageVersion: string;
      docsPathDisk: string;
    }
  | {
      type: "miss";
      packageName: string;
      packageVersion: string;
      packageJSON: { [key: string]: any };
      docsPathDisk: string;
    }
> {
  if (force) {
    const packageJSON = await resolvePackageJSON({
      packageName,
      packageVersion,
    });

    const docsPathDisk = getDocsPath({
      packageName: packageName,
      packageVersion: packageVersion,
    });

    console.log("Force true, returning miss");
    return {
      type: "miss",
      packageName: packageJSON.name,
      packageVersion: packageJSON.version,
      packageJSON,
      docsPathDisk,
    };
  }

  if (semver.valid(packageVersion)) {
    const docsPathDisk = getDocsPath({
      packageName: packageName,
      packageVersion: packageVersion,
    });

    if (fs.existsSync(path.join(docsPathDisk, "index.html"))) {
      console.log("Index.html exists at docsPathDisk", docsPathDisk, "HIT");

      return {
        type: "hit",
        packageName,
        packageVersion,
        docsPathDisk,
      };
    }
  }

  const packageJSON = await resolvePackageJSON({
    packageName,
    packageVersion,
  });

  const docsPathDisk = getDocsPath({
    packageName: packageJSON.name,
    packageVersion: packageJSON.version,
  });

  if (fs.existsSync(path.join(docsPathDisk, "index.html"))) {
    console.log(
      "Index.html exists at docsPathDisk after resolving version",
      docsPathDisk,
    );

    return {
      type: "hit",
      packageName: packageJSON.name,
      packageVersion: packageJSON.version,
      docsPathDisk,
    };
  }

  console.log("No hits, hence miss", docsPathDisk);

  return {
    type: "miss",
    packageName: packageJSON.name,
    packageVersion: packageJSON.version,
    packageJSON,
    docsPathDisk,
  };
}

export async function handlerAPIDocsTrigger(req, res) {
  const paramsPath = req.params["*"];
  const { force } = req.query;
  const routePackageDetails = packageFromPath(paramsPath);
  logger.info("routePackageDetails is ", routePackageDetails);

  if (!routePackageDetails) {
    logger.error("Route package details not found in " + paramsPath);
    return res.status(404).send({
      name: PackageNotFoundError.name,
    });
  }

  const { packageName, packageVersion, docsFragment } = routePackageDetails;

  const resolvedRequest = await resolveDocsRequest({
    packageName,
    packageVersion,
    force,
  });

  if (resolvedRequest.type === "hit") {
    return res.send({ status: "success" });
  } else {
    const generateJob = await generateDocsQueue.add(
      `generate docs ${packageName}`,
      { packageJSON: resolvedRequest.packageJSON, force },
      {
        jobId: `${resolvedRequest.packageJSON.name}@${resolvedRequest.packageJSON.version}`,
        priority: 100,
        attempts: 1,
      },
    );

    return res.send({
      status: "queued",
      jobId: generateJob.id,
      pollInterval: 2000,
    });
  }
}

function cleanStackTrace(stackTrace: string | undefined) {
  if (!stackTrace) return "";

  let parsedStackTrace = [];
  try {
    const parsed = stackTraceParser.parse(stackTrace);
    parsedStackTrace = parsed.map((stack) => ({
      ...stack,
      file: stack.file.split("node_modules/").pop().replace(process.cwd(), ""),
    }));
  } catch (err) {
    logger.error("Failed to parse stack trace", err);
    parsedStackTrace = [];
  }

  return parsedStackTrace
    .map(
      (stack) => `at ${stack.methodName} in ${stack.file}:${stack.lineNumber}`,
    )
    .join("\n");
}

const priorityCache = new LRUCache<string, number>({
  ttl: 1000 * 60 * 3,
  max: 500,
});

export async function handlerAPIDocsPoll(req, res) {
  const jobId = req.params["*"];
  const job = await generateDocsQueue.getJob(jobId);

  if (!job) {
    logger.error(`Job ${jobId} not found in queue`);
    return res.status(404);
  }

  if (priorityCache.has(jobId)) {
    await job.changePriority({
      priority: priorityCache.get(jobId) - 1,
    });
    priorityCache.set(jobId, priorityCache.get(jobId) - 1);
  } else {
    await job.changePriority({
      priority: 99,
    });
    priorityCache.set(jobId, 99);
  }

  if (await job.isCompleted()) {
    return { status: "success" };
  } else if (await job.isFailed()) {
    return res.send({
      status: "failed",
      errorCode: job.failedReason,
      errorMessage: job.data.originalError?.message,
      errorStack: cleanStackTrace(job.data.originalError?.stacktrace),
    });
  }

  return { status: "queued" };
}

const preloadCache = new LRUCache<
  string,
  { url: string; rel: string; as: string }[]
>({
  max: 500,
});

function extractPreloadResources(htmlPath: string) {
  if (preloadCache.get(htmlPath)) {
    return preloadCache.get(htmlPath);
  }

  const htmlContent = fs.readFileSync(htmlPath, "utf8");
  const root = parse(htmlContent);
  const scriptAssets = root
    .querySelectorAll("script")
    .map((script) => script.getAttribute("src"))
    .filter(Boolean)
    .map((src) => {
      if (src.startsWith("/")) {
        return {
          url: src,
          rel: "preload",
          as: "script",
        };
      }

      if (!src.startsWith("http") && !src.startsWith("//")) {
        const relativeDocsPath = path.join(
          "/docs",
          path.relative(docsRootPath, path.join(path.dirname(htmlPath), src)),
        );
        return {
          url: relativeDocsPath,
          rel: "preload",
          as: "script",
        };
      }
      return null;
    })
    .filter(Boolean);

  const linkAssets = root
    .querySelectorAll("link")
    .map((link) => link.getAttribute("href"))
    .map((href) => {
      const pathName = href.split("?")[0];
      if (pathName.endsWith(".css")) {
        if (href.startsWith("/")) {
          return {
            url: href,
            rel: "preload",
            as: "style",
          };
        }

        if (!href.startsWith("http") && !href.startsWith("//")) {
          const relativeDocsPath = path.join(
            "/docs",
            path.relative(
              docsRootPath,
              path.join(path.dirname(htmlPath), href),
            ),
          );
          return {
            url: relativeDocsPath,
            rel: "preload",
            as: "style",
          };
        }
        return null;
      }
    })
    .filter(Boolean);

  const jsAssets = {
    url: "/shared-dist/header.umd.js",
    rel: "preload",
    as: "script",
  };
  const preloadAssets = [...linkAssets, ...scriptAssets, jsAssets];
  preloadCache.set(htmlPath, preloadAssets);
  return preloadAssets;
}

export async function handlerDocsHTML(req, res) {
  const paramsPath = req.params["*"];
  const { force } = req.query;
  const routePackageDetails = packageFromPath(paramsPath);

  if (!routePackageDetails) {
    return res.status(404);
  }

  const { packageName, packageVersion, docsFragment } = routePackageDetails;

  const resolvedRequest = await resolveDocsRequest({
    packageName,
    packageVersion,
    force,
  });

  if (resolvedRequest.type === "miss") {
    const generateJob = await generateDocsQueue.add(
      `generate docs ${packageName}`,
      { packageJSON: resolvedRequest.packageJSON, force },
      {
        jobId: `${resolvedRequest.packageJSON.name}@${resolvedRequest.packageJSON.version}`,
        priority: 100,
        attempts: 1,
      },
    );
    await generateJob.waitUntilFinished(generateDocsQueueEvents);
  }

  const resolvedPath = path.join(
    resolvedRequest.packageName,
    resolvedRequest.packageVersion,
    docsFragment,
  );

  if (paramsPath !== resolvedPath) {
    return res.redirect(`/docs/${resolvedPath}`);
  }

  const resolvedAbsolutePath = path.join(
    resolvedRequest.docsPathDisk,
    docsFragment,
  );
  const relativeDocsPath = path.relative(docsRootPath, resolvedAbsolutePath);

  if (relativeDocsPath.endsWith(".html")) {
    // Cache HTML for 2 hours
    res.header("Cache-Control", "public, max-age=3600");
    const linkHeaderContent = extractPreloadResources(resolvedAbsolutePath)
      .map(
        ({ url, rel, as }) =>
          `<https://tsdocs.dev${url}>; rel="${rel}"; as="${as}"`,
      )
      .join(", ");
    res.header("Link", linkHeaderContent);
  } else {
    // Cache rest for 8 hours
    res.header("Cache-Control", `public, max-age=${60 * 60 * 8}`);
  }

  return res.sendFile(relativeDocsPath);
}
