import * as Raven from 'raven';

export const sentryConfig = (sentryURL: string): boolean => {
  const sentryOn = !!sentryURL;
  console.log('[sentry]', sentryOn ? 'on' : 'off');

  process.on('unhandledRejection', e => {
    console.error(e);
    if (sentryOn) Raven.captureException(e);
  });

  if (sentryOn) {
    Raven.config(sentryURL).install();
  }

  return sentryOn;
};
