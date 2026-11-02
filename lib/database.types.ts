export type Database = {
  public: {
    Tables: {
      departments: {
        Row: {
          id: string
          name: string
          telegram_title_ar: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          telegram_title_ar?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          telegram_title_ar?: string
          created_at?: string
        }
        Relationships: []
      }
      members: {
        Row: {
          id: string
          name: string
          telegram_id: string | null
          telegram_username: string | null
          department_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          telegram_id?: string | null
          telegram_username?: string | null
          department_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          telegram_id?: string | null
          telegram_username?: string | null
          department_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
