import { createClient } from 'redis';

// Create Redis client from REDIS_URL
const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redis.on('connect', () => {
  console.log('Redis connected');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

// Connect to Redis
redis.connect().catch((err) => {
  console.error('Failed to connect to Redis:', err);
});

export { redis };
