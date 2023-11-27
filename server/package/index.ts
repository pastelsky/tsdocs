import path from "path";

import { checkFileExists, docsRootPath, getDocsPath } from "./utils";
import { resolvePackageJSON } from "./resolvers";
import semver from "semver";
import { generateDocsQueue, generateDocsQueueEvents } from "../queues";
import { packageFromPath } from "../../common/utils";
import { PackageNotFoundError } from "./CustomError";
import logger from "../../common/logger";

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
    res.send(404).send({
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
      }
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
    res.send(404);
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

export async function handlerDocsHTML(req, res) {
  const paramsPath = req.params["*"];
  const { force } = req.query;
  const routePackageDetails = packageFromPath(paramsPath);

  if (!routePackageDetails) {
    res.send(404);
    return;
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
      { packageJSON: resolvedRequest.packageJSON, force }
    );
    await generateJob.waitUntilFinished(generateDocsQueueEvents);
  }

  const resolvedPath = path.join(
    resolvedRequest.packageName,
    resolvedRequest.packageVersion,
    docsFragment
  );

  if (paramsPath !== resolvedPath) {
    res.redirect(`/docs/${resolvedPath}`);
  }

  const relativeDocsPath = path.relative(
    docsRootPath,
    path.join(resolvedRequest.docsPathDisk, docsFragment)
  );

  if (relativeDocsPath.endsWith(".html")) {
    res.header("Cache-Control", "public, max-age=10");
  }
  await res.sendFile(relativeDocsPath);
}
