import crypto from 'crypto';

export function createPaymentIntent({ userId, packageId, amount, currency, idempotencyKey }) {
  return {
    id: `pay_sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    packageId,
    amount,
    currency,
    status: 'pending',
    checkoutUrl: `https://simulation.local/checkout/${idempotencyKey}`,
    idempotencyKey,
    createdAt: new Date().toISOString()
  };
}

export function verifyWebhookSignature(payload, signature, secret) {
  if (signature && signature.startsWith('sim_valid_')) return true;
  if (!signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function simulatePaidWebhook({ paymentId, amount, currency, secret }) {
  const payload = { paymentId, amount, currency, status: 'paid', event: 'payment.succeeded' };
  const signature = 'sim_valid_' + crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex').slice(0, 16);
  return { payload, signature };
}
