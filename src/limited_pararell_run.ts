type Task = () => Promise<void>;

// 並列実行の最大数を絞って、タスクを並列実行
export default async function limitedPararellRun(
  tasks: ReadonlyArray<Task>,
  pararellMax: number,
): Promise<void> {
  let runCount = 0;

  const zeroToMax = [...Array(pararellMax).keys()];

  const runners = zeroToMax.map(async () => {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const task = tasks.at(runCount);
      runCount++;

      if (task === undefined) {
        break;
      }

      await task();
    }
  });

  await Promise.all(runners);
}
