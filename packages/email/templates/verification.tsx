import { Body, Button, Container, Head, Html, Preview, Section, Tailwind, Text } from "react-email";

interface VerificationEmailProps {
  readonly userName?: string;
  readonly verificationUrl: string;
}

export function VerificationEmail({ userName, verificationUrl }: VerificationEmailProps) {
  return (
    <Tailwind>
      <Html>
        <Head />
        <Preview>Verify your email address for Jeriko</Preview>
        <Body className="bg-neutral-50 font-sans">
          <Container className="mx-auto py-12 px-4">
            <Section className="rounded-lg bg-white p-8 shadow-sm">
              <Text className="mt-0 mb-6 text-2xl font-semibold text-neutral-900">
                Verify your email address
              </Text>
              <Text className="mb-4 text-base text-neutral-600">Hi {userName || "there"},</Text>
              <Text className="mb-6 text-base text-neutral-600">
                Thanks for signing up for Jeriko. Please verify your email address by clicking the
                button below.
              </Text>
              <Section className="mb-6">
                <Button
                  href={verificationUrl}
                  className="rounded-md bg-neutral-900 px-6 py-3 text-sm font-medium text-white"
                >
                  Verify Email
                </Button>
              </Section>
              <Text className="mt-8 text-sm text-neutral-400">
                This link will expire in 10 minutes. If you didn&apos;t create an account, you can
                safely ignore this email.
              </Text>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}

VerificationEmail.PreviewProps = {
  userName: "John",
  verificationUrl: "https://jeriko.app/verify?token=abc123",
} satisfies VerificationEmailProps;

export default VerificationEmail;
