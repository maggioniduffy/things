import type { Database } from "./database.types";

export type { Database };

export type Item = Database["public"]["Tables"]["items"]["Row"];
export type Collection = Database["public"]["Tables"]["collections"]["Row"];
export type Tag = Database["public"]["Tables"]["tags"]["Row"];
export type SmartView = Database["public"]["Tables"]["smart_views"]["Row"];
export type ItemKind = Database["public"]["Enums"]["item_kind"];
