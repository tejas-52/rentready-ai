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
      agent_credentials: {
        Row: {
          created_at: string
          host: string
          id: string
          label: string | null
          password_ciphertext: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          host: string
          id?: string
          label?: string | null
          password_ciphertext: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          host?: string
          id?: string
          label?: string | null
          password_ciphertext?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      agent_runs: {
        Row: {
          bb_session_id: string | null
          created_at: string
          credential_id: string | null
          id: string
          live_view_url: string | null
          log: Json
          status: string
          target_url: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bb_session_id?: string | null
          created_at?: string
          credential_id?: string | null
          id?: string
          live_view_url?: string | null
          log?: Json
          status?: string
          target_url: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bb_session_id?: string | null
          created_at?: string
          credential_id?: string | null
          id?: string
          live_view_url?: string | null
          log?: Json
          status?: string
          target_url?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "agent_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          confidence_score: number | null
          created_at: string
          id: string
          status: string
          summary: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          status?: string
          summary?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          status?: string
          summary?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          application_id: string | null
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          application_id: string
          category: string
          confidence: number | null
          created_at: string
          doc_type: string | null
          error: string | null
          file_name: string
          id: string
          mime_type: string | null
          name: string
          status: string
          storage_path: string
          user_id: string
        }
        Insert: {
          application_id: string
          category?: string
          confidence?: number | null
          created_at?: string
          doc_type?: string | null
          error?: string | null
          file_name: string
          id?: string
          mime_type?: string | null
          name: string
          status?: string
          storage_path: string
          user_id: string
        }
        Update: {
          application_id?: string
          category?: string
          confidence?: number | null
          created_at?: string
          doc_type?: string | null
          error?: string | null
          file_name?: string
          id?: string
          mime_type?: string | null
          name?: string
          status?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      extractions: {
        Row: {
          confidence: number | null
          created_at: string
          data: Json | null
          document_id: string
          id: string
          ocr_text: string | null
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          data?: Json | null
          document_id: string
          id?: string
          ocr_text?: string | null
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          data?: Json | null
          document_id?: string
          id?: string
          ocr_text?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "extractions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          country: string | null
          created_at: string
          email: string | null
          employment_status: string | null
          full_name: string | null
          id: string
          onboarding_completed: boolean
          photo_url: string | null
          preferred_language: string
          rental_country: string | null
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          email?: string | null
          employment_status?: string | null
          full_name?: string | null
          id: string
          onboarding_completed?: boolean
          photo_url?: string | null
          preferred_language?: string
          rental_country?: string | null
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          email?: string | null
          employment_status?: string | null
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean
          photo_url?: string | null
          preferred_language?: string
          rental_country?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          application_id: string
          created_at: string
          id: string
          items: Json
          user_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          items?: Json
          user_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          items?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          application_id: string
          content: Json
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          application_id: string
          content: Json
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          application_id?: string
          content?: Json
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      validations: {
        Row: {
          application_id: string
          checks: Json
          created_at: string
          id: string
          issues: Json
          user_id: string
        }
        Insert: {
          application_id: string
          checks?: Json
          created_at?: string
          id?: string
          issues?: Json
          user_id: string
        }
        Update: {
          application_id?: string
          checks?: Json
          created_at?: string
          id?: string
          issues?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "validations_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
