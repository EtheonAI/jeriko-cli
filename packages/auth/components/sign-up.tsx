import { signIn } from '../';
export const SignUp = () => (
  <form
    action={async () => {
      "use server";
      await signIn();
    }}
  >
    <button type="submit">Sign up</button>
  </form>
);