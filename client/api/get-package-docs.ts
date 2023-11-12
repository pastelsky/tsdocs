import axios, { AxiosResponse } from "axios";

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
      failureReason: string;
    };

export async function getPackageDocs(pkg: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const triggerResponse: AxiosResponse<TriggerAPIResponse> = await axios.post(
      `/api/docs/trigger/${pkg}`,
    );

    let triggerResult = triggerResponse.data;
    const { status } = triggerResult;

    if (triggerResult.status === "success") {
      resolve();
      return;
    }

    if (triggerResult.status === "queued") {
      const queuedTriggerResult = triggerResult;

      const checkStatus = async () => {
        const pollResponse: AxiosResponse<TriggerAPIResponse> = await axios.get(
          `/api/docs/poll/${queuedTriggerResult.jobId}`,
        );

        const status = pollResponse.data.status;

        return status === "success";
      };

      // Otherwise, start polling every second
      const pollInterval = setInterval(async () => {
        const pollResponse: AxiosResponse<PollAPIResponse> = await axios.get(
          `/api/docs/poll/${queuedTriggerResult.jobId}`,
        );

        const status = pollResponse.data.status;

        if (status === "failed") {
          clearInterval(pollInterval);
          reject(pollResponse.data.failureReason);
        }

        if (status === "success") {
          clearInterval(pollInterval);
          resolve();
        }

        if (status !== "queued") {
          clearInterval(pollInterval);
          reject("Failed because the polling API returned an unknown status");
        }
      }, queuedTriggerResult.pollInterval);

      setTimeout(() => {
        console.log("Polling timed out");
        clearInterval(pollInterval);
        reject();
      }, 45000); // 45 seconds
    }
  });
}
