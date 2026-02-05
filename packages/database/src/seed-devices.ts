import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { deviceDefinitions } from "./schema/devices";
import { createId } from "@paralleldrive/cuid2";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const db = drizzle(sql);

type Category = "computer" | "mobile" | "server" | "browser" | "smart_home" | "iot" | "cloud";

interface DeviceSeed {
  type: string;
  name: string;
  description: string;
  category: Category;
  platform?: string;
  icon: string | null;
  agentCommand?: string;
  capabilities: string[];
  requirements?: string[];
  isPremium?: boolean;
}

const deviceDefs: DeviceSeed[] = [
  // Computers
  {
    type: "macbook",
    name: "MacBook",
    description:
      "Control your MacBook Pro or MacBook Air. Execute commands, manage files, and automate tasks.",
    category: "computer",
    platform: "macOS",
    icon: "https://cdn.simpleicons.org/apple",
    agentCommand: "curl -sSL https://rubic.dev/install.sh | sh",
    capabilities: [
      "terminal",
      "file_management",
      "screenshot",
      "clipboard",
      "notifications",
      "browser_control",
    ],
    requirements: ["macOS 12+", "Node.js 18+"],
  },
  {
    type: "windows_pc",
    name: "Windows PC",
    description:
      "Control your Windows desktop or laptop. Run PowerShell, manage files, and automate workflows.",
    category: "computer",
    platform: "Windows",
    icon: "https://cdn.simpleicons.org/windows",
    agentCommand: "irm https://rubic.dev/install.ps1 | iex",
    capabilities: [
      "terminal",
      "powershell",
      "file_management",
      "screenshot",
      "clipboard",
      "notifications",
    ],
    requirements: ["Windows 10+", "Node.js 18+"],
  },
  {
    type: "linux_desktop",
    name: "Linux Desktop",
    description:
      "Control your Linux workstation. Full terminal access, file management, and automation.",
    category: "computer",
    platform: "Linux",
    icon: "https://cdn.simpleicons.org/linux",
    agentCommand: "curl -sSL https://rubic.dev/install.sh | sh",
    capabilities: ["terminal", "file_management", "screenshot", "clipboard", "x11_control"],
    requirements: ["Ubuntu 20.04+ / Fedora 35+", "Node.js 18+"],
  },
  {
    type: "imac",
    name: "iMac / Mac Desktop",
    description: "Control your iMac, Mac Mini, Mac Studio, or Mac Pro. Full macOS automation.",
    category: "computer",
    platform: "macOS",
    icon: "https://cdn.simpleicons.org/apple",
    agentCommand: "curl -sSL https://rubic.dev/install.sh | sh",
    capabilities: [
      "terminal",
      "file_management",
      "screenshot",
      "clipboard",
      "notifications",
      "browser_control",
    ],
    requirements: ["macOS 12+", "Node.js 18+"],
  },
  {
    type: "chromebook",
    name: "Chromebook",
    description:
      "Control your Chromebook via Linux container. Terminal access and Chrome automation.",
    category: "computer",
    platform: "ChromeOS",
    icon: "https://cdn.simpleicons.org/googlechrome",
    agentCommand: "curl -sSL https://rubic.dev/install.sh | sh",
    capabilities: ["terminal", "file_management", "browser_control"],
    requirements: ["ChromeOS with Linux (Crostini)", "Node.js 18+"],
  },

  // Mobile
  {
    type: "iphone",
    name: "iPhone",
    description:
      "Interact with your iPhone. Send messages, manage reminders, shortcuts automation.",
    category: "mobile",
    platform: "iOS",
    icon: "https://cdn.simpleicons.org/apple",
    capabilities: ["shortcuts", "notifications", "messages", "reminders", "homekit"],
    requirements: ["iOS 16+", "Shortcuts app"],
    isPremium: true,
  },
  {
    type: "ipad",
    name: "iPad",
    description: "Control your iPad. Run shortcuts, manage files, and automate workflows.",
    category: "mobile",
    platform: "iPadOS",
    icon: "https://cdn.simpleicons.org/apple",
    capabilities: ["shortcuts", "notifications", "files", "reminders"],
    requirements: ["iPadOS 16+", "Shortcuts app"],
    isPremium: true,
  },
  {
    type: "android_phone",
    name: "Android Phone",
    description:
      "Control your Android device. Automate tasks, manage notifications, and run Tasker actions.",
    category: "mobile",
    platform: "Android",
    icon: "https://cdn.simpleicons.org/android",
    capabilities: ["tasker", "notifications", "messages", "file_management"],
    requirements: ["Android 10+", "Tasker (optional)"],
    isPremium: true,
  },
  {
    type: "android_tablet",
    name: "Android Tablet",
    description:
      "Control your Android tablet. Full Tasker integration and automation capabilities.",
    category: "mobile",
    platform: "Android",
    icon: "https://cdn.simpleicons.org/android",
    capabilities: ["tasker", "notifications", "file_management"],
    requirements: ["Android 10+"],
    isPremium: true,
  },

  // Servers
  {
    type: "ubuntu_server",
    name: "Ubuntu Server",
    description:
      "Manage your Ubuntu server. SSH access, service management, deployments, and monitoring.",
    category: "server",
    platform: "Linux",
    icon: "https://cdn.simpleicons.org/ubuntu",
    agentCommand: "curl -sSL https://rubic.dev/install.sh | sh",
    capabilities: [
      "ssh",
      "terminal",
      "file_management",
      "service_management",
      "docker",
      "monitoring",
    ],
    requirements: ["Ubuntu 20.04+", "Node.js 18+"],
  },
  {
    type: "debian_server",
    name: "Debian Server",
    description:
      "Manage your Debian server. Full terminal access, package management, and monitoring.",
    category: "server",
    platform: "Linux",
    icon: "https://cdn.simpleicons.org/debian",
    agentCommand: "curl -sSL https://rubic.dev/install.sh | sh",
    capabilities: ["ssh", "terminal", "file_management", "service_management", "docker"],
    requirements: ["Debian 11+", "Node.js 18+"],
  },
  {
    type: "centos_server",
    name: "CentOS / RHEL Server",
    description: "Manage CentOS or Red Hat Enterprise Linux servers. Enterprise-grade automation.",
    category: "server",
    platform: "Linux",
    icon: "https://cdn.simpleicons.org/redhat",
    agentCommand: "curl -sSL https://rubic.dev/install.sh | sh",
    capabilities: ["ssh", "terminal", "file_management", "service_management", "docker"],
    requirements: ["CentOS 8+ / RHEL 8+", "Node.js 18+"],
  },
  {
    type: "raspberry_pi",
    name: "Raspberry Pi",
    description: "Control your Raspberry Pi. GPIO access, sensor data, and IoT automation.",
    category: "server",
    platform: "Linux",
    icon: "https://cdn.simpleicons.org/raspberrypi",
    agentCommand: "curl -sSL https://rubic.dev/install.sh | sh",
    capabilities: ["terminal", "gpio", "sensors", "file_management", "docker"],
    requirements: ["Raspberry Pi OS (64-bit)", "Node.js 18+"],
  },
  {
    type: "nas",
    name: "NAS (Synology / QNAP)",
    description:
      "Manage your network-attached storage. File management, Docker containers, and backups.",
    category: "server",
    platform: "Linux",
    icon: "https://cdn.simpleicons.org/synology",
    agentCommand: "curl -sSL https://rubic.dev/install.sh | sh",
    capabilities: ["file_management", "docker", "backup", "media_management"],
    requirements: ["Synology DSM 7+ / QNAP QTS 5+"],
    isPremium: true,
  },

  // Browsers
  {
    type: "chrome_browser",
    name: "Google Chrome",
    description:
      "Automate Chrome browser. Navigate pages, fill forms, extract data, and take screenshots.",
    category: "browser",
    platform: "Cross-platform",
    icon: "https://cdn.simpleicons.org/googlechrome",
    capabilities: [
      "navigate",
      "click",
      "type",
      "screenshot",
      "extract_data",
      "manage_tabs",
      "console",
    ],
  },
  {
    type: "firefox_browser",
    name: "Mozilla Firefox",
    description: "Automate Firefox browser. Web scraping, form filling, and browser automation.",
    category: "browser",
    platform: "Cross-platform",
    icon: "https://cdn.simpleicons.org/firefox",
    capabilities: ["navigate", "click", "type", "screenshot", "extract_data", "manage_tabs"],
  },
  {
    type: "safari_browser",
    name: "Safari",
    description: "Automate Safari on macOS. Web automation with native Apple integration.",
    category: "browser",
    platform: "macOS",
    icon: "https://cdn.simpleicons.org/safari",
    capabilities: ["navigate", "click", "type", "screenshot", "extract_data"],
  },
  {
    type: "edge_browser",
    name: "Microsoft Edge",
    description: "Automate Edge browser. Chromium-based automation with Microsoft integration.",
    category: "browser",
    platform: "Cross-platform",
    icon: "https://cdn.simpleicons.org/microsoftedge",
    capabilities: ["navigate", "click", "type", "screenshot", "extract_data", "manage_tabs"],
  },

  // Smart Home
  {
    type: "home_assistant",
    name: "Home Assistant",
    description:
      "Connect your Home Assistant hub. Control lights, climate, locks, and all smart home devices.",
    category: "smart_home",
    icon: "https://cdn.simpleicons.org/homeassistant",
    capabilities: [
      "lights",
      "climate",
      "locks",
      "switches",
      "scenes",
      "media_players",
      "sensors",
      "automations",
    ],
    requirements: ["Home Assistant 2024.1+", "Long-lived access token"],
  },
  {
    type: "google_home",
    name: "Google Home",
    description:
      "Control Google Home and Nest devices. Lights, thermostats, cameras, and routines.",
    category: "smart_home",
    icon: "https://cdn.simpleicons.org/googlehome",
    capabilities: ["lights", "climate", "cameras", "routines", "speakers"],
    requirements: ["Google Home account"],
    isPremium: true,
  },
  {
    type: "amazon_alexa",
    name: "Amazon Alexa",
    description:
      "Control Alexa-connected devices. Smart home control, routines, and voice commands.",
    category: "smart_home",
    icon: "https://cdn.simpleicons.org/amazonalexa",
    capabilities: ["lights", "climate", "routines", "speakers", "smart_plugs"],
    requirements: ["Amazon account with Alexa"],
    isPremium: true,
  },
  {
    type: "apple_homekit",
    name: "Apple HomeKit",
    description:
      "Control HomeKit-enabled devices through your Apple ecosystem. Siri-compatible automation.",
    category: "smart_home",
    icon: "https://cdn.simpleicons.org/apple",
    capabilities: ["lights", "climate", "locks", "sensors", "scenes"],
    requirements: ["Apple Home Hub (iPad/HomePod/Apple TV)"],
    isPremium: true,
  },
  {
    type: "philips_hue",
    name: "Philips Hue",
    description: "Direct control of Philips Hue lights. Color, brightness, scenes, and schedules.",
    category: "smart_home",
    icon: "https://cdn.simpleicons.org/philipshue",
    capabilities: ["lights", "scenes", "schedules", "rooms"],
    requirements: ["Hue Bridge v2"],
  },

  // Cloud
  {
    type: "aws_ec2",
    name: "AWS EC2 Instance",
    description: "Manage AWS EC2 instances. SSH access, deployments, and cloud infrastructure.",
    category: "cloud",
    platform: "Linux",
    icon: "https://cdn.simpleicons.org/amazonwebservices",
    agentCommand: "curl -sSL https://rubic.dev/install.sh | sh",
    capabilities: ["ssh", "terminal", "deployments", "docker", "monitoring"],
    requirements: ["AWS account", "EC2 instance", "Node.js 18+"],
  },
  {
    type: "gcp_compute",
    name: "Google Cloud VM",
    description: "Manage Google Cloud Compute instances. SSH, deployments, and GCP services.",
    category: "cloud",
    platform: "Linux",
    icon: "https://cdn.simpleicons.org/googlecloud",
    agentCommand: "curl -sSL https://rubic.dev/install.sh | sh",
    capabilities: ["ssh", "terminal", "deployments", "docker", "monitoring"],
    requirements: ["GCP account", "Compute Engine instance", "Node.js 18+"],
  },
  {
    type: "azure_vm",
    name: "Azure Virtual Machine",
    description: "Manage Azure VMs. SSH access, deployments, and Azure service integration.",
    category: "cloud",
    platform: "Linux",
    icon: "https://cdn.simpleicons.org/microsoftazure",
    agentCommand: "curl -sSL https://rubic.dev/install.sh | sh",
    capabilities: ["ssh", "terminal", "deployments", "docker", "monitoring"],
    requirements: ["Azure account", "VM instance", "Node.js 18+"],
  },
  {
    type: "digitalocean_droplet",
    name: "DigitalOcean Droplet",
    description: "Manage DigitalOcean Droplets. Simple cloud server management and deployments.",
    category: "cloud",
    platform: "Linux",
    icon: "https://cdn.simpleicons.org/digitalocean",
    agentCommand: "curl -sSL https://rubic.dev/install.sh | sh",
    capabilities: ["ssh", "terminal", "deployments", "docker", "monitoring"],
    requirements: ["DigitalOcean account", "Droplet", "Node.js 18+"],
  },
  {
    type: "docker_container",
    name: "Docker Container",
    description:
      "Manage Docker containers. Deploy, monitor, and control containerized applications.",
    category: "cloud",
    icon: "https://cdn.simpleicons.org/docker",
    capabilities: ["terminal", "container_management", "logs", "deployments"],
    requirements: ["Docker Engine 20+"],
  },

  // IoT
  {
    type: "arduino",
    name: "Arduino",
    description:
      "Connect and control Arduino boards. Read sensors, control actuators, and upload sketches.",
    category: "iot",
    icon: "https://cdn.simpleicons.org/arduino",
    capabilities: ["gpio", "sensors", "serial_communication", "sketch_upload"],
    requirements: ["Arduino board", "USB connection or WiFi module"],
  },
  {
    type: "esp32",
    name: "ESP32",
    description:
      "Control ESP32 microcontrollers. WiFi-connected IoT with sensor and actuator support.",
    category: "iot",
    icon: "https://cdn.simpleicons.org/espressif",
    capabilities: ["gpio", "sensors", "wifi", "bluetooth", "mqtt"],
    requirements: ["ESP32 board", "WiFi network"],
  },
];

async function seed() {
  console.log(`Seeding ${deviceDefs.length} device definitions...`);

  let count = 0;
  for (const d of deviceDefs) {
    try {
      await db
        .insert(deviceDefinitions)
        .values({
          id: createId(),
          type: d.type,
          name: d.name,
          description: d.description,
          icon: d.icon,
          category: d.category,
          platform: d.platform ?? null,
          agentCommand: d.agentCommand ?? null,
          capabilities: d.capabilities,
          requirements: d.requirements ?? null,
          isEnabled: true,
          isPremium: d.isPremium ?? false,
        })
        .onConflictDoUpdate({
          target: deviceDefinitions.type,
          set: {
            name: d.name,
            description: d.description,
            icon: d.icon,
            category: d.category,
            platform: d.platform ?? null,
            agentCommand: d.agentCommand ?? null,
            capabilities: d.capabilities,
            requirements: d.requirements ?? null,
            isPremium: d.isPremium ?? false,
            updatedAt: new Date(),
          },
        });
      count++;
    } catch (error) {
      console.error(`Failed to upsert ${d.type}:`, error);
    }
  }

  console.log(`Done! Seeded ${count} device definitions.`);
}

seed().catch(console.error);
