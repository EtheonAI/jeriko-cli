import { Body, Button, Container, Head, Html, Preview, Section, Tailwind, Text } from "react-email";

interface PasswordResetEmailProps {
  readonly userName?: string;
  readonly resetUrl: string;
}

export function PasswordResetEmail({ userName, resetUrl }: PasswordResetEmailProps) {
  return (
    <Tailwind>
      <Html>
        <Head />
        <Preview>Reset your password for Jeriko</Preview>
        <Body className="bg-neutral-50 font-sans">
          <Container className="mx-auto py-12 px-4">
            <Section className="rounded-lg bg-white p-8 shadow-sm">
              <Text className="mt-0 mb-6 text-2xl font-semibold text-neutral-900">
                Reset your password
              </Text>
              <Text className="mb-4 text-base text-neutral-600">Hi {userName || "there"},</Text>
              <Text className="mb-6 text-base text-neutral-600">
                We received a request to reset your password. Click the button below to choose a new
                password.
              </Text>
              <Section className="mb-6">
                <Button
                  href={resetUrl}
                  className="rounded-md bg-neutral-900 px-6 py-3 text-sm font-medium text-white"
                >
                  Reset Password
                </Button>
              </Section>
              <Text className="mt-8 text-sm text-neutral-400">
                This link will expire in 1 hour. If you didn&apos;t request a password reset, you
                can safely ignore this email.
              </Text>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}

PasswordResetEmail.PreviewProps = {
  userName: "John",
  resetUrl: "https://jeriko.app/reset-password?token=abc123",
} satisfies PasswordResetEmailProps;

export default PasswordResetEmail;
