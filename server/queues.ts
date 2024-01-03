import { Queue, QueueEvents } from "bullmq";
import { Worker, Job } from "bullmq";
import InstallationUtils from "./package/installation.utils";
import os from "os";
import path from "path";
import logger from "../common/logger";
import { config } from "dotenv";
import { InstallPackageOptions } from "./package/types";
import { execSync } from "node:child_process";

config({
  path: path.join(__dirname, "../.env"),
});

/**
 * When pm2 restarts the server, its possible for worker processes to be left behind.
 * Here we force kill all such processes
 */
function killAllBullMQProcesses(processName: string) {
  if (process.env.NODE_ENV !== "production") return;

  const ageInSeconds = 30;
  const command = `ps aux | grep '${processName}' | grep -v grep | awk '{split($10,a,":"); if (a[1] * 60 + a[2] > ${ageInSeconds}) print $2}' | xargs -r kill -9`;
  try {
    execSync(command);
    console.log(`Killed processes with name containing '${processName}'`);
  } catch (error) {
    console.error(`Error killing processes: ${error}`);
  }
}

// killAllBullMQProcesses("bullmq");

const redisOptions = {
  port: 6379,
  host: "localhost",
  password: "",
};

type InstallWorkerOptions = {
  packageName: string;
  packageVersion: string;
  installPath: string;
  additionalTypePackages: string;
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
      [
        `${job.data.packageName}@${job.data.packageVersion}`,
        job.data.additionalTypePackages,
      ].filter(Boolean),
      job.data.installPath,
      {
        client:
          (process.env.INSTALL_CLIENT as InstallPackageOptions["client"]) ||
          "npm",
      },
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
    useWorkerThreads: false,
    limiter: {
      max: 2,
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
    useWorkerThreads: false,
  },
);

export const appQueues = [installQueue, generateDocsQueue];
export const scheduledQueues = [cleanupCacheQueue];
export const allQueues = [...scheduledQueues, ...appQueues];
const workers = [installWorker, generateDocsWorker, cleanupCacheWorker];

async function shutdownWorkers(): Promise<void> {
  await Promise.all(workers.map((worker) => worker.close()));
  logger.warn("Shutdown all workers complete");
  process.exit(0);
}

async function handleSignal() {
  try {
    await shutdownWorkers();
    process.exit(0);
  } catch (err) {
    console.error("Error during shutdown", err);
    process.exit(1);
  }
}

process.on("SIGTERM", handleSignal);
process.on("SIGINT", handleSignal);
process.on("SIGUSR2", handleSignal);
process.on("SIGUSR1", handleSignal);
process.on("beforeExit", handleSignal);

const FINISHED_JOB_EXPIRY = 30 * 1000;
const FAILED_JOB_EXPIRY =
  process.env.NODE_ENV === "development" ? 1000 : 5 * 60 * 1000;
const UNFINISHED_JOB_EXPIRY = 2 * 60 * 1000;

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
      const finishedExpiryAgo = Date.now() - FINISHED_JOB_EXPIRY;
      if (job.finishedOn < finishedExpiryAgo) {
        logger.warn(`Removing finished job ${job.id} because its too old`);
        await job.remove();
      }
    }

    for (let job of failedJobs) {
      const failedExpiryAgo = Date.now() - FAILED_JOB_EXPIRY;
      if (job.finishedOn < failedExpiryAgo) {
        logger.warn(`Removing failed job ${job.id} because its too old`);
        await job.remove();
      }
    }

    for (let job of unfinishedJobs.filter(Boolean)) {
      const unfinishedExpiryAgo = Date.now() - UNFINISHED_JOB_EXPIRY;
      if (job.timestamp < unfinishedExpiryAgo) {
        logger.warn(
          `Removing ${await job.getState()} job ${job.id} because its too old`,
        );
        try {
          await job.remove();
        } catch (err) {
          logger.error(
            `Failed to remove ${await job.getState()} job ${job.id}`,
            err,
          );
        }
      }
    }
  }
}, 5000);
