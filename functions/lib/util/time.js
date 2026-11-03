"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nowIso = nowIso;
exports.addMinutesIso = addMinutesIso;
exports.isExpired = isExpired;
function nowIso() {
    return new Date().toISOString();
}
function addMinutesIso(minutes, from = new Date()) {
    return new Date(from.getTime() + minutes * 60_000).toISOString();
}
function isExpired(expiresAt, now = new Date()) {
    const t = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
    return t.getTime() <= now.getTime();
}
//# sourceMappingURL=time.js.map