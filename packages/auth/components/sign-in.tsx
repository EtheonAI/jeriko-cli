import { signIn } from '../';
export const SignIn = () => (
  <form
    action={async () => {
      await signIn();
    }}
  >
    <button type="submit">Sign in</button>
  </form>
);