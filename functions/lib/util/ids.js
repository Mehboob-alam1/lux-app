"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newId = newId;
exports.hashToken = hashToken;
const crypto_1 = require("crypto");
function newId(prefix) {
    return `${prefix}_${(0, crypto_1.randomBytes)(12).toString('hex')}`;
}
function hashToken(raw) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createHash } = require('crypto');
    return createHash('sha256').update(raw).digest('hex');
}
//# sourceMappingURL=ids.js.map