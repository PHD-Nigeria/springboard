export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: Database["public"]["Enums"]["audit_entity_type"]
          id: string
          metadata: Json
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: Database["public"]["Enums"]["audit_entity_type"]
          id?: string
          metadata?: Json
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: Database["public"]["Enums"]["audit_entity_type"]
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      authors: {
        Row: {
          avatar_media_id: string | null
          bio: string | null
          created_at: string
          id: string
          name: string
          slug: string
          title: string | null
          updated_at: string
        }
        Insert: {
          avatar_media_id?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          name: string
          slug: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          avatar_media_id?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          name?: string
          slug?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "authors_avatar_media_id_fkey"
            columns: ["avatar_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      content: {
        Row: {
          author_id: string | null
          body: Json
          category_id: string | null
          content_type: Database["public"]["Enums"]["content_type"]
          cover_media_id: string | null
          created_at: string
          created_by: string | null
          display_order: number
          id: string
          metadata: Json
          publication_id: string | null
          publish_at: string | null
          published_at: string | null
          search_vector: unknown
          section_id: string | null
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          subtitle: string | null
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body?: Json
          category_id?: string | null
          content_type: Database["public"]["Enums"]["content_type"]
          cover_media_id?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          metadata?: Json
          publication_id?: string | null
          publish_at?: string | null
          published_at?: string | null
          search_vector?: unknown
          section_id?: string | null
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          subtitle?: string | null
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: Json
          category_id?: string | null
          content_type?: Database["public"]["Enums"]["content_type"]
          cover_media_id?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          metadata?: Json
          publication_id?: string | null
          publish_at?: string | null
          published_at?: string | null
          search_vector?: unknown
          section_id?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          subtitle?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_cover_media_id_fkey"
            columns: ["cover_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      content_revisions: {
        Row: {
          content_id: string
          created_at: string
          editor_id: string | null
          id: string
          revision_number: number
          snapshot: Json
        }
        Insert: {
          content_id: string
          created_at?: string
          editor_id?: string | null
          id?: string
          revision_number: number
          snapshot: Json
        }
        Update: {
          content_id?: string
          created_at?: string
          editor_id?: string | null
          id?: string
          revision_number?: number
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "content_revisions_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_revisions_editor_id_fkey"
            columns: ["editor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_staff: {
        Row: {
          content_id: string
          role: string | null
          staff_id: string
        }
        Insert: {
          content_id: string
          role?: string | null
          staff_id: string
        }
        Update: {
          content_id?: string
          role?: string | null
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_staff_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_staff_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      content_tags: {
        Row: {
          content_id: string
          tag_id: string
        }
        Insert: {
          content_id: string
          tag_id: string
        }
        Update: {
          content_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_tags_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          alt_text: string | null
          bucket: Database["public"]["Enums"]["media_bucket"]
          caption: string | null
          content_id: string | null
          created_at: string
          display_order: number
          file_size_bytes: number | null
          height: number | null
          id: string
          mime_type: string | null
          original_filename: string | null
          storage_path: string
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          bucket?: Database["public"]["Enums"]["media_bucket"]
          caption?: string | null
          content_id?: string | null
          created_at?: string
          display_order?: number
          file_size_bytes?: number | null
          height?: number | null
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          storage_path: string
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          bucket?: Database["public"]["Enums"]["media_bucket"]
          caption?: string | null
          content_id?: string | null
          created_at?: string
          display_order?: number
          file_size_bytes?: number | null
          height?: number | null
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          storage_path?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      publications: {
        Row: {
          cover_media_id: string | null
          created_at: string
          id: string
          publish_at: string | null
          published_at: string | null
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          cover_media_id?: string | null
          created_at?: string
          id?: string
          publish_at?: string | null
          published_at?: string | null
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          cover_media_id?: string | null
          created_at?: string
          id?: string
          publish_at?: string | null
          published_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "publications_cover_media_id_fkey"
            columns: ["cover_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          created_at: string
          display_order: number
          id: string
          publication_id: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          publication_id: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          publication_id?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          banner_description: string | null
          banner_title: string | null
          default_publication_id: string | null
          favicon_media_id: string | null
          featured_author_ids: string[] | null
          featured_content_id: string | null
          homepage_artwork_media_id: string | null
          id: boolean
          logo_phd_media_id: string | null
          logo_springboard_media_id: string | null
          og_image_media_id: string | null
          seo_default_description: string | null
          site_title: string | null
          updated_at: string
        }
        Insert: {
          banner_description?: string | null
          banner_title?: string | null
          default_publication_id?: string | null
          favicon_media_id?: string | null
          featured_author_ids?: string[] | null
          featured_content_id?: string | null
          homepage_artwork_media_id?: string | null
          id?: boolean
          logo_phd_media_id?: string | null
          logo_springboard_media_id?: string | null
          og_image_media_id?: string | null
          seo_default_description?: string | null
          site_title?: string | null
          updated_at?: string
        }
        Update: {
          banner_description?: string | null
          banner_title?: string | null
          default_publication_id?: string | null
          favicon_media_id?: string | null
          featured_author_ids?: string[] | null
          featured_content_id?: string | null
          homepage_artwork_media_id?: string | null
          id?: boolean
          logo_phd_media_id?: string | null
          logo_springboard_media_id?: string | null
          og_image_media_id?: string | null
          seo_default_description?: string | null
          site_title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_settings_default_publication_id_fkey"
            columns: ["default_publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_settings_favicon_media_id_fkey"
            columns: ["favicon_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_settings_featured_content_id_fkey"
            columns: ["featured_content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_settings_homepage_artwork_media_id_fkey"
            columns: ["homepage_artwork_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_settings_logo_phd_media_id_fkey"
            columns: ["logo_phd_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_settings_logo_springboard_media_id_fkey"
            columns: ["logo_springboard_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_settings_og_image_media_id_fkey"
            columns: ["og_image_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      spotlight_questions: {
        Row: {
          answer: string
          display_order: number
          id: string
          question: string
          spotlight_id: string
        }
        Insert: {
          answer: string
          display_order?: number
          id?: string
          question: string
          spotlight_id: string
        }
        Update: {
          answer?: string
          display_order?: number
          id?: string
          question?: string
          spotlight_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spotlight_questions_spotlight_id_fkey"
            columns: ["spotlight_id"]
            isOneToOne: false
            referencedRelation: "staff_spotlights"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          bio: string | null
          created_at: string
          department: string | null
          full_name: string
          id: string
          is_active: boolean
          photo_media_id: string | null
          slug: string
          title: string | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          department?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          photo_media_id?: string | null
          slug: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          department?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          photo_media_id?: string | null
          slug?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_photo_media_id_fkey"
            columns: ["photo_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_spotlights: {
        Row: {
          content_id: string
          created_at: string
          id: string
          staff_id: string
          updated_at: string
        }
        Insert: {
          content_id: string
          created_at?: string
          id?: string
          staff_id: string
          updated_at?: string
        }
        Update: {
          content_id?: string
          created_at?: string
          id?: string
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_spotlights_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: true
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_spotlights_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      extract_block_text: { Args: { body: Json }; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_contributor_or_above: { Args: never; Returns: boolean }
      is_editor_or_admin: { Args: never; Returns: boolean }
      list_actor_profiles: {
        Args: never
        Returns: {
          email: string
          full_name: string
          id: string
        }[]
      }
      list_profiles_with_email: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }[]
      }
    }
    Enums: {
      audit_action:
        | "CREATE"
        | "UPDATE"
        | "PUBLISH"
        | "UNPUBLISH"
        | "ARCHIVE"
        | "RESTORE"
        | "DELETE"
        | "UPLOAD"
        | "PROMOTE"
        | "REPLACE"
        | "ROLE_CHANGE"
        | "SETTINGS_UPDATE"
        | "SCHEDULE"
        | "CANCEL_SCHEDULE"
      audit_entity_type:
        | "CONTENT"
        | "MEDIA"
        | "AUTHOR"
        | "CATEGORY"
        | "SECTION"
        | "PUBLICATION"
        | "USER"
        | "SETTINGS"
      content_status:
        | "draft"
        | "review"
        | "scheduled"
        | "published"
        | "archived"
      content_type:
        | "EDITOR_NOTE"
        | "ARTICLE"
        | "COMPANY_NEWS"
        | "EVENT"
        | "STAFF_SPOTLIGHT"
        | "BIRTHDAY"
        | "HEALTH_TIP"
        | "GALLERY"
      media_bucket: "public" | "private"
      user_role: "admin" | "editor" | "contributor" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      audit_action: [
        "CREATE",
        "UPDATE",
        "PUBLISH",
        "UNPUBLISH",
        "ARCHIVE",
        "RESTORE",
        "DELETE",
        "UPLOAD",
        "PROMOTE",
        "REPLACE",
        "ROLE_CHANGE",
        "SETTINGS_UPDATE",
        "SCHEDULE",
        "CANCEL_SCHEDULE",
      ],
      audit_entity_type: [
        "CONTENT",
        "MEDIA",
        "AUTHOR",
        "CATEGORY",
        "SECTION",
        "PUBLICATION",
        "USER",
        "SETTINGS",
      ],
      content_status: ["draft", "review", "scheduled", "published", "archived"],
      content_type: [
        "EDITOR_NOTE",
        "ARTICLE",
        "COMPANY_NEWS",
        "EVENT",
        "STAFF_SPOTLIGHT",
        "BIRTHDAY",
        "HEALTH_TIP",
        "GALLERY",
      ],
      media_bucket: ["public", "private"],
      user_role: ["admin", "editor", "contributor", "viewer"],
    },
  },
} as const

