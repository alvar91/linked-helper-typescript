import { IExecutor } from "./Executor";
import ITask, { ActionType } from "./Task";

type TasksType = {
  [key in ActionType]: ITask[];
};

export default async function run(
  executor: IExecutor,
  queue: AsyncIterable<ITask>,
  maxThreads = 0
) {
  maxThreads = Math.max(0, maxThreads);
  //@ts-ignore
  const { q }: { q: ITask[] } = queue;

  const tasksType: TasksType = {
    init: [],
    prepare: [],
    work: [],
    finalize: [],
    cleanup: [],
  };

  for (const task of q) {
    for (const key of Object.keys(tasksType)) {
      if (task.action === key) tasksType[key].push(task);
    }
  }

  for (const action of Object.keys(tasksType)) {
    //@ts-ignore
    const tasks = tasksType[action] as ITask[];

    const runningTasks = new Set<ITask>();
    const completedTasks = new Set<ITask>();

    if (tasks.length === 0) return;

    while (completedTasks.size < tasks.length) {
      const freeThreads = maxThreads - runningTasks.size;

      for (const task of tasks) {
        if (!completedTasks.has(task) && freeThreads > 0) {
          runningTasks.add(task);
          executor.executeTask(task).then(() => {
            runningTasks.delete(task);
            completedTasks.add(task);
          });
        }
      }

      if (freeThreads === 0) {
        await Promise.race(runningTasks);
      }
    }

    return await Promise.all(completedTasks);
  }
}
