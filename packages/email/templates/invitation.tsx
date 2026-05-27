import { Body, Button, Container, Head, Html, Preview, Section, Tailwind, Text } from "react-email";

interface InvitationEmailProps {
  readonly inviterName: string;
  readonly organizationName: string;
  readonly role: string;
  readonly inviteUrl: string;
}

export function InvitationEmail({
  inviterName,
  organizationName,
  role,
  inviteUrl,
}: InvitationEmailProps) {
  return (
    <Tailwind>
      <Html>
        <Head />
        <Preview>You&apos;ve been invited to join {organizationName} on Jeriko</Preview>
        <Body className="bg-neutral-50 font-sans">
          <Container className="mx-auto py-12 px-4">
            <Section className="rounded-lg bg-white p-8 shadow-sm">
              <Text className="mt-0 mb-6 text-2xl font-semibold text-neutral-900">
                You&apos;ve been invited to join {organizationName}
              </Text>
              <Text className="mb-6 text-base text-neutral-600">
                <strong>{inviterName}</strong> has invited you to join{" "}
                <strong>{organizationName}</strong> as a <strong>{role}</strong>.
              </Text>
              <Section className="mb-6">
                <Button
                  href={inviteUrl}
                  className="rounded-md bg-neutral-900 px-6 py-3 text-sm font-medium text-white"
                >
                  Accept Invitation
                </Button>
              </Section>
              <Text className="mt-8 text-sm text-neutral-400">
                This invitation will expire in 7 days. If you don&apos;t want to join, you can
                safely ignore this email.
              </Text>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}

InvitationEmail.PreviewProps = {
  inviterName: "Jane Smith",
  organizationName: "Acme Inc",
  role: "member",
  inviteUrl: "https://jeriko.app/accept-invitation/abc123",
} satisfies InvitationEmailProps;

export default InvitationEmail;
