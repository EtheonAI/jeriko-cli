interface RedisConfig {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
}
declare function getRedisConfig(): RedisConfig;
declare function getRedisClient(): any;
declare function getRedisPubClient(): any;
declare function getRedisSubClient(): any;
declare function cacheGet<T>(key: string): Promise<T | null>;
declare function cacheSet<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
declare function cacheDel(key: string): Promise<void>;
declare function publish(channel: string, message: unknown): Promise<void>;
declare function subscribe(channel: string, callback: (message: unknown) => void): void;
declare function closeRedis(): Promise<void>;

export { type RedisConfig, cacheDel, cacheGet, cacheSet, closeRedis, getRedisClient, getRedisConfig, getRedisPubClient, getRedisSubClient, publish, subscribe };
