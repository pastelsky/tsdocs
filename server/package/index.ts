import path from "path";

import logger from "../../common/logger";
import fs from "fs";
import { checkFileExists, docsRootPath, getDocsPath } from "./utils";
import { resolvePackageJSON } from "./resolvers";
import { generateDocsForPackage } from "./extractor/doc-generator";
import semver from "semver";
import { generateDocsQueue, generateDocsQueueEvents } from "../queues";

const validTypeDocFragmentPaths: string[] = [
  "index",
  "index.html",
  "assets",
  "classes",
  "functions",
  "interfaces",
  "modules",
  "types",
  "variables",
];

function packageFromPath(pathFragments: string) {
  const [pathFragment1, pathFragment2, pathFragment3, ...otherPathFragments] =
    pathFragments.split("/");
  const isScopedPackage = pathFragment1.startsWith("@");
  const defaultPackageVersion = "latest";

  if (!pathFragment1) {
    return null;
  }

  let packageName, packageVersion, docsFragment;

  if (isScopedPackage && !pathFragment2) {
    return null;
  }

  if (isScopedPackage) {
    packageName = [pathFragment1, pathFragment2].join("/");
    if (pathFragment3) {
      // /docs/@foo/bar/modules/index.html
      if (validTypeDocFragmentPaths.includes(pathFragment3)) {
        packageVersion = defaultPackageVersion;
        docsFragment = [pathFragment3, ...otherPathFragments]
          .filter(Boolean)
          .join("/");
      } else {
        // /docs/@foo/bar/1.0/modules/index.html
        packageVersion = pathFragment3;
        docsFragment = otherPathFragments.join("/");
      }
    } else {
      // /docs/@foo/bar
      packageVersion = defaultPackageVersion;
      docsFragment = "";
    }
  } else {
    packageName = pathFragment1;
    if (pathFragment2) {
      // /docs/foo/module/index.html
      if (validTypeDocFragmentPaths.includes(pathFragment2)) {
        packageVersion = defaultPackageVersion;
        docsFragment = [pathFragment2, pathFragment3, ...otherPathFragments]
          .filter(Boolean)
          .join("/");
      } else {
        // /docs/foo/1.0/module/index.html
        packageVersion = pathFragment2;
        docsFragment = [pathFragment3, ...otherPathFragments]
          .filter(Boolean)
          .join("/");
      }
    } else {
      // /docs/foo
      packageVersion = defaultPackageVersion;
      docsFragment = "";
    }
  }

  return {
    packageName,
    packageVersion,
    docsFragment,
  };
}

export async function resolveDocsRequest({
  packageName,
  packageVersion,
}: {
  packageName: string;
  packageVersion: string;
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
  if (semver.valid(packageVersion)) {
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
  const routePackageDetails = packageFromPath(paramsPath);

  if (!routePackageDetails) {
    res.send(404);
    return;
  }

  const { packageName, packageVersion, docsFragment } = routePackageDetails;

  const resolvedRequest = await resolveDocsRequest({
    packageName,
    packageVersion,
  });

  if (resolvedRequest.type === "hit") {
    return res.send({ status: "success" });
  } else {
    const generateJob = await generateDocsQueue.add(
      `generate docs ${packageName}`,
      { packageJSON: resolvedRequest.packageJSON },
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
  const jobId = req.params.jobId;
  const job = await generateDocsQueue.getJob(jobId);

  if (!job) {
    res.send(404);
  }

  if (await job.isCompleted()) {
    return { status: "success" };
  } else if (await job.isFailed()) {
    return { status: "failed", failedReason: job.failedReason };
  }

  return { status: "queued" };
}

export async function handlerDocsHTML(req, res) {
  const paramsPath = req.params["*"];
  const routePackageDetails = packageFromPath(paramsPath);

  if (!routePackageDetails) {
    res.send(404);
    return;
  }

  const { packageName, packageVersion, docsFragment } = routePackageDetails;

  const resolvedRequest = await resolveDocsRequest({
    packageName,
    packageVersion,
  });

  if (resolvedRequest.type === "miss") {
    const generateJob = await generateDocsQueue.add(
      `generate docs ${packageName}`,
      { packageJSON: resolvedRequest.packageJSON },
    );
    await generateJob.waitUntilFinished(generateDocsQueueEvents);
  }

  const resolvedPath = path.join(
    resolvedRequest.packageName,
    resolvedRequest.packageVersion,
    docsFragment,
  );

  if (paramsPath !== resolvedPath) {
    res.redirect(`/docs/${resolvedPath}`);
  }

  const relativeDocsPath = path.relative(
    docsRootPath,
    path.join(resolvedRequest.docsPathDisk, docsFragment),
  );

  await res.sendFile(relativeDocsPath);
}
