export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      articles: {
        Row: {
          extraction_quality: string
          event_id: string
          full_text: string
          headline: string
          id: string
          outlet_id: string
          published_at: string
          url: string
        }
        Insert: {
          extraction_quality?: string
          event_id: string
          full_text: string
          headline: string
          id?: string
          outlet_id: string
          published_at: string
          url: string
        }
        Update: {
          extraction_quality?: string
          event_id?: string
          full_text?: string
          headline?: string
          id?: string
          outlet_id?: string
          published_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_analyses: {
        Row: {
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_analyses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      coverage_matrix: {
        Row: {
          article_id: string
          present: boolean
          stakeholder_id: string
        }
        Insert: {
          article_id: string
          present: boolean
          stakeholder_id: string
        }
        Update: {
          article_id?: string
          present?: boolean
          stakeholder_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coverage_matrix_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coverage_matrix_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          first_reported_at: string
          id: string
          summary: string
          title: string
        }
        Insert: {
          created_at?: string
          first_reported_at: string
          id?: string
          summary: string
          title: string
        }
        Update: {
          created_at?: string
          first_reported_at?: string
          id?: string
          summary?: string
          title?: string
        }
        Relationships: []
      }
      headline_snapshots: {
        Row: {
          article_id: string
          captured_at: string
          headline_text: string
          id: string
          source: Database["public"]["Enums"]["headline_source"]
        }
        Insert: {
          article_id: string
          captured_at: string
          headline_text: string
          id?: string
          source: Database["public"]["Enums"]["headline_source"]
        }
        Update: {
          article_id?: string
          captured_at?: string
          headline_text?: string
          id?: string
          source?: Database["public"]["Enums"]["headline_source"]
        }
        Relationships: [
          {
            foreignKeyName: "headline_snapshots_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      outlets: {
        Row: {
          authority_tier: string
          created_at: string
          id: string
          name: string
          url: string
        }
        Insert: {
          authority_tier: string
          created_at?: string
          id?: string
          name: string
          url: string
        }
        Update: {
          authority_tier?: string
          created_at?: string
          id?: string
          name?: string
          url?: string
        }
        Relationships: []
      }
      signals_agency_framing: {
        Row: {
          agency_score: number | null
          analysis_method: string
          analysis_status: string
          article_id: string
          evidence_count: number
          example_phrases: Json
        }
        Insert: {
          agency_score?: number | null
          analysis_method?: string
          analysis_status?: string
          article_id: string
          evidence_count?: number
          example_phrases?: Json
        }
        Update: {
          agency_score?: number | null
          analysis_method?: string
          analysis_status?: string
          article_id?: string
          evidence_count?: number
          example_phrases?: Json
        }
        Relationships: [
          {
            foreignKeyName: "signals_agency_framing_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: true
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      signals_language_intensity: {
        Row: {
          article_id: string
          analysis_method: string
          analysis_status: string
          certainty_score: number | null
          emotional_score: number | null
          evidence_count: number
          urgency_score: number | null
        }
        Insert: {
          article_id: string
          analysis_method?: string
          analysis_status?: string
          certainty_score?: number | null
          emotional_score?: number | null
          evidence_count?: number
          urgency_score?: number | null
        }
        Update: {
          article_id?: string
          analysis_method?: string
          analysis_status?: string
          certainty_score?: number | null
          emotional_score?: number | null
          evidence_count?: number
          urgency_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "signals_language_intensity_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: true
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      signals_source_attribution: {
        Row: {
          analysis_method: string
          analysis_status: string
          evidence_count: number
          article_id: string
          independent_ratio: number | null
          official_ratio: number | null
        }
        Insert: {
          analysis_method?: string
          analysis_status?: string
          evidence_count?: number
          article_id: string
          independent_ratio?: number | null
          official_ratio?: number | null
        }
        Update: {
          analysis_method?: string
          analysis_status?: string
          evidence_count?: number
          article_id?: string
          independent_ratio?: number | null
          official_ratio?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "signals_source_attribution_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: true
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      stakeholders: {
        Row: {
          event_id: string
          first_appeared_at: string | null
          id: string
          name: string
          role: string
        }
        Insert: {
          event_id: string
          first_appeared_at?: string | null
          id?: string
          name: string
          role: string
        }
        Update: {
          event_id?: string
          first_appeared_at?: string | null
          id?: string
          name?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "stakeholders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      headline_source: "wayback" | "live"
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
  public: {
    Enums: {
      headline_source: ["wayback", "live"],
    },
  },
} as const
