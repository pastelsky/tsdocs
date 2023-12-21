const fs = require("fs").promises;
const child_process = require("child_process");
const checkDiskSpace = require("check-disk-space").default;
const path = require("path");
const glob = require("fast-glob");
const fastFolderSizeSync = require("fast-folder-size/sync");
const fsExtra = require("fs-extra");
const prettyBytes = require("pretty-bytes");

// Clean if disk space is less than this percentage
const CLEAN_THRESHOLD = 30;

const cacheLocations = [
  ...glob.sync(`${path.join("/tmp", "tmp-build")}/packages/*`, {
    onlyDirectories: true,
  }),
  ...glob.sync(`${path.join(__dirname, "..", "..", "docs-cache")}/*/*`, {
    onlyFiles: true,
  }),
  ...glob.sync(`${path.join(__dirname, "..", "..", "docs")}/*/*`, {
    onlyDirectories: true,
  }),
];

async function getFileOrDirInfo(dirPath) {
  const stats = await fs.stat(dirPath);
  let totalSize = stats.size;
  let lastAccessSecondsAgo =
    (new Date().getTime() - new Date(stats.atime).getTime()) / 60;

  if (stats.isDirectory()) {
    totalSize = fastFolderSizeSync(dirPath);
  }

  return {
    lastAccessSecondsAgo,
    totalSize,
  };
}

function getCurrentDisk() {
  const cwd = process.cwd();

  const disk = child_process.execSync(
    `df -P "${cwd}" | tail -1 | awk '{print $1}'`,
  );

  return disk.toString().trim();
}

async function getFreeDiskPercent() {
  const cwd = process.cwd();

  const { free, size } = await checkDiskSpace(getCurrentDisk());
  return (free / size) * 100;
}

async function shouldFreeSpace() {
  const freeSpace = await getFreeDiskPercent();
  return freeSpace < CLEAN_THRESHOLD;
}

async function cleanupSpaceWork(job) {
  let result = "";

  if (!(await shouldFreeSpace())) {
    result += `Cleanup space: Free disk space is greater than ${CLEAN_THRESHOLD}%, skipping.`;
    return result;
  }

  result += `Cleanup space: Free disk space is less than ${CLEAN_THRESHOLD}%, cleaning up`;
  const locationsToClean = await Promise.all(
    cacheLocations.map(async (location) => {
      return {
        location,
        ...(await getFileOrDirInfo(location)),
      };
    }),
  );

  const oldestCaches = locationsToClean.sort(
    (a, b) => a.lastAccessSecondsAgo - b.lastAccessSecondsAgo,
  );

  const removedDirs = [];
  let removedSize = 0;

  for (let oldest of oldestCaches) {
    try {
      await fsExtra.remove(oldest.location);

      removedDirs.push(oldest.location);
      removedSize += oldest.totalSize;
    } catch (err) {
      console.error(`Cleanup Space: Error removing ${oldest.location}`, err);
    }

    if (!(await shouldFreeSpace())) {
      break;
    }
  }

  result +=
    "Cleanup Space: Freed " +
    prettyBytes(removedSize) +
    " from " +
    JSON.stringify(removedDirs);

  if (await shouldFreeSpace()) {
    result +=
      "Cleanup Space: Still need to free space, cleaning up node modules cache";
    await fsExtra.remove(path.join("/tmp", "tmp-build", "cache"));
  }
  return result;
}

module.exports = async (job) => {
  return await cleanupSpaceWork(job);
};
