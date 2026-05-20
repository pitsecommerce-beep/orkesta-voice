import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function initiateCall(params: {
  to: string;
  from?: string;
  callbackUrl: string;
  statusCallbackUrl: string;
}): Promise<{ callSid: string }> {
  const call = await client.calls.create({
    to: params.to,
    from: params.from || process.env.TWILIO_PHONE_NUMBER!,
    url: params.callbackUrl, // TwiML that sets up Media Stream
    statusCallback: params.statusCallbackUrl,
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    statusCallbackMethod: 'POST',
    machineDetection: 'DetectMessageEnd',
    asyncAmdStatusCallback: params.statusCallbackUrl,
    timeout: 30,
  });

  return { callSid: call.sid };
}

export function generateMediaStreamTwiML(websocketUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${websocketUrl}">
      <Parameter name="encoding" value="mulaw"/>
      <Parameter name="sampleRate" value="8000"/>
    </Stream>
  </Connect>
</Response>`;
}

export async function endCall(callSid: string): Promise<void> {
  await client.calls(callSid).update({ status: 'completed' });
}

export async function getRecordingUrl(callSid: string): Promise<string | null> {
  const recordings = await client.recordings.list({ callSid, limit: 1 });
  if (!recordings.length) return null;
  return `https://api.twilio.com${recordings[0].uri.replace('.json', '.mp3')}`;
}

export { client as twilioClient };
