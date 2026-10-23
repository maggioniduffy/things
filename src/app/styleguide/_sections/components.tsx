import {
  ArrowRightIcon,
  BoldIcon,
  PlusIcon,
  SettingsIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CommandDemo,
  ContextMenuDemo,
  DialogDemo,
  DrawerDemo,
  EmptyStateDemo,
  DropdownDemo,
  ResponsiveDialogDemo,
  SearchDemo,
  ToastDemo,
} from "./demos";
import { Caption, Group, Section } from "./section";

const BUTTON_VARIANTS = ["primary", "secondary", "ghost", "destructive"] as const;
const BUTTON_SIZES = ["sm", "md", "lg"] as const;
const TONES: BadgeTone[] = ["neutral", "pink", "violet", "blue", "red", "coral", "olive"];

export function ComponentsSection() {
  return (
    <Section
      id="components"
      title="Components"
      description="Every primitive in every variant, size and state."
    >
      <Group title="Button" className="block">
        <div className="flex flex-col gap-4">
          {BUTTON_VARIANTS.map((variant) => (
            <div key={variant} className="flex flex-wrap items-center gap-3">
              <span className="text-meta text-ink-subtle w-24">{variant}</span>
              {BUTTON_SIZES.map((size) => (
                <Button key={size} variant={variant} size={size}>
                  Button {size}
                </Button>
              ))}
              <Button variant={variant} disabled>
                Disabled
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-meta text-ink-subtle w-24">with icon</span>
            <Button>
              <PlusIcon /> Add
            </Button>
            <Button variant="secondary">
              Continue <ArrowRightIcon />
            </Button>
            <Button asChild variant="secondary">
              <a href="#components">As a link (asChild)</a>
            </Button>
          </div>
        </div>
      </Group>

      <Group title="IconButton">
        {(["outline", "ghost"] as const).map((variant) => (
          <div key={variant} className="flex items-center gap-2">
            <IconButton variant={variant} label={`Settings (${variant}, md)`}>
              <SettingsIcon />
            </IconButton>
            <IconButton variant={variant} size="sm" label={`Favorite (${variant}, sm)`}>
              <StarIcon />
            </IconButton>
            <IconButton variant={variant} label={`Delete (${variant}, disabled)`} disabled>
              <Trash2Icon />
            </IconButton>
            <Caption>{variant}</Caption>
          </div>
        ))}
      </Group>

      <Group title="Input" className="items-start">
        <div className="grid w-full max-w-sm gap-3">
          <Input aria-label="Default input" placeholder="Default" />
          <Input aria-label="Disabled input" placeholder="Disabled" disabled />
          <Input aria-label="Invalid input" defaultValue="Not a URL" aria-invalid="true" />
        </div>
      </Group>

      <Group title="SearchField" className="block">
        <SearchDemo />
      </Group>

      <Group title="Badge">
        {TONES.map((tone) => (
          <Badge key={tone} tone={tone}>
            {tone}
          </Badge>
        ))}
      </Group>

      <Group title="Kbd">
        <Kbd>/</Kbd>
        <Kbd keys={["⌘", "K"]} />
        <Kbd keys={["Shift", "Enter"]} />
      </Group>

      <Group title="Tooltip">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="secondary">Hover or focus me</Button>
          </TooltipTrigger>
          <TooltipContent>Tooltip content</TooltipContent>
        </Tooltip>
        <IconButton label="Bold">
          <BoldIcon />
        </IconButton>
      </Group>

      <Group title="DropdownMenu">
        <DropdownDemo />
      </Group>

      <Group title="ContextMenu" className="block">
        <ContextMenuDemo />
      </Group>

      <Group title="Dialog">
        <DialogDemo />
      </Group>

      <Group title="Responsive dialog">
        <ResponsiveDialogDemo />
      </Group>

      <Group title="Empty state" className="block">
        <EmptyStateDemo />
      </Group>

      <Group title="Drawer">
        <DrawerDemo />
      </Group>

      <Group title="Command (inline)" className="block">
        <CommandDemo />
      </Group>

      <Group title="Skeleton" className="block">
        <div className="grid max-w-sm gap-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </Group>

      <Group title="Separator" className="block">
        <div className="flex max-w-sm flex-col gap-3">
          <Separator />
          <div className="flex h-6 items-center gap-3">
            <span className="text-body">Left</span>
            <Separator orientation="vertical" />
            <span className="text-body">Right</span>
          </div>
        </div>
      </Group>

      <Group title="Toast">
        <ToastDemo />
      </Group>
    </Section>
  );
}
