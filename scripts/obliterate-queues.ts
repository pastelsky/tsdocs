import { allQueues } from "../server/queues";

(() =>
  Promise.all(
    allQueues.map((queue) => {
      return queue.obliterate({ force: true });
    }),
  ))();
