package models

import "time"

type DeviceType string

const (
	DeviceTypePC      DeviceType = "pc"
	DeviceTypeIoT     DeviceType = "iot"
	DeviceTypeMobile  DeviceType = "mobile"
	DeviceTypeBrowser DeviceType = "browser"
)

type DeviceStatus string

const (
	DeviceStatusOnline  DeviceStatus = "online"
	DeviceStatusOffline DeviceStatus = "offline"
	DeviceStatusBusy    DeviceStatus = "busy"
	DeviceStatusError   DeviceStatus = "error"
)

type DeviceCapability string

const (
	CapabilityTerminal   DeviceCapability = "terminal"
	CapabilityFilesystem DeviceCapability = "filesystem"
	CapabilityBrowser    DeviceCapability = "browser"
	CapabilityScreen     DeviceCapability = "screen"
	CapabilityAudio      DeviceCapability = "audio"
	CapabilityGPIO       DeviceCapability = "gpio"
	CapabilitySensor     DeviceCapability = "sensor"
	CapabilityActuator   DeviceCapability = "actuator"
)

type Device struct {
	ID           string             `json:"id"`
	UserID       string             `json:"userId"`
	Name         string             `json:"name"`
	Type         DeviceType         `json:"type"`
	Status       DeviceStatus       `json:"status"`
	Capabilities []DeviceCapability `json:"capabilities"`
	Platform     string             `json:"platform"`
	Version      string             `json:"version"`
	IPAddress    string             `json:"ipAddress,omitempty"`
	LastSeenAt   time.Time          `json:"lastSeenAt"`
	Metadata     map[string]any     `json:"metadata,omitempty"`
	CreatedAt    time.Time          `json:"createdAt"`
}

type DeviceCommand struct {
	ID        string         `json:"id"`
	DeviceID  string         `json:"deviceId"`
	UserID    string         `json:"userId"`
	Type      string         `json:"type"` // terminal, file_read, file_write, etc.
	Command   string         `json:"command"`
	Arguments map[string]any `json:"arguments,omitempty"`
	Status    string         `json:"status"` // pending, approved, executing, completed, failed
	Result    *CommandResult `json:"result,omitempty"`
	CreatedAt time.Time      `json:"createdAt"`
}

type CommandResult struct {
	Success  bool   `json:"success"`
	Output   string `json:"output,omitempty"`
	Error    string `json:"error,omitempty"`
	ExitCode int    `json:"exitCode,omitempty"`
}

type RegisterDeviceRequest struct {
	Name         string             `json:"name"`
	Type         DeviceType         `json:"type"`
	Capabilities []DeviceCapability `json:"capabilities"`
	Platform     string             `json:"platform"`
	Version      string             `json:"version"`
	Metadata     map[string]any     `json:"metadata,omitempty"`
}

type ExecuteCommandRequest struct {
	Type      string         `json:"type"`
	Command   string         `json:"command"`
	Arguments map[string]any `json:"arguments,omitempty"`
	Timeout   int            `json:"timeout,omitempty"` // seconds
}

type ToolExecutionRequest struct {
	ToolName  string         `json:"tool_name"`
	Arguments map[string]any `json:"arguments"`
	DeviceID  string         `json:"device_id"`
}

// Safety rules for command execution
var DangerousCommands = []string{
	"rm -rf /",
	"rm -rf /*",
	"mkfs",
	"dd if=/dev/zero",
	":(){:|:&};:",  // Fork bomb
	"chmod -R 777 /",
}

var RequiresApproval = []string{
	"rm",
	"sudo",
	"chmod",
	"chown",
	"kill",
	"reboot",
	"shutdown",
	"systemctl",
	"apt",
	"yum",
	"brew",
}

func (c *ExecuteCommandRequest) IsDangerous() bool {
	for _, dangerous := range DangerousCommands {
		if c.Command == dangerous {
			return true
		}
	}
	return false
}

func (c *ExecuteCommandRequest) RequiresApproval() bool {
	for _, cmd := range RequiresApproval {
		// Check if command starts with dangerous command
		if len(c.Command) >= len(cmd) && c.Command[:len(cmd)] == cmd {
			return true
		}
	}
	return false
}
