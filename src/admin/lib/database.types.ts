// GENERIERT via Supabase MCP (generate_typescript_types) — nicht von Hand
// pflegen, bei Schema-Änderungen neu generieren. Enthält auch Nicht-sm_-Tabellen
// (Rezept-App im selben Projekt); der Admin nutzt nur die sm_-Typen.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      einkaufsliste: {
        Row: {
          einheit: string | null
          emoji: string | null
          erledigt: boolean
          erledigt_von: string | null
          erstellt_am: string
          haushalt_id: string
          hinzugefuegt_von: string | null
          id: string
          kategorie: string
          menge: number | null
          name: string
          quelle_rezept_id: string | null
          vorratscheck: boolean
        }
        Insert: {
          einheit?: string | null
          emoji?: string | null
          erledigt?: boolean
          erledigt_von?: string | null
          erstellt_am?: string
          haushalt_id: string
          hinzugefuegt_von?: string | null
          id?: string
          kategorie?: string
          menge?: number | null
          name: string
          quelle_rezept_id?: string | null
          vorratscheck?: boolean
        }
        Update: {
          einheit?: string | null
          emoji?: string | null
          erledigt?: boolean
          erledigt_von?: string | null
          erstellt_am?: string
          haushalt_id?: string
          hinzugefuegt_von?: string | null
          id?: string
          kategorie?: string
          menge?: number | null
          name?: string
          quelle_rezept_id?: string | null
          vorratscheck?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "einkaufsliste_haushalt_id_fkey"
            columns: ["haushalt_id"]
            isOneToOne: false
            referencedRelation: "haushalte"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "einkaufsliste_quelle_rezept_id_fkey"
            columns: ["quelle_rezept_id"]
            isOneToOne: false
            referencedRelation: "rezepte"
            referencedColumns: ["id"]
          },
        ]
      }
      haushalt_mitglieder: {
        Row: {
          anzeige_name: string | null
          haushalt_id: string
          rolle: string
          user_id: string
        }
        Insert: {
          anzeige_name?: string | null
          haushalt_id: string
          rolle?: string
          user_id: string
        }
        Update: {
          anzeige_name?: string | null
          haushalt_id?: string
          rolle?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "haushalt_mitglieder_haushalt_id_fkey"
            columns: ["haushalt_id"]
            isOneToOne: false
            referencedRelation: "haushalte"
            referencedColumns: ["id"]
          },
        ]
      }
      haushalte: {
        Row: {
          einladungscode: string
          erstellt_am: string
          erstellt_von: string | null
          id: string
          name: string
        }
        Insert: {
          einladungscode: string
          erstellt_am?: string
          erstellt_von?: string | null
          id?: string
          name: string
        }
        Update: {
          einladungscode?: string
          erstellt_am?: string
          erstellt_von?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      koch_historie: {
        Row: {
          erstellt_am: string
          gekocht_am: string
          geloggt_von: string | null
          haushalt_id: string
          id: string
          notiz: string | null
          portionen: number | null
          rezept_id: string
        }
        Insert: {
          erstellt_am?: string
          gekocht_am?: string
          geloggt_von?: string | null
          haushalt_id: string
          id?: string
          notiz?: string | null
          portionen?: number | null
          rezept_id: string
        }
        Update: {
          erstellt_am?: string
          gekocht_am?: string
          geloggt_von?: string | null
          haushalt_id?: string
          id?: string
          notiz?: string | null
          portionen?: number | null
          rezept_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "koch_historie_haushalt_id_fkey"
            columns: ["haushalt_id"]
            isOneToOne: false
            referencedRelation: "haushalte"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koch_historie_rezept_id_fkey"
            columns: ["rezept_id"]
            isOneToOne: false
            referencedRelation: "rezepte"
            referencedColumns: ["id"]
          },
        ]
      }
      praeferenzen: {
        Row: {
          haushalt_id: string
          regeln: Json
        }
        Insert: {
          haushalt_id: string
          regeln?: Json
        }
        Update: {
          haushalt_id?: string
          regeln?: Json
        }
        Relationships: [
          {
            foreignKeyName: "praeferenzen_haushalt_id_fkey"
            columns: ["haushalt_id"]
            isOneToOne: true
            referencedRelation: "haushalte"
            referencedColumns: ["id"]
          },
        ]
      }
      rezept_rubriken: {
        Row: {
          rezept_id: string
          rubrik_id: string
        }
        Insert: {
          rezept_id: string
          rubrik_id: string
        }
        Update: {
          rezept_id?: string
          rubrik_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rezept_rubriken_rezept_id_fkey"
            columns: ["rezept_id"]
            isOneToOne: false
            referencedRelation: "rezepte"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rezept_rubriken_rubrik_id_fkey"
            columns: ["rubrik_id"]
            isOneToOne: false
            referencedRelation: "rubriken"
            referencedColumns: ["id"]
          },
        ]
      }
      rezepte: {
        Row: {
          aktive_zeit_min: number | null
          aktualisiert_am: string
          basis_portionen: number
          beschreibung: string | null
          bewertung: number | null
          erstellt_am: string
          erstellt_von: string | null
          gesamtgewicht_g: number | null
          gesund_begruendung: string | null
          gesund_score: number | null
          haushalt_id: string
          id: string
          naehrwerte_pro_100g: Json | null
          naehrwerte_pro_portion: Json | null
          original_input: Json | null
          protein_pro_100kcal: number | null
          quelle: string | null
          schwierigkeit: string | null
          titel: string
          titelbild_pfad: string | null
          warte_zeit_min: number | null
        }
        Insert: {
          aktive_zeit_min?: number | null
          aktualisiert_am?: string
          basis_portionen?: number
          beschreibung?: string | null
          bewertung?: number | null
          erstellt_am?: string
          erstellt_von?: string | null
          gesamtgewicht_g?: number | null
          gesund_begruendung?: string | null
          gesund_score?: number | null
          haushalt_id: string
          id?: string
          naehrwerte_pro_100g?: Json | null
          naehrwerte_pro_portion?: Json | null
          original_input?: Json | null
          protein_pro_100kcal?: number | null
          quelle?: string | null
          schwierigkeit?: string | null
          titel: string
          titelbild_pfad?: string | null
          warte_zeit_min?: number | null
        }
        Update: {
          aktive_zeit_min?: number | null
          aktualisiert_am?: string
          basis_portionen?: number
          beschreibung?: string | null
          bewertung?: number | null
          erstellt_am?: string
          erstellt_von?: string | null
          gesamtgewicht_g?: number | null
          gesund_begruendung?: string | null
          gesund_score?: number | null
          haushalt_id?: string
          id?: string
          naehrwerte_pro_100g?: Json | null
          naehrwerte_pro_portion?: Json | null
          original_input?: Json | null
          protein_pro_100kcal?: number | null
          quelle?: string | null
          schwierigkeit?: string | null
          titel?: string
          titelbild_pfad?: string | null
          warte_zeit_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rezepte_haushalt_id_fkey"
            columns: ["haushalt_id"]
            isOneToOne: false
            referencedRelation: "haushalte"
            referencedColumns: ["id"]
          },
        ]
      }
      rubriken: {
        Row: {
          emoji: string | null
          haushalt_id: string
          id: string
          name: string
          position: number
        }
        Insert: {
          emoji?: string | null
          haushalt_id: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          emoji?: string | null
          haushalt_id?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "rubriken_haushalt_id_fkey"
            columns: ["haushalt_id"]
            isOneToOne: false
            referencedRelation: "haushalte"
            referencedColumns: ["id"]
          },
        ]
      }
      schritte: {
        Row: {
          bild_pfad: string | null
          id: string
          position: number
          rezept_id: string
          text: string
          timer_sekunden: number | null
          titel: string | null
        }
        Insert: {
          bild_pfad?: string | null
          id?: string
          position: number
          rezept_id: string
          text: string
          timer_sekunden?: number | null
          titel?: string | null
        }
        Update: {
          bild_pfad?: string | null
          id?: string
          position?: number
          rezept_id?: string
          text?: string
          timer_sekunden?: number | null
          titel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schritte_rezept_id_fkey"
            columns: ["rezept_id"]
            isOneToOne: false
            referencedRelation: "rezepte"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_admins: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      sm_content: {
        Row: {
          beschreibung: string | null
          caption: string | null
          created_at: string
          cta: string | null
          drive_asset_url: string | null
          drive_rohmaterial_url: string | null
          format: string | null
          geplant_am: string | null
          hook: string | null
          id: string
          idee_id: string | null
          kanal: string[]
          kategorie: string | null
          notizen: string | null
          sound: string | null
          status: string
          titel: string
          updated_at: string
          verantwortlich: string | null
        }
        Insert: {
          beschreibung?: string | null
          caption?: string | null
          created_at?: string
          cta?: string | null
          drive_asset_url?: string | null
          drive_rohmaterial_url?: string | null
          format?: string | null
          geplant_am?: string | null
          hook?: string | null
          id?: string
          idee_id?: string | null
          kanal?: string[]
          kategorie?: string | null
          notizen?: string | null
          sound?: string | null
          status?: string
          titel: string
          updated_at?: string
          verantwortlich?: string | null
        }
        Update: {
          beschreibung?: string | null
          caption?: string | null
          created_at?: string
          cta?: string | null
          drive_asset_url?: string | null
          drive_rohmaterial_url?: string | null
          format?: string | null
          geplant_am?: string | null
          hook?: string | null
          id?: string
          idee_id?: string | null
          kanal?: string[]
          kategorie?: string | null
          notizen?: string | null
          sound?: string | null
          status?: string
          titel?: string
          updated_at?: string
          verantwortlich?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sm_content_idee_id_fkey"
            columns: ["idee_id"]
            isOneToOne: false
            referencedRelation: "sm_ideen_pool"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_ideen_eingang: {
        Row: {
          beschreibung: string | null
          content_id: string | null
          created_at: string
          id: string
          kanal: string[]
          status: string
          titel: string
          updated_at: string
          von: string | null
        }
        Insert: {
          beschreibung?: string | null
          content_id?: string | null
          created_at?: string
          id?: string
          kanal?: string[]
          status?: string
          titel: string
          updated_at?: string
          von?: string | null
        }
        Update: {
          beschreibung?: string | null
          content_id?: string | null
          created_at?: string
          id?: string
          kanal?: string[]
          status?: string
          titel?: string
          updated_at?: string
          von?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sm_ideen_eingang_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "sm_content"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_ideen_pool: {
        Row: {
          aktiv: boolean
          beschreibung: string | null
          created_at: string
          id: string
          kanal: string[]
          kategorie: string | null
          rhythmus: string | null
          sortierung: number
          titel: string
          updated_at: string
        }
        Insert: {
          aktiv?: boolean
          beschreibung?: string | null
          created_at?: string
          id?: string
          kanal?: string[]
          kategorie?: string | null
          rhythmus?: string | null
          sortierung?: number
          titel: string
          updated_at?: string
        }
        Update: {
          aktiv?: boolean
          beschreibung?: string | null
          created_at?: string
          id?: string
          kanal?: string[]
          kategorie?: string | null
          rhythmus?: string | null
          sortierung?: number
          titel?: string
          updated_at?: string
        }
        Relationships: []
      }
      sm_sponsoren: {
        Row: {
          aktiv: boolean
          ansprechpartner: string | null
          created_at: string
          id: string
          kontakt: string | null
          laufzeit_bis: string | null
          laufzeit_von: string | null
          leistungen: string | null
          logo_url: string | null
          name: string
          notizen: string | null
          paket: string | null
          updated_at: string
        }
        Insert: {
          aktiv?: boolean
          ansprechpartner?: string | null
          created_at?: string
          id?: string
          kontakt?: string | null
          laufzeit_bis?: string | null
          laufzeit_von?: string | null
          leistungen?: string | null
          logo_url?: string | null
          name: string
          notizen?: string | null
          paket?: string | null
          updated_at?: string
        }
        Update: {
          aktiv?: boolean
          ansprechpartner?: string | null
          created_at?: string
          id?: string
          kontakt?: string | null
          laufzeit_bis?: string | null
          laufzeit_von?: string | null
          leistungen?: string | null
          logo_url?: string | null
          name?: string
          notizen?: string | null
          paket?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      wochenplan: {
        Row: {
          datum: string
          haushalt_id: string
          id: string
          notiz: string | null
          portionen: number
          rezept_id: string | null
          slot: string
          status: string
        }
        Insert: {
          datum: string
          haushalt_id: string
          id?: string
          notiz?: string | null
          portionen?: number
          rezept_id?: string | null
          slot: string
          status?: string
        }
        Update: {
          datum?: string
          haushalt_id?: string
          id?: string
          notiz?: string | null
          portionen?: number
          rezept_id?: string | null
          slot?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "wochenplan_haushalt_id_fkey"
            columns: ["haushalt_id"]
            isOneToOne: false
            referencedRelation: "haushalte"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wochenplan_rezept_id_fkey"
            columns: ["rezept_id"]
            isOneToOne: false
            referencedRelation: "rezepte"
            referencedColumns: ["id"]
          },
        ]
      }
      zutaten: {
        Row: {
          anmerkung: string | null
          einheit: string | null
          einkaufs_kategorie: string | null
          gruppe: string | null
          id: string
          menge: number | null
          naehrwerte: Json | null
          name: string
          position: number
          rezept_id: string
          skalierungs_typ: string
        }
        Insert: {
          anmerkung?: string | null
          einheit?: string | null
          einkaufs_kategorie?: string | null
          gruppe?: string | null
          id?: string
          menge?: number | null
          naehrwerte?: Json | null
          name: string
          position?: number
          rezept_id: string
          skalierungs_typ?: string
        }
        Update: {
          anmerkung?: string | null
          einheit?: string | null
          einkaufs_kategorie?: string | null
          gruppe?: string | null
          id?: string
          menge?: number | null
          naehrwerte?: Json | null
          name?: string
          position?: number
          rezept_id?: string
          skalierungs_typ?: string
        }
        Relationships: [
          {
            foreignKeyName: "zutaten_rezept_id_fkey"
            columns: ["rezept_id"]
            isOneToOne: false
            referencedRelation: "rezepte"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      einladungscode_regenerieren: {
        Args: { p_haushalt_id: string }
        Returns: string
      }
      generiere_einladungscode: { Args: never; Returns: string }
      haushalt_beitreten: { Args: { p_code: string }; Returns: string }
      haushalt_gruenden: { Args: { p_name: string }; Returns: string }
      is_sm_admin: { Args: never; Returns: boolean }
      ist_haushalt_mitglied: {
        Args: { p_haushalt_id: string }
        Returns: boolean
      }
      rezept_aktualisieren: {
        Args: { p_rezept: Json; p_rezept_id: string }
        Returns: undefined
      }
      rezept_speichern: { Args: { p_rezept: Json }; Returns: string }
      sm_eingang_into_plan: {
        Args: { p_eingang_id: string; p_geplant_am?: string }
        Returns: {
          beschreibung: string | null
          caption: string | null
          created_at: string
          cta: string | null
          drive_asset_url: string | null
          drive_rohmaterial_url: string | null
          format: string | null
          geplant_am: string | null
          hook: string | null
          id: string
          idee_id: string | null
          kanal: string[]
          kategorie: string | null
          notizen: string | null
          sound: string | null
          status: string
          titel: string
          updated_at: string
          verantwortlich: string | null
        }
        SetofOptions: {
          from: "*"
          to: "sm_content"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
