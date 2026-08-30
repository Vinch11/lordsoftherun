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
      flags: {
        Row: {
          carried_by_team_id: string | null
          created_at: string
          game_id: string
          id: string
          lat: number
          lng: number
          status: string
          team_id: string
        }
        Insert: {
          carried_by_team_id?: string | null
          created_at?: string
          game_id: string
          id?: string
          lat: number
          lng: number
          status?: string
          team_id: string
        }
        Update: {
          carried_by_team_id?: string | null
          created_at?: string
          game_id?: string
          id?: string
          lat?: number
          lng?: number
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flags_carried_by_team_id_fkey"
            columns: ["carried_by_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flags_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flags_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
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
          ctf_capture_consequence: string
          ctf_capture_radius_m: number
          ctf_time_penalty_m2: number
          duration_minutes: number
          ends_at: string | null
          forbidden_zone_running_only: boolean
          grace_enabled: boolean
          grace_ends_at: string | null
          grace_minutes: number
          grace_penalty_mode: string
          grace_penalty_per_second_m2: number
          grid_cell_size_m: number
          grid_center_lat: number | null
          grid_center_lng: number | null
          grid_height_m: number
          grid_radius_m: number
          grid_shape: string
          grid_show_overlay: boolean
          grid_width_m: number
          id: string
          map_style: string
          mode: string
          owner_id: string | null
          photo_deadline: string | null
          photo_requested_at: string | null
          return_lat: number | null
          return_lng: number | null
          return_radius_m: number
          running_bonus_enabled: boolean
          running_bonus_speed_kmh: number
          started_at: string | null
          status: string
          vehicle_allowed: boolean
          vehicle_penalty_m2: number
          vehicle_speed_threshold_kmh: number
        }
        Insert: {
          code: string
          created_at?: string
          ctf_capture_consequence?: string
          ctf_capture_radius_m?: number
          ctf_time_penalty_m2?: number
          duration_minutes?: number
          ends_at?: string | null
          forbidden_zone_running_only?: boolean
          grace_enabled?: boolean
          grace_ends_at?: string | null
          grace_minutes?: number
          grace_penalty_mode?: string
          grace_penalty_per_second_m2?: number
          grid_cell_size_m?: number
          grid_center_lat?: number | null
          grid_center_lng?: number | null
          grid_height_m?: number
          grid_radius_m?: number
          grid_shape?: string
          grid_show_overlay?: boolean
          grid_width_m?: number
          id?: string
          map_style?: string
          mode?: string
          owner_id?: string | null
          photo_deadline?: string | null
          photo_requested_at?: string | null
          return_lat?: number | null
          return_lng?: number | null
          return_radius_m?: number
          running_bonus_enabled?: boolean
          running_bonus_speed_kmh?: number
          started_at?: string | null
          status?: string
          vehicle_allowed?: boolean
          vehicle_penalty_m2?: number
          vehicle_speed_threshold_kmh?: number
        }
        Update: {
          code?: string
          created_at?: string
          ctf_capture_consequence?: string
          ctf_capture_radius_m?: number
          ctf_time_penalty_m2?: number
          duration_minutes?: number
          ends_at?: string | null
          forbidden_zone_running_only?: boolean
          grace_enabled?: boolean
          grace_ends_at?: string | null
          grace_minutes?: number
          grace_penalty_mode?: string
          grace_penalty_per_second_m2?: number
          grid_cell_size_m?: number
          grid_center_lat?: number | null
          grid_center_lng?: number | null
          grid_height_m?: number
          grid_radius_m?: number
          grid_shape?: string
          grid_show_overlay?: boolean
          grid_width_m?: number
          id?: string
          map_style?: string
          mode?: string
          owner_id?: string | null
          photo_deadline?: string | null
          photo_requested_at?: string | null
          return_lat?: number | null
          return_lng?: number | null
          return_radius_m?: number
          running_bonus_enabled?: boolean
          running_bonus_speed_kmh?: number
          started_at?: string | null
          status?: string
          vehicle_allowed?: boolean
          vehicle_penalty_m2?: number
          vehicle_speed_threshold_kmh?: number
        }
        Relationships: []
      }
      grid_cells: {
        Row: {
          col: number
          game_id: string
          id: string
          owner_team_id: string
          row: number
          updated_at: string
        }
        Insert: {
          col: number
          game_id: string
          id?: string
          owner_team_id: string
          row: number
          updated_at?: string
        }
        Update: {
          col?: number
          game_id?: string
          id?: string
          owner_team_id?: string
          row?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grid_cells_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grid_cells_owner_team_id_fkey"
            columns: ["owner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      landmarks: {
        Row: {
          active_after_minutes: number
          active_until_minutes: number | null
          bonus_m2: number
          claimed_at: string | null
          claimed_by_team_id: string | null
          created_at: string
          game_id: string
          icon: string
          id: string
          kind: string
          lat: number
          lng: number
          shield_duration_s: number
        }
        Insert: {
          active_after_minutes?: number
          active_until_minutes?: number | null
          bonus_m2?: number
          claimed_at?: string | null
          claimed_by_team_id?: string | null
          created_at?: string
          game_id: string
          icon?: string
          id?: string
          kind?: string
          lat: number
          lng: number
          shield_duration_s?: number
        }
        Update: {
          active_after_minutes?: number
          active_until_minutes?: number | null
          bonus_m2?: number
          claimed_at?: string | null
          claimed_by_team_id?: string | null
          created_at?: string
          game_id?: string
          icon?: string
          id?: string
          kind?: string
          lat?: number
          lng?: number
          shield_duration_s?: number
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
      message_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          owner_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          owner_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          owner_id?: string
        }
        Relationships: []
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
          terminology: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          email?: string | null
          id: string
          role?: string
          terminology?: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          email?: string | null
          id?: string
          role?: string
          terminology?: string
        }
        Relationships: []
      }
      saved_points: {
        Row: {
          active_after_minutes: number
          active_until_minutes: number | null
          created_at: string
          icon: string
          id: string
          kind: string
          lat: number
          lng: number
          name: string
          owner_id: string
          radius_m: number
          shield_duration_s: number
          value_m2: number
        }
        Insert: {
          active_after_minutes?: number
          active_until_minutes?: number | null
          created_at?: string
          icon?: string
          id?: string
          kind: string
          lat: number
          lng: number
          name: string
          owner_id: string
          radius_m?: number
          shield_duration_s?: number
          value_m2?: number
        }
        Update: {
          active_after_minutes?: number
          active_until_minutes?: number | null
          created_at?: string
          icon?: string
          id?: string
          kind?: string
          lat?: number
          lng?: number
          name?: string
          owner_id?: string
          radius_m?: number
          shield_duration_s?: number
          value_m2?: number
        }
        Relationships: []
      }
      teams: {
        Row: {
          color: string
          created_at: string
          flags_captured: number
          game_id: string
          id: string
          landmark_bonus_m2: number
          lat: number | null
          lng: number | null
          name: string
          penalty_m2: number
          returned_at: string | null
          score_m2: number
          shield_until: string | null
          total_captured_m2: number
          updated_at: string
          validated: boolean
        }
        Insert: {
          color: string
          created_at?: string
          flags_captured?: number
          game_id: string
          id?: string
          landmark_bonus_m2?: number
          lat?: number | null
          lng?: number | null
          name: string
          penalty_m2?: number
          returned_at?: string | null
          score_m2?: number
          shield_until?: string | null
          total_captured_m2?: number
          updated_at?: string
          validated?: boolean
        }
        Update: {
          color?: string
          created_at?: string
          flags_captured?: number
          game_id?: string
          id?: string
          landmark_bonus_m2?: number
          lat?: number | null
          lng?: number | null
          name?: string
          penalty_m2?: number
          returned_at?: string | null
          score_m2?: number
          shield_until?: string | null
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
