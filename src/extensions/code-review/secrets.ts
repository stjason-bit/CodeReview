const envSecretPatterns = [
  /(DATABASE_URL\s*=\s*)["']?[^"'\n]+["']?/gi,
  /((?:[A-Z0-9_]*(?:API|SECRET|TOKEN|KEY)[A-Z0-9_]*\s*=\s*))["']?[^"'\n]+["']?/gi,
];

const fullSecretPatterns = [
  /sk-[A-Za-z0-9_-]{8,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

export function redactSecrets(content: string): string {
  let redacted = content;

  for (const pattern of envSecretPatterns) {
    redacted = redacted.replace(pattern, '$1[REDACTED_SECRET]');
  }

  for (const pattern of fullSecretPatterns) {
    redacted = redacted.replace(pattern, '[REDACTED_SECRET]');
  }

  return redacted;
}
