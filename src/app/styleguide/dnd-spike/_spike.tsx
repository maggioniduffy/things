"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

export type SpikeMode = "off-during-drag" | "always" | "none";

const COUNT = 200;
const initial = Array.from({ length: COUNT }, (_, i) => i + 1);

function CardBody({ n }: { n: number }) {
  return (
    <div className="bg-surface border-line rounded-card flex h-40 flex-col gap-2 border p-4">
      <div className="bg-paper rounded-control h-10" />
      <p className="text-ink text-body font-semibold">Card {n}</p>
      <p className="text-ink-muted text-sm">Synthetic card body, two lines of placeholder text.</p>
    </div>
  );
}

function SortableCard({
  id,
  mode,
  anyDragging,
  reduced,
}: {
  id: number;
  mode: SpikeMode;
  anyDragging: boolean;
  reduced: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  // Outer motion.li owns Motion layout; inner div owns the dnd-kit transform.
  // They never write `transform` on the same element.
  let layout: false | "position" = false;
  if (!reduced) {
    if (mode === "always") layout = "position";
    else if (mode === "off-during-drag") layout = anyDragging ? false : "position";
  }

  return (
    <motion.li layout={layout} data-card={id} className="list-none">
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.3 : 1,
        }}
        className="rounded-card focus-visible:outline-focus cursor-grab touch-manipulation outline-offset-2"
      >
        <CardBody n={id} />
      </div>
    </motion.li>
  );
}

export function Spike({ mode }: { mode: SpikeMode }) {
  const [items, setItems] = useState(initial);
  const [activeId, setActiveId] = useState<number | null>(null);
  const reduced = useReducedMotion() ?? false;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragStart(e: DragStartEvent) {
    setActiveId(Number(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      setItems((prev) =>
        arrayMove(prev, prev.indexOf(Number(active.id)), prev.indexOf(Number(over.id))),
      );
    }
    setActiveId(null);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={items} strategy={rectSortingStrategy}>
        <ul
          data-testid="grid"
          className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 p-0"
        >
          {items.map((id) => (
            <SortableCard
              key={id}
              id={id}
              mode={mode}
              anyDragging={activeId !== null}
              reduced={reduced}
            />
          ))}
        </ul>
      </SortableContext>
      <DragOverlay>{activeId !== null ? <CardBody n={activeId} /> : null}</DragOverlay>
    </DndContext>
  );
}
