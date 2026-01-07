import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

type Navigation = ReturnType<typeof createNavigation>;
type Redirect = Navigation['redirect'];

const navigation: Navigation = createNavigation(routing);

export const {
    Link,
    usePathname,
    useRouter,
    getPathname
} = navigation;

export const redirect: Redirect = navigation.redirect;
