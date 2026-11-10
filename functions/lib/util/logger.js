"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logInfo = logInfo;
exports.logWarn = logWarn;
exports.logError = logError;
exports.timed = timed;
/** Structured logs — avoid PII (no phone/email/full names in message fields). */
function emit(level, event, fields) {
    const line = JSON.stringify({
        level,
        app: 'functions',
        event,
        ...fields,
        ts: new Date().toISOString(),
    });
    if (level === 'error')
        console.error(line);
    else if (level === 'warn')
        console.warn(line);
    else
        console.log(line);
}
function logInfo(event, fields = {}) {
    emit('info', event, fields);
}
function logWarn(event, fields = {}) {
    emit('warn', event, fields);
}
function logError(event, fields = {}) {
    emit('error', event, fields);
}
async function timed(event, run, fields = {}) {
    const started = Date.now();
    logInfo(`${event}_start`, fields);
    try {
        const result = await run();
        logInfo(`${event}_ok`, { ...fields, ms: Date.now() - started });
        return result;
    }
    catch (e) {
        logError(`${event}_fail`, {
            ...fields,
            ms: Date.now() - started,
            error: e instanceof Error ? e.message : String(e),
        });
        throw e;
    }
}
//# sourceMappingURL=logger.js.map