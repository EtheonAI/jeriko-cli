import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Icons } from "@/components/icons";

interface UserAvatarProps {
  user: {
    image: string | null;
    name: string | null;
  };
  className?: string;
}

export function UserAvatar({ user, className, ...props }: UserAvatarProps) {
  return (
    <Avatar className={className} {...props}>
      {user.image ? (
        <AvatarImage alt="Picture" src={user.image} />
      ) : (
        <AvatarFallback>
          <span className="sr-only">{user.name}</span>
          <Icons.user className="h-4 w-4" />
        </AvatarFallback>
      )}
    </Avatar>
  );
}
