package mqtt

import (
	"encoding/json"
	"fmt"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/etheon/rubic/services/device/internal/config"
	"github.com/etheon/rubic/services/device/internal/models"
	"github.com/rs/zerolog/log"
)

type Client struct {
	client mqtt.Client
	cfg    *config.Config
}

func NewClient(cfg *config.Config) (*Client, error) {
	if cfg.MQTTBrokerURL == "" && cfg.AWSIoTEndpoint == "" {
		return nil, fmt.Errorf("MQTT broker URL not configured")
	}

	brokerURL := cfg.MQTTBrokerURL
	if brokerURL == "" {
		brokerURL = fmt.Sprintf("ssl://%s:8883", cfg.AWSIoTEndpoint)
	}

	opts := mqtt.NewClientOptions().
		AddBroker(brokerURL).
		SetClientID("rubic-device-service").
		SetCleanSession(true).
		SetAutoReconnect(true).
		SetOnConnectHandler(func(c mqtt.Client) {
			log.Info().Msg("Connected to MQTT broker")
		}).
		SetConnectionLostHandler(func(c mqtt.Client, err error) {
			log.Error().Err(err).Msg("MQTT connection lost")
		})

	client := mqtt.NewClient(opts)
	if token := client.Connect(); token.Wait() && token.Error() != nil {
		return nil, token.Error()
	}

	return &Client{
		client: client,
		cfg:    cfg,
	}, nil
}

func (c *Client) PublishCommand(deviceID string, command *models.DeviceCommand) error {
	topic := fmt.Sprintf("rubic/devices/%s/commands", deviceID)

	payload, err := json.Marshal(command)
	if err != nil {
		return err
	}

	token := c.client.Publish(topic, 1, false, payload)
	token.Wait()

	return token.Error()
}

func (c *Client) SubscribeToDevice(deviceID string, handler func([]byte)) error {
	topic := fmt.Sprintf("rubic/devices/%s/output", deviceID)

	token := c.client.Subscribe(topic, 1, func(client mqtt.Client, msg mqtt.Message) {
		handler(msg.Payload())
	})
	token.Wait()

	return token.Error()
}

func (c *Client) UnsubscribeFromDevice(deviceID string) error {
	topic := fmt.Sprintf("rubic/devices/%s/output", deviceID)
	token := c.client.Unsubscribe(topic)
	token.Wait()
	return token.Error()
}

func (c *Client) Disconnect() {
	c.client.Disconnect(250)
}
