export type Database = {
  public: {
    Tables: {
      departments: {
        Row: {
          id: string
          name: string
          telegram_title_ar: string
          telegram_help_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          telegram_title_ar?: string
          telegram_help_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          telegram_title_ar?: string
          telegram_help_message?: string | null
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
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          telegram_id?: string | null
          telegram_username?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          telegram_id?: string | null
          telegram_username?: string | null
          created_at?: string
        }
        Relationships: []
      }
      member_departments: {
        Row: {
          member_id: string
          department_id: string
        }
        Insert: {
          member_id: string
          department_id: string
        }
        Update: {
          member_id?: string
          department_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_departments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_command_users: {
        Row: {
          id: string
          telegram_id: string | null
          telegram_username: string | null
          created_at: string
        }
        Insert: {
          id?: string
          telegram_id?: string | null
          telegram_username?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          telegram_id?: string | null
          telegram_username?: string | null
          created_at?: string
        }
        Relationships: []
      }
      telegram_allowed_chats: {
        Row: {
          chat_id: string
          name: string
          created_at: string
        }
        Insert: {
          chat_id: string
          name: string
          created_at?: string
        }
        Update: {
          chat_id?: string
          name?: string
          created_at?: string
        }
        Relationships: []
      }
      telegram_bot_settings: {
        Row: {
          id: boolean
          target_group_id: string | null
          updated_at: string
        }
        Insert: {
          id?: boolean
          target_group_id?: string | null
          updated_at?: string
        }
        Update: {
          id?: boolean
          target_group_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      save_member_with_departments: {
        Args: {
          p_department_ids: string[]
          p_member_id: string | null
          p_name: string
          p_telegram_id: string | null
          p_telegram_username: string | null
        }
        Returns: string
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
