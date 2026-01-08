import { signIn } from '../';
export const SignUp = () => (
  <form
    action={async () => {
      await signIn();
    }}
  >
    <button type="submit">Sign up</button>
  </form>
);