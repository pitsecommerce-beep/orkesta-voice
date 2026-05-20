// Stricter rate limits for call initiation endpoints
export const callRateLimitConfig = {
  max: 10,
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({
    error: 'Too many call requests. Please wait before initiating more calls.',
    code: 'RATE_LIMIT_EXCEEDED',
  }),
};
