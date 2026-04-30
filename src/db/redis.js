import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redisClient.on('connect', () => {
    console.log('--- Valkey/Redis Connected Successfully ---');
});

redisClient.on('error', (err) => {
    console.error('--- Valkey/Redis Connection Error ---');
    console.error(err);
});

export default redisClient;
