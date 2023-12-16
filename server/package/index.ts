import path from "path";

import { checkFileExists, docsRootPath, getDocsPath } from "./utils";
import { resolvePackageJSON } from "./resolvers";
import semver from "semver";
import { generateDocsQueue, generateDocsQueueEvents } from "../queues";
import { packageFromPath } from "../../common/utils";
import { PackageNotFoundError } from "./CustomError";
import logger from "../../common/logger";
import { parse } from "node-html-parser";
import fs from "fs";

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
  if (!force && semver.valid(packageVersion)) {
    const docsPathDisk = getDocsPath({
      packageName: packageName,
      packageVersion: packageVersion,
    });

    if (await checkFileExists(path.join(docsPathDisk, "index.html")))
      return {
        type: "hit",
        packageName,
        packageVersion,
        docsPathDisk,
      };
  }

  const packageJSON = await resolvePackageJSON({
    packageName,
    packageVersion,
  });

  const docsPathDisk = getDocsPath({
    packageName: packageJSON.name,
    packageVersion: packageJSON.version,
  });

  if (force) {
    return {
      type: "miss",
      packageName: packageJSON.name,
      packageVersion: packageJSON.version,
      packageJSON,
      docsPathDisk,
    };
  }

  if (await checkFileExists(path.join(docsPathDisk, "index.html"))) {
    return {
      type: "hit",
      packageName: packageJSON.name,
      packageVersion: packageJSON.version,
      docsPathDisk,
    };
  }

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
    res.code(404).send({
      name: PackageNotFoundError.name,
    });
    return;
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
      },
    );

    return res.send({
      status: "queued",
      jobId: generateJob.id,
      pollInterval: 2000,
    });
  }
}

export async function handlerAPIDocsPoll(req, res) {
  const jobId = req.params["*"];
  const job = await generateDocsQueue.getJob(jobId);

  if (!job) {
    logger.error(`Job ${jobId} not found in queue`);
    return res.status(404);
  }

  if (await job.isCompleted()) {
    return { status: "success" };
  } else if (await job.isFailed()) {
    return res.send({
      status: "failed",
      errorCode: job.failedReason,
    });
  }

  return { status: "queued" };
}

function extractPreloadResources(htmlPath: string) {
  const htmlContent = fs.readFileSync(htmlPath, "utf8");
  const root = parse(htmlContent);
  const linkAssets = root
    .querySelectorAll("link")
    .map((link) => link.getAttribute("href"))
    .map((href) => {
      if (href.split("?")[0].endsWith(".css")) {
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
  return [...linkAssets, jsAssets];
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
    res.header("Cache-Control", "public, max-age=3600");
    const linkHeaderContent = extractPreloadResources(resolvedAbsolutePath)
      .map(
        ({ url, rel, as }) =>
          `<https://tsdocs.dev${url}>; rel="${rel}"; as="${as}"`,
      )
      .join(", ");
    res.header("Link", linkHeaderContent);
  }

  return res.sendFile(relativeDocsPath);
}
