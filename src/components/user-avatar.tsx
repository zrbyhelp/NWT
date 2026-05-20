"use client";

/* eslint-disable @next/next/no-img-element */

import { UserRound } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function UserAvatar({
  avatarUrl,
  className,
  name
}: {
  avatarUrl?: string | null;
  className?: string;
  name?: string | null;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initial = (name?.trim()[0] ?? "").toUpperCase();
  const shouldShowImage = Boolean(avatarUrl && failedUrl !== avatarUrl);

  return (
    <span
      className={cn(
        "relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/12 text-sm font-semibold text-primary",
        className
      )}
    >
      {avatarUrl && shouldShowImage ? (
        // Use a plain img so animated GIF/WebP avatars keep animating.
        <img
          src={avatarUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailedUrl(avatarUrl)}
        />
      ) : initial ? (
        initial
      ) : (
        <UserRound className="h-4 w-4" aria-hidden="true" />
      )}
    </span>
  );
}
