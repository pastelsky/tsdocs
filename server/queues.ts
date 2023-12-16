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

export const queues = [installQueue, generateDocsQueue];
const workers = [installWorker, generateDocsWorker];

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
  for (let queue of queues) {
    const failedJobs = await queue.getFailed();
    for (const job of failedJobs) {
      if (job.finishedOn < Date.now() - 10000) {
        console.log("Removing all failed jobs");
        await job.remove();
      }
    }
  }
}, 1000);

setInterval(async () => {
  queues.forEach(async (queue) => {
    const jobs = await queue.getJobs(["active", "wait", "waiting", "delayed"]);

    for (let job of jobs) {
      // Older than 2 minutes
      if (job.timestamp < Date.now() - 2 * 60 * 1000) {
        console.log("Removing job because its too old", job.id);
        await job.remove();
      }
    }
  });
}, 5000);
