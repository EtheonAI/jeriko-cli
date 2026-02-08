import { faker } from "@faker-js/faker";

export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: faker.string.cuid2(),
    name: faker.person.fullName(),
    email: faker.internet.email(),
    image: faker.image.avatar(),
    emailVerified: true,
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    ...overrides,
  };
}

export type MockUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
};
