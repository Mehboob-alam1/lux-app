"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DOC_LABELS = exports.REQUIRED_DOC_TYPES = void 0;
exports.buildPendingDocumentRows = buildPendingDocumentRows;
const ids_1 = require("../util/ids");
exports.REQUIRED_DOC_TYPES = [
    'LICENCE',
    'INSURANCE',
    'VEHICLE_REGISTRATION',
    'INSPECTION_CERTIFICATE',
];
exports.DOC_LABELS = {
    LICENCE: 'Chauffeur licence',
    INSURANCE: 'Commercial insurance',
    VEHICLE_REGISTRATION: 'Vehicle registration',
    INSPECTION_CERTIFICATE: 'Safety inspection certificate',
};
function buildPendingDocumentRows(input) {
    return exports.REQUIRED_DOC_TYPES.map((type) => {
        const id = (0, ids_1.newId)('ddoc');
        return {
            id,
            data: {
                documentId: id,
                driverId: input.driverId,
                vehicleId: input.vehicleId,
                type,
                label: exports.DOC_LABELS[type],
                status: 'PENDING',
                required: true,
                storagePath: null,
                contentType: null,
                fileName: null,
                uploadedAt: null,
                reviewNotes: null,
                reviewedBy: null,
                reviewedAt: null,
                createdAt: input.now,
                updatedAt: input.now,
            },
        };
    });
}
//# sourceMappingURL=documentChecklist.js.map