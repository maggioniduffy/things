"use client";

import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type RowMenuProps = {
  /** What the row is, for the trigger's accessible name: "Reading list" -> "Reading list options". */
  name: string;
  editLabel: string;
  onEdit: () => void;
  onDelete: () => void;
};

/**
 * The "..." menu of a collection or tag row. It sits over the row's right edge: hidden until the
 * row is hovered or focused (always there on small screens, where there is no hover).
 */
export function RowMenu({ name, editLabel, onEdit, onDelete }: RowMenuProps) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <IconButton
          variant="ghost"
          size="sm"
          label={`${name} options`}
          tooltip={false}
          className={cn(
            "bg-accent absolute top-1/2 right-1 size-7 -translate-y-1/2",
            "opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 data-[state=open]:opacity-100",
            "max-md:opacity-100",
          )}
        >
          <MoreHorizontalIcon className="size-4" />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <PencilIcon />
          {editLabel}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2Icon />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
