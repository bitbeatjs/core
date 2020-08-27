import TaskMiddleware from './middlewares/taskMiddleware';
import BaseStructure from './baseStructure';
import { ScheduleOptions } from 'node-cron';

export default class Task extends BaseStructure {
    /**
     * Add middlewares to the task.
     */
    public middlewares: Set<TaskMiddleware> = new Set<TaskMiddleware>();
    /**
     * Set the schedule for the task in cron format.
     */
    public schedule = '';
    /**
     * Set a specific timezone, default is empty.
     */
    public timezone: ScheduleOptions['timezone'];
    /**
     * Set a limit to repeat the task, default is infinite.
     */
    public limit = -1;
    /**
     * Set to true, if the task should run initially. Useful when using cron patterns which run after some hours first.
     * Care when using this, the limit will increase on 1. Which means limit 1 and setting it to true will run it initially and run the task later once.
     */
    public runInitially = false;

    constructor() {
        super();
    }

    /**
     * The function to be run when the task is called.
     * Its similar to an action, but its called by the framework itself.
     */
    public async run(): Promise<void> {}
}
