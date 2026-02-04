package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Environment string
	Port        int

	// Redis
	RedisHost     string
	RedisPort     int
	RedisPassword string

	// Database
	DatabaseURL string

	// AWS IoT
	AWSIoTEndpoint    string
	AWSAccessKeyID    string
	AWSSecretKey      string
	AWSRegion         string

	// MQTT
	MQTTBrokerURL string
}

func Load() *Config {
	return &Config{
		Environment:       getEnv("ENVIRONMENT", "development"),
		Port:              getEnvInt("PORT", 8080),
		RedisHost:         getEnv("REDIS_HOST", "localhost"),
		RedisPort:         getEnvInt("REDIS_PORT", 6379),
		RedisPassword:     getEnv("REDIS_PASSWORD", ""),
		DatabaseURL:       getEnv("DATABASE_URL", "postgresql://rubic:rubic@localhost:5432/rubic"),
		AWSIoTEndpoint:    getEnv("AWS_IOT_ENDPOINT", ""),
		AWSAccessKeyID:    getEnv("AWS_ACCESS_KEY_ID", ""),
		AWSSecretKey:      getEnv("AWS_SECRET_ACCESS_KEY", ""),
		AWSRegion:         getEnv("AWS_REGION", "us-east-1"),
		MQTTBrokerURL:     getEnv("MQTT_BROKER_URL", ""),
	}
}

func (c *Config) PortStr() string {
	return fmt.Sprintf("%d", c.Port)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}
