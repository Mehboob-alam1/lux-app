import { setGlobalOptions } from 'firebase-functions/v2';

// Keep CPU low so a full Gen2 rollout stays within Cloud Run regional quota.
setGlobalOptions({
  region: 'us-central1',
  memory: '256MiB',
  cpu: 0.5,
  concurrency: 1,
  maxInstances: 20,
});

export { provisionUser, bootstrapAdmin } from './auth/provisionUser';
export { ensureAdminAccess } from './auth/ensureAdminAccess';
export { updateMyProfile } from './auth/updateMyProfile';
export { createQuote } from './quotes/createQuote';
export { authorizePayment } from './payments/authorizePayment';
export { confirmBooking } from './bookings/confirmBooking';
export { acceptOffer } from './dispatch/acceptOffer';
export { driverCancelAssignment } from './dispatch/driverCancel';
export { adminAssignBooking } from './admin/assignBooking';
export { ensureDemoCatalog } from './admin/ensureDemoCatalog';
export { reviewVehicle } from './admin/reviewVehicle';
export {
  reviewDriverDocument,
  finalizeDocumentEligibility,
} from './admin/reviewDocuments';
export { tripLifecycle } from './trips/lifecycle';
export { updateDriverLocation } from './locations/updateDriverLocation';
export { createGuestLink, resolveGuestLink } from './guests/guestLink';
export {
  expireQuotesJob,
  staleLocationsJob,
  unassignedAgingJob,
  documentExpiryJob,
} from './jobs/scheduled';
export {
  createSupportCase,
  convertSupportToDispute,
} from './support/createSupportCase';
export { reportLostItem, updateLostItemStatus } from './support/lostItem';
export { setDriverOnline } from './drivers/setOnline';
export { submitDriverDocument } from './drivers/submitDriverDocument';
export { refundPayment } from './payments/refundPayment';
export { requestBookingChange } from './bookings/requoteChange';

