import { db, admin } from '../firebase';
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
 * Push via real FCM when device tokens exist. Always writes attempt ledger.
 */
export async function sendNotification(input: NotifyInput): Promise<{
  notificationId: string;
  attempts: { channel: NotifyChannel; status: string }[];
}> {
  const notificationId = newId('ntf');
  const now = nowIso();
  const attempts: { channel: NotifyChannel; status: string }[] = [];

  const data: Record<string, string> = {
    template: input.template,
    ...(input.bookingId ? { bookingId: input.bookingId } : {}),
    ...(input.data ?? {}),
  };

  const tokens = await db
    .collection('device_tokens')
    .where('userId', '==', input.userId)
    .where('active', '==', true)
    .limit(10)
    .get();

  if (!tokens.empty) {
    const tokenList = tokens.docs
      .map((d) => String(d.data().token ?? ''))
      .filter((t) => t.length > 10);

    if (tokenList.length === 0) {
      attempts.push({ channel: 'FCM', status: 'NO_DEVICE_TOKEN' });
    } else {
      try {
        const res = await admin.messaging().sendEachForMulticast({
          tokens: tokenList,
          notification: {
            title: input.title,
            body: input.body,
          },
          data,
          android: {
            priority: 'high',
            notification: {
              clickAction: 'FLUTTER_NOTIFICATION_CLICK',
              sound: 'default',
            },
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                contentAvailable: true,
              },
            },
          },
        });

        for (let i = 0; i < tokens.docs.length; i++) {
          const doc = tokens.docs[i];
          const raw = String(doc.data().token ?? '');
          const idx = tokenList.indexOf(raw);
          const ok = idx >= 0 ? res.responses[idx]?.success === true : false;
          const errCode =
            idx >= 0
              ? String(
                  (res.responses[idx]?.error as { code?: string } | undefined)
                    ?.code ?? '',
                )
              : '';
          const status = ok
            ? 'SENT'
            : errCode.includes('registration-token-not-registered') ||
                errCode.includes('invalid-registration-token')
              ? 'INVALID_TOKEN'
              : 'FAILED';

          if (status === 'INVALID_TOKEN') {
            await doc.ref.set(
              { active: false, updatedAt: now, deactivatedReason: errCode },
              { merge: true },
            );
          }

          const attemptId = newId('nta');
          await db.collection('notification_attempts').doc(attemptId).set({
            attemptId,
            notificationId,
            channel: 'FCM',
            tokenId: doc.id,
            status,
            errorCode: errCode || null,
            createdAt: now,
          });
          attempts.push({ channel: 'FCM', status });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        attempts.push({ channel: 'FCM', status: 'SEND_ERROR' });
        await db.collection('notification_attempts').doc(newId('nta')).set({
          notificationId,
          channel: 'FCM',
          status: 'SEND_ERROR',
          error: msg.slice(0, 400),
          createdAt: now,
        });
        logError('fcm_send_error', { notificationId, error: msg });
      }
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
    data,
    critical: Boolean(input.critical),
    attempts,
    createdAt: now,
  });

  logInfo('notification_recorded', {
    notificationId,
    template: input.template,
    attemptCount: attempts.length,
    sent: attempts.filter((a) => a.status === 'SENT').length,
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
  data?: Record<string, string>;
}): Promise<void> {
  try {
    await sendNotification({
      userId: input.userId,
      bookingId: input.bookingId,
      template: input.template,
      title: input.title,
      body: input.body,
      critical: input.critical,
      data: input.data,
    });
  } catch (e) {
    logError('notification_failed', {
      bookingId: input.bookingId,
      template: input.template,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
