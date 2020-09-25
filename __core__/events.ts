enum Event {
    register = 'register',
    init = 'initialize',
    start = 'start',
    run = 'run',
    load = 'start',
    provide = 'provide',
    configure = 'configure',
    status = 'status',
    change = 'change',
    fileUnlink = 'file.unlink',
    fileChange = 'file.change',
    fileAdd = 'file.add',
    startWatchers = 'start.watchers',
}

export default Event;
