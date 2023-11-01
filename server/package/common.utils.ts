import childProcess from "child_process";
import os from "os";

const homeDirectory = os.homedir();

export function exec(command: string, options: any, timeout?: number) {
  let timerId: NodeJS.Timeout;
  return new Promise((resolve, reject) => {
    const child = childProcess.exec(
      command,
      options,
      (error, stdout, stderr) => {
        if (error) {
          reject(stderr);
        } else {
          resolve(stdout);
        }

        if (timerId) {
          clearTimeout(timerId);
        }
      },
    );

    if (timeout) {
      timerId = setTimeout(() => {
        process.kill(child.pid);
        reject(
          `Execution of ${command.substring(
            0,
            40,
          )}... cancelled as it exceeded a timeout of ${timeout} ms`,
        );
      }, timeout);
    }
  });
}
