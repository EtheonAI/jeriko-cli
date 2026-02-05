const DANGEROUS_COMMANDS = [
  "rm -rf /",
  "rm -rf /*",
  "mkfs",
  "dd if=/dev/zero",
  ":(){:|:&};:", // Fork bomb
  "chmod -R 777 /",
];

const REQUIRES_APPROVAL_PREFIXES = [
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
];

export function isDangerous(command: string): boolean {
  const trimmed = command.trim();
  return DANGEROUS_COMMANDS.some((d) => trimmed === d || trimmed.startsWith(d));
}

export function requiresApproval(command: string): boolean {
  const trimmed = command.trim();
  return REQUIRES_APPROVAL_PREFIXES.some(
    (prefix) => trimmed === prefix || trimmed.startsWith(prefix + " ")
  );
}

export function validateCommand(
  command: string,
  capabilities: string[] = []
): { allowed: boolean; reason?: string; requiresApproval?: boolean } {
  if (!command || command.trim().length === 0) {
    return { allowed: false, reason: "Command cannot be empty" };
  }

  if (isDangerous(command)) {
    return { allowed: false, reason: "Command is blocked for safety reasons" };
  }

  if (!capabilities.includes("terminal")) {
    return { allowed: false, reason: "Device does not have terminal capability" };
  }

  if (requiresApproval(command)) {
    return { allowed: true, requiresApproval: true };
  }

  return { allowed: true };
}
