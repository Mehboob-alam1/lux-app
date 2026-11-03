"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logInfo = logInfo;
exports.logError = logError;
/** Structured logs — avoid PII (no phone/email/full names in message fields). */
function logInfo(event, fields = {}) {
    console.log(JSON.stringify({ level: 'info', event, ...fields, ts: new Date().toISOString() }));
}
function logError(event, fields = {}) {
    console.error(JSON.stringify({ level: 'error', event, ...fields, ts: new Date().toISOString() }));
}
//# sourceMappingURL=logger.js.map