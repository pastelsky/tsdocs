require("esbuild-register/dist/node").register();
require("../init-sentry");

const {
  generateDocsForPackage,
} = require("../package/extractor/doc-generator");
const logger = require("../../common/logger");

let workerActiveTime = Date.now();

setInterval(() => {
  if (Date.now() - workerActiveTime > 1000 * 60 * 5) {
    console.log(
      "Worker remained idle for too long without doing much...",
      process.pid,
      " alive for ",
      process.uptime(),
      "s. Without work for ",
      Date.now() - workerActiveTime,
      "s",
    );
  }
}, 5000);

function promiseTimeout(promise, timeout) {
  const timeoutPromise = new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(
        new Error(
          `PROMISE_TIMEOUT: Promise timed out after ${timeout} seconds`,
        ),
      );
    }, timeout);
  });

  return Promise.race([timeoutPromise, timeout]);
}

module.exports = async (job) => {
  try {
    workerActiveTime = Date.now();
    const results = await promiseTimeout(
      generateDocsForPackage(job.data.packageJSON, {
        force: job.data.force,
      }),
      120,
    );
    return results;
  } catch (err) {
    const isWorkerTimeout = err.message.includes("PROMISE_TIMEOUT");

    const errorCode = isWorkerTimeout ? "DOCS_BUILD_TIMEOUT" : err.message;

    job.updateData({
      ...job.data,
      originalError: {
        code: errorCode,
        stacktrace: err?.originalError?.stack,
        message: err?.originalError?.message,
      },
    });
    throw err;
  }
};
