import { newId } from '../util/ids';

export const REQUIRED_DOC_TYPES = [
  'LICENCE',
  'INSURANCE',
  'VEHICLE_REGISTRATION',
  'INSPECTION_CERTIFICATE',
] as const;

export type RequiredDocType = (typeof REQUIRED_DOC_TYPES)[number];

export const DOC_LABELS: Record<RequiredDocType, string> = {
  LICENCE: 'Chauffeur licence',
  INSURANCE: 'Commercial insurance',
  VEHICLE_REGISTRATION: 'Vehicle registration',
  INSPECTION_CERTIFICATE: 'Safety inspection certificate',
};

export function buildPendingDocumentRows(input: {
  driverId: string;
  vehicleId: string;
  now: string;
}): Array<{ id: string; data: Record<string, unknown> }> {
  return REQUIRED_DOC_TYPES.map((type) => {
    const id = newId('ddoc');
    return {
      id,
      data: {
        documentId: id,
        driverId: input.driverId,
        vehicleId: input.vehicleId,
        type,
        label: DOC_LABELS[type],
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
