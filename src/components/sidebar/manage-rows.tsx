"use client";

import { FolderIcon, HashIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { collectionTarget, tagTarget } from "@/components/dnd/targets";
import { auroraColorVar } from "@/lib/collections/fields";
import { useCollectionActions } from "@/lib/collections/mutations";
import { useSmartViewActions } from "@/lib/smart-views/mutations";
import type { SidebarCollection, SidebarSmartView, SidebarTag } from "@/lib/sidebar/queries";
import { useTagManager } from "@/lib/tags/mutations";
import { cn } from "@/lib/utils";
import { viewHref } from "@/lib/views";
import { CollectionDialog } from "./collection-dialog";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { NavItem } from "./nav-item";
import { RowMenu } from "./row-menu";
import { SmartViewDialog } from "./smart-view-dialog";
import { useSortableRow } from "./sortable-rows";
import { TagRenameDialog } from "./tag-rename-dialog";

type RowProps = { onNavigate?: () => void };

/** A sortable row; the one being dragged floats above its neighbours. */
const ROW_CLASS = cn(
  "group/row rounded-control relative",
  "data-[dragging=true]:bg-surface data-[dragging=true]:shadow-card data-[dragging=true]:z-10",
);

/** A collection's emoji (or a folder) with a dot in its aurora color, when it has one. */
function CollectionIcon({ collection }: { collection: SidebarCollection }) {
  const color = auroraColorVar(collection.color);
  return (
    <span className="relative flex items-center justify-center">
      {collection.emoji ? <span>{collection.emoji}</span> : <FolderIcon />}
      {color ? (
        <span
          data-slot="collection-color"
          style={{ backgroundColor: color }}
          className="absolute -right-1 -bottom-1 size-2 rounded-full"
        />
      ) : null}
    </span>
  );
}

/** One collection link with its edit / delete menu. */
export function CollectionRow({
  collection,
  count,
  onNavigate,
}: RowProps & { collection: SidebarCollection; count?: number }) {
  const { remove } = useCollectionActions();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { setNodeRef, style, isDragging, handle } = useSortableRow(
    "collections",
    collection.id,
    `collection ${collection.name}`,
  );

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-dragging={isDragging ? "true" : undefined}
      className={ROW_CLASS}
    >
      <NavItem
        href={viewHref({ type: "collection", collectionId: collection.id })}
        icon={<CollectionIcon collection={collection} />}
        label={collection.name}
        count={count}
        onNavigate={onNavigate}
        hasMenu
        hasHandle
        drop={collectionTarget(collection.id, collection.name)}
      />
      {handle}
      <RowMenu
        name={collection.name}
        editLabel="Edit"
        onEdit={() => setEditing(true)}
        onDelete={() => setDeleting(true)}
      />
      <CollectionDialog open={editing} onOpenChange={setEditing} collection={collection} />
      <ConfirmDeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${collection.name}?`}
        description="Items in it move to Inbox."
        onConfirm={() => void remove(collection.id)}
      />
    </li>
  );
}

/** One tag link with its rename / delete menu. */
export function TagRow({ tag, onNavigate }: RowProps & { tag: SidebarTag }) {
  const { remove } = useTagManager();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <li className="group/row relative">
      <NavItem
        href={viewHref({ type: "tag", tagId: tag.id })}
        icon={<HashIcon />}
        label={`#${tag.name}`}
        onNavigate={onNavigate}
        hasMenu
        drop={tagTarget(tag.id, tag.name)}
      />
      <RowMenu
        name={`Tag ${tag.name}`}
        editLabel="Rename"
        onEdit={() => setRenaming(true)}
        onDelete={() => setDeleting(true)}
      />
      <TagRenameDialog tag={tag} open={renaming} onOpenChange={setRenaming} />
      <ConfirmDeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete #${tag.name}?`}
        description="Items keep everything else."
        onConfirm={() => void remove(tag.id)}
      />
    </li>
  );
}

/** One smart view link with its edit / delete menu. */
export function SmartViewRow({
  smartView,
  onNavigate,
}: RowProps & { smartView: SidebarSmartView }) {
  const { remove } = useSmartViewActions();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { setNodeRef, style, isDragging, handle } = useSortableRow(
    "smart-views",
    smartView.id,
    `smart view ${smartView.name}`,
  );

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-dragging={isDragging ? "true" : undefined}
      className={ROW_CLASS}
    >
      <NavItem
        href={viewHref({ type: "smart", viewId: smartView.id })}
        icon={smartView.icon ? <span>{smartView.icon}</span> : <SparklesIcon />}
        label={smartView.name}
        onNavigate={onNavigate}
        hasMenu
        hasHandle
      />
      {handle}
      <RowMenu
        name={smartView.name}
        editLabel="Edit"
        onEdit={() => setEditing(true)}
        onDelete={() => setDeleting(true)}
      />
      <SmartViewDialog open={editing} onOpenChange={setEditing} smartView={smartView} />
      <ConfirmDeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${smartView.name}?`}
        description="Only the saved filter goes away. Your items stay where they are."
        onConfirm={() => void remove(smartView.id)}
      />
    </li>
  );
}
