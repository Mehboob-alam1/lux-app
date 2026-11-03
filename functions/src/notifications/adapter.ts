import { db } from '../firebase';
import { newId } from '../util/ids';
import { nowIso } from '../util/time';
import { logInfo, logError } from '../util/logger';

export type NotifyChannel = 'FCM' | 'SMS' | 'EMAIL';

export type NotifyInput = {
  userId: string;
  template: string;
  title: string;
  body: string;
  bookingId?: string;
  critical?: boolean;
  data?: Record<string, string>;
};

/**
 * Push primary via FCM when tokens exist; SMS/email fallback only if configured.
 * Never pretends delivery succeeded without an attempt log.
 */
export async function sendNotification(input: NotifyInput): Promise<{
  notificationId: string;
  attempts: { channel: NotifyChannel; status: string }[];
}> {
  const notificationId = newId('ntf');
  const now = nowIso();
  const attempts: { channel: NotifyChannel; status: string }[] = [];

  const tokens = await db
    .collection('device_tokens')
    .where('userId', '==', input.userId)
    .where('active', '==', true)
    .limit(10)
    .get();

  if (!tokens.empty) {
    // FCM send would use admin.messaging() when credentials present
    const hasCreds = Boolean(process.env.GCLOUD_PROJECT);
    const status = hasCreds ? 'QUEUED_FCM' : 'SKIPPED_NO_FCM_RUNTIME';
    attempts.push({ channel: 'FCM', status });
    for (const t of tokens.docs) {
      const attemptId = newId('nta');
      await db.collection('notification_attempts').doc(attemptId).set({
        attemptId,
        notificationId,
        channel: 'FCM',
        tokenId: t.id,
        status,
        createdAt: now,
      });
    }
  } else {
    attempts.push({ channel: 'FCM', status: 'NO_DEVICE_TOKEN' });
  }

  if (input.critical) {
    if (process.env.SMS_API_KEY && process.env.SMS_PROVIDER) {
      attempts.push({ channel: 'SMS', status: 'QUEUED' });
      await db.collection('notification_attempts').doc(newId('nta')).set({
        notificationId,
        channel: 'SMS',
        status: 'QUEUED',
        provider: process.env.SMS_PROVIDER,
        createdAt: now,
      });
    } else {
      attempts.push({ channel: 'SMS', status: 'SKIPPED_NOT_CONFIGURED' });
    }
    if (process.env.EMAIL_API_KEY && process.env.EMAIL_PROVIDER) {
      attempts.push({ channel: 'EMAIL', status: 'QUEUED' });
      await db.collection('notification_attempts').doc(newId('nta')).set({
        notificationId,
        channel: 'EMAIL',
        status: 'QUEUED',
        provider: process.env.EMAIL_PROVIDER,
        createdAt: now,
      });
    } else {
      attempts.push({ channel: 'EMAIL', status: 'SKIPPED_NOT_CONFIGURED' });
    }
  }

  await db.collection('notifications').doc(notificationId).set({
    notificationId,
    userId: input.userId,
    template: input.template,
    title: input.title,
    body: input.body,
    bookingId: input.bookingId ?? null,
    critical: Boolean(input.critical),
    attempts,
    createdAt: now,
  });

  logInfo('notification_recorded', {
    notificationId,
    template: input.template,
    attemptCount: attempts.length,
  });
  return { notificationId, attempts };
}

export async function notifyBookingEvent(input: {
  userId: string;
  bookingId: string;
  template: string;
  title: string;
  body: string;
  critical?: boolean;
}): Promise<void> {
  try {
    await sendNotification({
      userId: input.userId,
      bookingId: input.bookingId,
      template: input.template,
      title: input.title,
      body: input.body,
      critical: input.critical,
    });
  } catch (e) {
    logError('notification_failed', {
      bookingId: input.bookingId,
      template: input.template,
    });
  }
}
