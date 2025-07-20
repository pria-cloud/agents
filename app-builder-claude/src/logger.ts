import pino from 'pino';

export const logger = pino({
  name: 'e2b-sandbox',
  level: process.env.LOG_LEVEL || 'info',
});