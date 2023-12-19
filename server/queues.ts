import { Queue, QueueEvents } from "bullmq";
import { Worker, Job } from "bullmq";
import InstallationUtils from "./package/installation.utils";
import os from "os";
import path from "path";
import logger from "../common/logger";

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
  // Added by worker if there is an error
  originalError?: {
    code?: string;
    message?: string;
    stacktrace?: string;
  };
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
    limiter: {
      max: 1,
      duration: 10000,
    },
  },
);

const cleanupCacheQueue = new Queue("cleanup-cache", {
  connection: redisOptions,
});

if (process.env.NODE_ENV === "production") {
  cleanupCacheQueue.add("cleanup", null, {
    repeat: {
      // Every hour
      pattern: "0 * * * *",
    },
  });
}

const cleanupCacheWorker = new Worker(
  cleanupCacheQueue.name,
  path.join(__dirname, "./workers/cleanup-cache.js"),
  {
    concurrency: 1,
    connection: redisOptions,
    useWorkerThreads: true,
  },
);

export const appQueues = [installQueue, generateDocsQueue];
export const scheduledQueues = [cleanupCacheQueue];
export const allQueues = [...scheduledQueues, ...appQueues];
const workers = [installWorker, generateDocsWorker, cleanupCacheWorker];

async function shutdownWorkers(): Promise<void> {
  await Promise.all(workers.map((worker) => installWorker.close()));
  process.exit(0);
}

async function handleSignal() {
  try {
    await shutdownWorkers();
  } catch (err) {
    console.error("Error during shutdown", err);
    process.exit(1);
  }
}

process.on("SIGTERM", handleSignal);
process.on("SIGINT", handleSignal);
process.on("SIGUSR2", handleSignal);
process.on("SIGUSR1", handleSignal);

setInterval(async () => {
  for (const queue of appQueues) {
    const finishedJobs = await queue.getJobs(["completed"]);
    const failedJobs = await queue.getJobs(["failed"]);
    const unfinishedJobs = await queue.getJobs([
      "active",
      "wait",
      "waiting",
      "delayed",
      "prioritized",
    ]);

    for (let job of finishedJobs) {
      // Older than 10 seconds
      const finishedExpiryAgo = Date.now() - 30 * 1000;
      if (job.finishedOn < finishedExpiryAgo) {
        logger.warn(`Removing finished job ${job.id} because its too old`, {
          job: job.id,
          finishedOn: new Date(job.finishedOn),
        });
        await job.remove();
      }
    }

    for (let job of failedJobs) {
      // Older than 10 seconds
      const failedExpiryAgo = Date.now() - 60 * 5 * 1000;
      if (job.finishedOn < failedExpiryAgo) {
        logger.warn(`Removing failed job ${job.id} because its too old`, {
          job: job.id,
          finishedOn: new Date(job.finishedOn),
        });
        await job.remove();
      }
    }

    for (let job of unfinishedJobs.filter(Boolean)) {
      const unfinishedExpiryAgo = Date.now() - 2 * 60 * 1000;
      try {
        if (job.timestamp < unfinishedExpiryAgo) {
          logger.warn(
            `Removing ${job.getState()} job ${job.id} because its too old`,
            {
              job: job.id,
              startedOn: new Date(job.timestamp),
            },
          );
          await job.remove();
        }
      } catch (err) {
        logger.error("Failed to remove job", { err, job });
      }
    }
  }
}, 5000);
