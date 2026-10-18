import { ItemCard } from "@/components/cards/item-card";
import type { CardVariant } from "@/components/cards/types";
import type { BoardItem } from "@/lib/items/queries";
import type { ItemKind } from "@/types/supabase";
import { NOTE_COLORS, NOTE_COLOR_STYLES } from "@/lib/items/note-colors";
import { Group, Section } from "./section";

type State = "pending" | "done" | "failed";

const STATES: { state: State; title: string }[] = [
  { state: "pending", title: "Pending" },
  { state: "done", title: "Done" },
  { state: "failed", title: "Failed" },
];

/** Local brand art stands in for a fetched preview image, so the styleguide needs no network. */
const DEMO_IMAGE = "/brand/og-brand.png";
const DEMO_ICON = "/brand/icon-192.png";

/** Pending demos never go stale (a real pending item turns into "failed" after two minutes). */
const NEVER_STALE = "2999-01-01T00:00:00Z";

type Demo = { kind: ItemKind; patch: Partial<BoardItem>; image?: boolean };

const DEMOS: Demo[] = [
  {
    kind: "link",
    image: true,
    patch: {
      title: "Designing calm interfaces",
      url: "https://example.com/calm",
      domain: "example.com",
      site_name: "Example Journal",
      favicon_url: DEMO_ICON,
      is_read: true,
    },
  },
  {
    kind: "article",
    image: true,
    patch: {
      title: "What we learned shipping a save-for-later app",
      url: "https://blog.example.com/lessons",
      domain: "blog.example.com",
      site_name: "Example Blog",
      favicon_url: DEMO_ICON,
      is_favorite: true,
    },
  },
  {
    kind: "video",
    image: true,
    patch: {
      title: "A short talk on slow software",
      url: "https://video.example.com/watch?v=1",
      domain: "video.example.com",
      site_name: "Example Video",
    },
  },
  {
    kind: "image",
    image: true,
    patch: { title: "Harbour at dusk.jpg", file_path: "demo/harbour.jpg" },
  },
  {
    kind: "pdf",
    image: true,
    patch: {
      title: "Field notes on typography",
      file_name: "typography.pdf",
      file_path: "demo/typography.pdf",
      file_size: 2_400_000,
      is_read: true,
    },
  },
  {
    kind: "note",
    patch: {
      title: null,
      note: "Ideas for the weekend:\nFix the bike light, call Sam about the trip, and finally read the long essay everyone keeps sharing. Pick up flour on the way home.",
    },
  },
  {
    kind: "document",
    patch: {
      title: null,
      file_name: "Budget 2026.xlsx",
      file_path: "demo/budget.xlsx",
      file_size: 48_200,
      is_favorite: true,
    },
  },
  {
    kind: "code",
    patch: {
      title: null,
      file_name: "snippet.ts",
      file_path: "demo/snippet.ts",
      file_size: 912,
      is_read: true,
    },
  },
];

function demoItems(state: State): { item: BoardItem; thumbnailUrl: string | null }[] {
  return DEMOS.map(({ kind, patch, image }, index) => {
    const base: BoardItem = {
      archived_at: null,
      canvas_h: null,
      canvas_w: null,
      canvas_x: null,
      canvas_y: null,
      canvas_z: 0,
      collection_id: null,
      color: null,
      created_at: "2026-01-01T00:00:00Z",
      deleted_at: null,
      description: null,
      domain: null,
      enrich_status: state,
      favicon_url: null,
      file_name: null,
      file_path: null,
      file_size: null,
      id: `demo-${state}-${index}`,
      image_url: null,
      is_favorite: false,
      is_read: false,
      kind,
      metadata: {},
      mime_type: null,
      note: null,
      position: "a0",
      site_name: null,
      thumbnail_path: null,
      title: null,
      updated_at: state === "pending" ? NEVER_STALE : "2026-01-01T00:00:00Z",
      url: null,
      user_id: "00000000-0000-4000-8000-000000000001",
      ...patch,
    };
    // A pending or failed capture has no details yet: only the bare url/file name remains.
    const item: BoardItem =
      state === "done"
        ? base
        : { ...base, title: null, site_name: null, favicon_url: null, domain: null };
    return { item, thumbnailUrl: state === "done" && image ? DEMO_IMAGE : null };
  });
}

function CardList({ state, variant }: { state: State; variant: CardVariant }) {
  const entries = demoItems(state);
  return (
    <ul
      aria-label={`${variant === "grid" ? "Grid" : "List"} cards, ${state}`}
      className={
        variant === "grid"
          ? "grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4"
          : "border-line border-t"
      }
    >
      {entries.map(({ item, thumbnailUrl }) => (
        <ItemCard key={item.id} item={item} variant={variant} thumbnailUrl={thumbnailUrl} />
      ))}
    </ul>
  );
}

/** One note per color (and the default), so every surface and its ink can be checked. */
function NoteColors() {
  const colors = [null, ...NOTE_COLORS];
  return (
    <ul
      aria-label="Note colors"
      className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4"
    >
      {colors.map((color, index) => (
        <ItemCard
          key={color ?? "default"}
          variant="grid"
          thumbnailUrl={null}
          item={{
            ...demoItems("done").find(({ item }) => item.kind === "note")!.item,
            id: `demo-note-color-${index}`,
            color,
            title: color ? NOTE_COLOR_STYLES[color].label : "Default",
            note: "Pick up flour on the way home.",
            is_favorite: color === "graphite",
          }}
        />
      ))}
    </ul>
  );
}

export function CardsSection() {
  return (
    <Section
      id="cards"
      title="Cards"
      description="Every item kind as a grid card and a list row, in each capture state. Hover a grid card to see the lift."
    >
      {STATES.map(({ state, title }) => (
        <div key={state} className="flex flex-col gap-8">
          <Group title={`${title}: grid`} className="block">
            <CardList state={state} variant="grid" />
          </Group>
          <Group title={`${title}: list`} className="block">
            <CardList state={state} variant="list" />
          </Group>
        </div>
      ))}
      <Group title="Note colors" className="block">
        <NoteColors />
      </Group>
    </Section>
  );
}
