import axios, { AxiosResponse } from "axios";
import {
  PackageNotFoundError,
  PackageVersionMismatchError,
  TypeDefinitionResolveError,
} from "../../server/package/CustomError";

type TriggerAPIResponse =
  | {
      status: "success";
    }
  | {
      status: "queued";
      jobId: string;
      pollInterval: number;
    };

type PollAPIResponse =
  | {
      status: "success" | "queued";
    }
  | {
      status: "failed";
      errorCode: string;
      errorMessage: string;
    };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const POLL_TIMEOUT = 60000;

type PackageDocsResponse =
  | {
      status: "success";
    }
  | {
      status: "failure";
      errorCode: string;
      errorMessage: string;
    };

async function pollQueue(
  {
    jobId,
    pollInterval,
  }: {
    jobId: string;
    pollInterval: number;
  },
  timeElapsed = 0,
): Promise<PackageDocsResponse> {
  if (timeElapsed > POLL_TIMEOUT) {
    return {
      status: "failure",
      errorCode: "DOCS_TIMEOUT",
      errorMessage: "Building docs took longer than expected",
    };
  }

  const start = Date.now();

  let pollResponse: AxiosResponse<PollAPIResponse> = null;

  try {
    pollResponse = await axios.get(`/api/docs/poll/${jobId}`);
  } catch (err) {
    let errorMessage = "";
    if (err.response) {
      if (err.response.status === 404) {
        errorMessage =
          "Building docs for this package failed, because the job to build the docs was removed from queue.";
      } else {
        errorMessage = `${err.response.status} ${
          err.response.data ? JSON.stringify(err.response.data) : ""
        }`;
      }
    }

    return {
      status: "failure",
      errorCode: "UNEXPECTED_DOCS_POLL_FAILURE",
      errorMessage: errorMessage,
    };
  }

  const status = pollResponse.data.status;

  if (status === "success") {
    return { status: "success" };
  }

  if (status === "queued") {
    await sleep(pollInterval);
    return pollQueue({ jobId, pollInterval }, timeElapsed + Date.now() - start);
  }

  if (status === "failed") {
    return {
      status: "failure",
      errorCode: pollResponse.data.errorCode,
      errorMessage: getErrorMessage({
        name: pollResponse.data.errorCode,
        extra: pollResponse.data.errorMessage,
      }),
    };
  }

  return {
    status: "failure",
    errorCode: "UNEXPECTED_DOCS_POLL_STATUS",
    errorMessage:
      "Failed because the polling API returned an unknown status: " + status,
  };
}

export function getErrorMessage(error: { name: string; extra: any }) {
  switch (error.name) {
    case PackageNotFoundError.name:
      return "This package could not be found on the npm registry. Did you get the name right?";

    case PackageVersionMismatchError.name:
      return `The given version for this package was not found on the npm registry.\n Found versions: \n${error.extra.join(
        ", ",
      )}`;

    case TypeDefinitionResolveError.name:
      return (
        "Failed to resolve types for this package. " +
        "This package likely does not ship with types, and it does not have a corresponding package `@types` package " +
        "from which reference documentation for its APIs can be built."
      );
    default:
      return "";
  }
}

export async function getPackageDocs(
  pkg: string,
  { force }: { force: boolean },
): Promise<PackageDocsResponse> {
  let triggerResponse: AxiosResponse<TriggerAPIResponse> = null;
  const withForce = force ? "?force=true" : "";

  try {
    triggerResponse = await axios.post(`/api/docs/trigger/${pkg}${withForce}`);
  } catch (err) {
    let errorMessage = "";
    if (err.response?.data) {
      return {
        status: "failure",
        errorCode: err.response.data.name,
        errorMessage: getErrorMessage(err.response.data),
      };
    }

    return {
      status: "failure",
      errorCode: "UNEXPECTED_DOCS_TRIGGER_FAILURE",
      errorMessage: errorMessage,
    };
  }

  let triggerResult = triggerResponse.data;
  const { status } = triggerResult;

  if (status === "success") {
    return {
      status: "success",
    };
  }

  if (status === "queued") {
    return await pollQueue({
      jobId: triggerResult.jobId,
      pollInterval: triggerResult.pollInterval,
    });
  }

  return {
    status: "failure",
    errorCode: "UNEXPECTED_DOCS_TRIGGER_STATUS",
    errorMessage:
      "Failed because the polling API returned an unknown status: " + status,
  };
}
