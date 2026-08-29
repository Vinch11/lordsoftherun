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
      forbidden_zones: {
        Row: {
          created_at: string
          game_id: string
          id: string
          lat: number
          lng: number
          penalty_m2: number
          radius_m: number
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          lat: number
          lng: number
          penalty_m2?: number
          radius_m?: number
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          lat?: number
          lng?: number
          penalty_m2?: number
          radius_m?: number
        }
        Relationships: [
          {
            foreignKeyName: "forbidden_zones_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          code: string
          created_at: string
          duration_minutes: number
          ends_at: string | null
          id: string
          owner_id: string | null
          photo_deadline: string | null
          photo_requested_at: string | null
          return_lat: number | null
          return_lng: number | null
          return_radius_m: number
          started_at: string | null
          status: string
        }
        Insert: {
          code: string
          created_at?: string
          duration_minutes?: number
          ends_at?: string | null
          id?: string
          owner_id?: string | null
          photo_deadline?: string | null
          photo_requested_at?: string | null
          return_lat?: number | null
          return_lng?: number | null
          return_radius_m?: number
          started_at?: string | null
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          duration_minutes?: number
          ends_at?: string | null
          id?: string
          owner_id?: string | null
          photo_deadline?: string | null
          photo_requested_at?: string | null
          return_lat?: number | null
          return_lng?: number | null
          return_radius_m?: number
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      landmarks: {
        Row: {
          bonus_m2: number
          claimed_at: string | null
          claimed_by_team_id: string | null
          created_at: string
          game_id: string
          id: string
          lat: number
          lng: number
        }
        Insert: {
          bonus_m2?: number
          claimed_at?: string | null
          claimed_by_team_id?: string | null
          created_at?: string
          game_id: string
          id?: string
          lat: number
          lng: number
        }
        Update: {
          bonus_m2?: number
          claimed_at?: string | null
          claimed_by_team_id?: string | null
          created_at?: string
          game_id?: string
          id?: string
          lat?: number
          lng?: number
        }
        Relationships: [
          {
            foreignKeyName: "landmarks_claimed_by_team_id_fkey"
            columns: ["claimed_by_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landmarks_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          game_id: string
          id: string
          sender: string
          team_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          game_id: string
          id?: string
          sender?: string
          team_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          game_id?: string
          id?: string
          sender?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_submissions: {
        Row: {
          game_id: string
          id: string
          storage_path: string
          submitted_at: string
          team_id: string
        }
        Insert: {
          game_id: string
          id?: string
          storage_path: string
          submitted_at?: string
          team_id: string
        }
        Update: {
          game_id?: string
          id?: string
          storage_path?: string
          submitted_at?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_submissions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_submissions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approved: boolean
          created_at: string
          email: string | null
          id: string
          role: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          email?: string | null
          id: string
          role?: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          email?: string | null
          id?: string
          role?: string
        }
        Relationships: []
      }
      saved_points: {
        Row: {
          created_at: string
          id: string
          kind: string
          lat: number
          lng: number
          name: string
          owner_id: string
          radius_m: number
          value_m2: number
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          lat: number
          lng: number
          name: string
          owner_id: string
          radius_m?: number
          value_m2?: number
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          lat?: number
          lng?: number
          name?: string
          owner_id?: string
          radius_m?: number
          value_m2?: number
        }
        Relationships: []
      }
      teams: {
        Row: {
          color: string
          created_at: string
          game_id: string
          id: string
          landmark_bonus_m2: number
          lat: number | null
          lng: number | null
          name: string
          penalty_m2: number
          score_m2: number
          total_captured_m2: number
          updated_at: string
          validated: boolean
        }
        Insert: {
          color: string
          created_at?: string
          game_id: string
          id?: string
          landmark_bonus_m2?: number
          lat?: number | null
          lng?: number | null
          name: string
          penalty_m2?: number
          score_m2?: number
          total_captured_m2?: number
          updated_at?: string
          validated?: boolean
        }
        Update: {
          color?: string
          created_at?: string
          game_id?: string
          id?: string
          landmark_bonus_m2?: number
          lat?: number | null
          lng?: number | null
          name?: string
          penalty_m2?: number
          score_m2?: number
          total_captured_m2?: number
          updated_at?: string
          validated?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "teams_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      territories: {
        Row: {
          area_m2: number
          created_at: string
          game_id: string
          geometry: Json
          id: string
          scored_m2: number
          team_id: string
        }
        Insert: {
          area_m2?: number
          created_at?: string
          game_id: string
          geometry: Json
          id?: string
          scored_m2?: number
          team_id: string
        }
        Update: {
          area_m2?: number
          created_at?: string
          game_id?: string
          geometry?: Json
          id?: string
          scored_m2?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "territories_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territories_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: { uid: string }; Returns: boolean }
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
