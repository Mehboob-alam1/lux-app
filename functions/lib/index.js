"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestBookingChange = exports.refundPayment = exports.submitDriverDocument = exports.setDriverOnline = exports.updateLostItemStatus = exports.reportLostItem = exports.updateSupportCaseStatus = exports.postSupportMessage = exports.convertSupportToDispute = exports.createSupportCase = exports.documentExpiryJob = exports.unassignedAgingJob = exports.staleLocationsJob = exports.expireQuotesJob = exports.resolveGuestLink = exports.createGuestLink = exports.updateDriverLocation = exports.registerDeviceToken = exports.postTripMessage = exports.tripLifecycle = exports.finalizeDocumentEligibility = exports.reviewDriverDocument = exports.reviewVehicle = exports.ensureDemoCatalog = exports.adminAssignBooking = exports.driverCancelAssignment = exports.acceptOffer = exports.confirmBooking = exports.authorizePayment = exports.createQuote = exports.updateMyProfile = exports.ensureAdminAccess = exports.bootstrapAdmin = exports.provisionUser = void 0;
const v2_1 = require("firebase-functions/v2");
// Keep CPU low so a full Gen2 rollout stays within Cloud Run regional quota.
(0, v2_1.setGlobalOptions)({
    region: 'us-central1',
    memory: '256MiB',
    cpu: 0.5,
    concurrency: 1,
    maxInstances: 20,
});
var provisionUser_1 = require("./auth/provisionUser");
Object.defineProperty(exports, "provisionUser", { enumerable: true, get: function () { return provisionUser_1.provisionUser; } });
Object.defineProperty(exports, "bootstrapAdmin", { enumerable: true, get: function () { return provisionUser_1.bootstrapAdmin; } });
var ensureAdminAccess_1 = require("./auth/ensureAdminAccess");
Object.defineProperty(exports, "ensureAdminAccess", { enumerable: true, get: function () { return ensureAdminAccess_1.ensureAdminAccess; } });
var updateMyProfile_1 = require("./auth/updateMyProfile");
Object.defineProperty(exports, "updateMyProfile", { enumerable: true, get: function () { return updateMyProfile_1.updateMyProfile; } });
var createQuote_1 = require("./quotes/createQuote");
Object.defineProperty(exports, "createQuote", { enumerable: true, get: function () { return createQuote_1.createQuote; } });
var authorizePayment_1 = require("./payments/authorizePayment");
Object.defineProperty(exports, "authorizePayment", { enumerable: true, get: function () { return authorizePayment_1.authorizePayment; } });
var confirmBooking_1 = require("./bookings/confirmBooking");
Object.defineProperty(exports, "confirmBooking", { enumerable: true, get: function () { return confirmBooking_1.confirmBooking; } });
var acceptOffer_1 = require("./dispatch/acceptOffer");
Object.defineProperty(exports, "acceptOffer", { enumerable: true, get: function () { return acceptOffer_1.acceptOffer; } });
var driverCancel_1 = require("./dispatch/driverCancel");
Object.defineProperty(exports, "driverCancelAssignment", { enumerable: true, get: function () { return driverCancel_1.driverCancelAssignment; } });
var assignBooking_1 = require("./admin/assignBooking");
Object.defineProperty(exports, "adminAssignBooking", { enumerable: true, get: function () { return assignBooking_1.adminAssignBooking; } });
var ensureDemoCatalog_1 = require("./admin/ensureDemoCatalog");
Object.defineProperty(exports, "ensureDemoCatalog", { enumerable: true, get: function () { return ensureDemoCatalog_1.ensureDemoCatalog; } });
var reviewVehicle_1 = require("./admin/reviewVehicle");
Object.defineProperty(exports, "reviewVehicle", { enumerable: true, get: function () { return reviewVehicle_1.reviewVehicle; } });
var reviewDocuments_1 = require("./admin/reviewDocuments");
Object.defineProperty(exports, "reviewDriverDocument", { enumerable: true, get: function () { return reviewDocuments_1.reviewDriverDocument; } });
Object.defineProperty(exports, "finalizeDocumentEligibility", { enumerable: true, get: function () { return reviewDocuments_1.finalizeDocumentEligibility; } });
var lifecycle_1 = require("./trips/lifecycle");
Object.defineProperty(exports, "tripLifecycle", { enumerable: true, get: function () { return lifecycle_1.tripLifecycle; } });
var postTripMessage_1 = require("./trips/postTripMessage");
Object.defineProperty(exports, "postTripMessage", { enumerable: true, get: function () { return postTripMessage_1.postTripMessage; } });
var registerDeviceToken_1 = require("./notifications/registerDeviceToken");
Object.defineProperty(exports, "registerDeviceToken", { enumerable: true, get: function () { return registerDeviceToken_1.registerDeviceToken; } });
var updateDriverLocation_1 = require("./locations/updateDriverLocation");
Object.defineProperty(exports, "updateDriverLocation", { enumerable: true, get: function () { return updateDriverLocation_1.updateDriverLocation; } });
var guestLink_1 = require("./guests/guestLink");
Object.defineProperty(exports, "createGuestLink", { enumerable: true, get: function () { return guestLink_1.createGuestLink; } });
Object.defineProperty(exports, "resolveGuestLink", { enumerable: true, get: function () { return guestLink_1.resolveGuestLink; } });
var scheduled_1 = require("./jobs/scheduled");
Object.defineProperty(exports, "expireQuotesJob", { enumerable: true, get: function () { return scheduled_1.expireQuotesJob; } });
Object.defineProperty(exports, "staleLocationsJob", { enumerable: true, get: function () { return scheduled_1.staleLocationsJob; } });
Object.defineProperty(exports, "unassignedAgingJob", { enumerable: true, get: function () { return scheduled_1.unassignedAgingJob; } });
Object.defineProperty(exports, "documentExpiryJob", { enumerable: true, get: function () { return scheduled_1.documentExpiryJob; } });
var createSupportCase_1 = require("./support/createSupportCase");
Object.defineProperty(exports, "createSupportCase", { enumerable: true, get: function () { return createSupportCase_1.createSupportCase; } });
Object.defineProperty(exports, "convertSupportToDispute", { enumerable: true, get: function () { return createSupportCase_1.convertSupportToDispute; } });
var postSupportMessage_1 = require("./support/postSupportMessage");
Object.defineProperty(exports, "postSupportMessage", { enumerable: true, get: function () { return postSupportMessage_1.postSupportMessage; } });
var updateSupportCaseStatus_1 = require("./support/updateSupportCaseStatus");
Object.defineProperty(exports, "updateSupportCaseStatus", { enumerable: true, get: function () { return updateSupportCaseStatus_1.updateSupportCaseStatus; } });
var lostItem_1 = require("./support/lostItem");
Object.defineProperty(exports, "reportLostItem", { enumerable: true, get: function () { return lostItem_1.reportLostItem; } });
Object.defineProperty(exports, "updateLostItemStatus", { enumerable: true, get: function () { return lostItem_1.updateLostItemStatus; } });
var setOnline_1 = require("./drivers/setOnline");
Object.defineProperty(exports, "setDriverOnline", { enumerable: true, get: function () { return setOnline_1.setDriverOnline; } });
var submitDriverDocument_1 = require("./drivers/submitDriverDocument");
Object.defineProperty(exports, "submitDriverDocument", { enumerable: true, get: function () { return submitDriverDocument_1.submitDriverDocument; } });
var refundPayment_1 = require("./payments/refundPayment");
Object.defineProperty(exports, "refundPayment", { enumerable: true, get: function () { return refundPayment_1.refundPayment; } });
var requoteChange_1 = require("./bookings/requoteChange");
Object.defineProperty(exports, "requestBookingChange", { enumerable: true, get: function () { return requoteChange_1.requestBookingChange; } });
//# sourceMappingURL=index.js.map