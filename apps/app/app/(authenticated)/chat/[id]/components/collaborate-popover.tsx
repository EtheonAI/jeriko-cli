"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Separator } from "@repo/design-system/components/ui/separator";
import { UsersIcon, CopyIcon, CheckIcon } from "lucide-react";
import { toast } from "sonner";

export interface Collaborator {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: "owner" | "editor" | "viewer";
}

interface CollaboratePopoverProps {
  sessionId: string;
  currentUser: {
    name?: string | null;
    email: string;
    image?: string | null;
  };
  collaborators?: Collaborator[];
  onInvite?: (email: string) => void;
}

export function CollaboratePopover({
  sessionId,
  currentUser,
  collaborators = [],
  onInvite,
}: CollaboratePopoverProps) {
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);

  const handleInvite = () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    onInvite?.(trimmed);
    setEmail("");
    toast.success(`Invitation sent to ${trimmed}`);
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/chat/${sessionId}?invite=true`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Invitation link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleInvite();
  };

  const initials = (name?: string | null, email?: string) => {
    if (name) return name.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return "?";
  };

  // Build full collaborator list with current user as owner
  const allCollaborators: Collaborator[] = [
    {
      id: "current",
      name: currentUser.name ?? currentUser.email.split("@")[0] ?? currentUser.email,
      email: currentUser.email,
      image: currentUser.image,
      role: "owner",
    },
    ...collaborators,
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <UsersIcon className="h-4 w-4" />
          Collaborate
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4">
          <h4 className="font-semibold text-sm mb-3">Collaborate</h4>

          {/* Email invite */}
          <div className="flex gap-2">
            <Input
              placeholder="Enter email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              className="text-sm h-8"
            />
            <Button size="sm" className="h-8 shrink-0" onClick={handleInvite}>
              Invite
            </Button>
          </div>
        </div>

        <Separator />

        {/* Collaborator list */}
        <div className="p-2 max-h-[200px] overflow-y-auto">
          {allCollaborators.map((collab) => (
            <div
              key={collab.id}
              className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/50"
            >
              <Avatar className="h-7 w-7">
                {collab.image && <AvatarImage src={collab.image} />}
                <AvatarFallback className="text-xs">
                  {initials(collab.name, collab.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{collab.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {collab.email}
                </p>
              </div>
              <span className="text-xs text-muted-foreground capitalize shrink-0">
                {collab.role}
              </span>
            </div>
          ))}
        </div>

        <Separator />

        {/* Footer note + copy link */}
        <div className="p-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Collaborators can message in this task, using your credits
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-xs"
            onClick={handleCopyLink}
          >
            {copied ? (
              <CheckIcon className="h-3.5 w-3.5" />
            ) : (
              <CopyIcon className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied!" : "Copy invitation link"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
