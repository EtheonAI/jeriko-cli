import { signIn } from '../';
export const SignIn = () => (
  <form
    action={async () => {
      "use server";
      await signIn();
    }}
  >
    <button type="submit">Sign in</button>
  </form>
);