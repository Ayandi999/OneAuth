import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const accessClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

accessClient.on('connect', () => {
    console.log('--- Access Redis Connected Successfully ---');
});

accessClient.on('error', (err) => {
    console.error('--- Access Redis Connection Error ---');
    console.error(err);
});

export default accessClient;
