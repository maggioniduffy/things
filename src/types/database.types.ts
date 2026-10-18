
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "collections": {
                  Row: {
                    "canvas_viewport": Json | null,"color": string | null,"created_at": string,"emoji": string | null,"id": string,"name": string,"position": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "canvas_viewport"?: Json | null,"color"?: string | null,"created_at"?: string,"emoji"?: string | null,"id"?: string,"name": string,"position": string,"user_id"?: string
                  }
                  Update: {
                    "canvas_viewport"?: Json | null,"color"?: string | null,"created_at"?: string,"emoji"?: string | null,"id"?: string,"name"?: string,"position"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"item_tags": {
                  Row: {
                    "item_id": string,"tag_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "item_id": string,"tag_id": string,"user_id"?: string
                  }
                  Update: {
                    "item_id"?: string,"tag_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "item_tags_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "item_tags_tag_id_fkey"
      columns: ["tag_id"]
isOneToOne: false
      referencedRelation: "tags"
      referencedColumns: ["id"]
    }
                  ]
                },"items": {
                  Row: {
                    "archived_at": string | null,"canvas_h": number | null,"canvas_w": number | null,"canvas_x": number | null,"canvas_y": number | null,"canvas_z": number,"collection_id": string | null,"color": string | null,"created_at": string,"deleted_at": string | null,"description": string | null,"domain": string | null,"enrich_status": string,"favicon_url": string | null,"file_name": string | null,"file_path": string | null,"file_size": number | null,"id": string,"image_url": string | null,"is_favorite": boolean,"is_read": boolean,"kind": Database["public"]['Enums']["item_kind"],"metadata": NonNullable<Json>,"mime_type": string | null,"note": string | null,"position": string,"search": unknown,"site_name": string | null,"thumbnail_path": string | null,"title": string | null,"updated_at": string,"url": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"canvas_h"?: number | null,"canvas_w"?: number | null,"canvas_x"?: number | null,"canvas_y"?: number | null,"canvas_z"?: number,"collection_id"?: string | null,"color"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"domain"?: string | null,"enrich_status"?: string,"favicon_url"?: string | null,"file_name"?: string | null,"file_path"?: string | null,"file_size"?: number | null,"id"?: string,"image_url"?: string | null,"is_favorite"?: boolean,"is_read"?: boolean,"kind": Database["public"]['Enums']["item_kind"],"metadata"?: NonNullable<Json>,"mime_type"?: string | null,"note"?: string | null,"position": string,"search"?: never,"site_name"?: string | null,"thumbnail_path"?: string | null,"title"?: string | null,"updated_at"?: string,"url"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"canvas_h"?: number | null,"canvas_w"?: number | null,"canvas_x"?: number | null,"canvas_y"?: number | null,"canvas_z"?: number,"collection_id"?: string | null,"color"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"domain"?: string | null,"enrich_status"?: string,"favicon_url"?: string | null,"file_name"?: string | null,"file_path"?: string | null,"file_size"?: number | null,"id"?: string,"image_url"?: string | null,"is_favorite"?: boolean,"is_read"?: boolean,"kind"?: Database["public"]['Enums']["item_kind"],"metadata"?: NonNullable<Json>,"mime_type"?: string | null,"note"?: string | null,"position"?: string,"search"?: never,"site_name"?: string | null,"thumbnail_path"?: string | null,"title"?: string | null,"updated_at"?: string,"url"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "items_collection_id_fkey"
      columns: ["collection_id"]
isOneToOne: false
      referencedRelation: "collections"
      referencedColumns: ["id"]
    }
                  ]
                },"smart_views": {
                  Row: {
                    "created_at": string,"icon": string | null,"id": string,"name": string,"position": string,"rules": NonNullable<Json>,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"icon"?: string | null,"id"?: string,"name": string,"position": string,"rules": NonNullable<Json>,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"icon"?: string | null,"id"?: string,"name"?: string,"position"?: string,"rules"?: NonNullable<Json>,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"tags": {
                  Row: {
                    "color": string | null,"created_at": string,"id": string,"name": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string | null,"created_at"?: string,"id"?: string,"name": string,"user_id"?: string
                  }
                  Update: {
                    "color"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"unfurl_log": {
                  Row: {
                    "created_at": string,"id": number,"url": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"url": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"url"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "item_counts": {
                  Row: {
                    "archived": boolean | null,"collection_id": string | null,"deleted": boolean | null,"is_favorite": boolean | null,"is_read": boolean | null,"kind": Database["public"]['Enums']["item_kind"] | null,"n": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "items_collection_id_fkey"
      columns: ["collection_id"]
isOneToOne: false
      referencedRelation: "collections"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "f_unaccent":
{ Args: { "": string }; Returns: string
                           },
"save_canvas_layout":
{ Args: { "layout": Json }; Returns: undefined
                           }
          }
          Enums: {
            "item_kind": "link"|"article"|"video"|"image"|"pdf"|"document"|"note"|"audio"|"code"|"other"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "item_kind": ["link", "article", "video", "image", "pdf", "document", "note", "audio", "code", "other"]
          }
        }
} as const
