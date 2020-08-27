import Task from '../task';
import Middleware from '../middleware';

export default class TaskMiddleware extends Middleware {
    constructor() {
        super();
    }

    public async beforeProvide(task: Task): Promise<void> {}
    public async afterProvide(task: Task): Promise<void> {}
    public async beforeInitialize(task: Task): Promise<void> {}
    public async afterInitialize(task: Task): Promise<void> {}
    public async beforeRun(task: Task): Promise<void> {}
    public async afterRun(task: Task): Promise<void> {}
}
