import { Queue, QueueEvents } from "bullmq";
import { Worker, Job } from "bullmq";
import InstallationUtils from "./package/installation.utils";
import os from "os";
import path from "path";
import logger from "../common/logger";
import { generateDocsForPackage } from "./package/extractor/doc-generator";

const redisOptions = {
  port: 6379,
  host: "localhost",
  password: "",
};

type InstallWorkerOptions = {
  packageName: string;
  packageVersion: string;
  installPath: string;
};

export const installQueue = new Queue<InstallWorkerOptions>("install-package", {
  connection: redisOptions,
});

export const installQueueEvents = new QueueEvents(installQueue.name, {
  connection: redisOptions,
});

installQueue.on("error", (err) => {
  logger.error("Error install queue:", err);
});

const installWorker = new Worker<InstallWorkerOptions>(
  installQueue.name,
  async (job: Job) => {
    await InstallationUtils.installPackage(
      [`${job.data.packageName}@${job.data.packageVersion}`],
      job.data.installPath,
      { client: "npm" },
    );
  },
  {
    concurrency: os.cpus().length - 1,
    connection: redisOptions,
  },
);

type GenerateDocsWorkerOptions = {
  packageJSON: object;
  force: boolean;
};

export const generateDocsQueue = new Queue<GenerateDocsWorkerOptions>(
  "generate-docs-package",
  {
    connection: redisOptions,
  },
);
export const generateDocsQueueEvents = new QueueEvents(generateDocsQueue.name, {
  connection: redisOptions,
});

generateDocsQueue.on("error", (err) => {
  logger.error("Error generating docs:", err);
});

const generateDocsWorker = new Worker<GenerateDocsWorkerOptions>(
  generateDocsQueue.name,
  path.join(__dirname, "./workers/docs-builder-worker.js"),
  {
    concurrency: os.cpus().length - 1,
    connection: redisOptions,
    useWorkerThreads: true,
  },
);

export const queues = [installQueue, generateDocsQueue];

setInterval(async () => {
  for (let queue of queues) {
    const failedJobs = await queue.getFailed();
    for (const job of failedJobs) {
      console.log("Removing all failed jobs");
      await job.remove();
    }
  }
}, 10000);
