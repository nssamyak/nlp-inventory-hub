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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      bills: {
        Row: {
          bill_id: string
          file_type: string | null
          file_url: string
          invoice_data: Json | null
          notes: string | null
          order_id: number | null
          supplier_id: number | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          bill_id?: string
          file_type?: string | null
          file_url: string
          invoice_data?: Json | null
          notes?: string | null
          order_id?: number | null
          supplier_id?: number | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          bill_id?: string
          file_type?: string | null
          file_url?: string
          invoice_data?: Json | null
          notes?: string | null
          order_id?: number | null
          supplier_id?: number | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bills_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["po_id"]
          },
          {
            foreignKeyName: "bills_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["sup_id"]
          },
          {
            foreignKeyName: "bills_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["e_id"]
          },
        ]
      }
      categories: {
        Row: {
          c_id: number
          cat_name: string
          created_at: string | null
          parent_id: number | null
        }
        Insert: {
          c_id?: number
          cat_name: string
          created_at?: string | null
          parent_id?: number | null
        }
        Update: {
          c_id?: number
          cat_name?: string
          created_at?: string | null
          parent_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["c_id"]
          },
        ]
      }
      command_history: {
        Row: {
          command: string
          created_at: string | null
          id: string
          result: Json | null
          success: boolean | null
          user_id: string
        }
        Insert: {
          command: string
          created_at?: string | null
          id?: string
          result?: Json | null
          success?: boolean | null
          user_id: string
        }
        Update: {
          command?: string
          created_at?: string | null
          id?: string
          result?: Json | null
          success?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string | null
          d_id: number
          d_name: string
        }
        Insert: {
          created_at?: string | null
          d_id?: number
          d_name: string
        }
        Update: {
          created_at?: string | null
          d_id?: number
          d_name?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          created_at: string | null
          d_id: number | null
          e_id: string
          e_name: string | null
          f_name: string
          l_name: string
          role_id: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          d_id?: number | null
          e_id?: string
          e_name?: string | null
          f_name: string
          l_name: string
          role_id?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          d_id?: number | null
          e_id?: string
          e_name?: string | null
          f_name?: string
          l_name?: string
          role_id?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_d_id_fkey"
            columns: ["d_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["d_id"]
          },
          {
            foreignKeyName: "employees_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["role_id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string | null
          created_by: string | null
          date: string | null
          p_id: number | null
          po_id: number
          price: number | null
          quantity_ordered: number
          quantity_received: number | null
          status: string | null
          sup_id: number | null
          target_w_id: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          p_id?: number | null
          po_id?: number
          price?: number | null
          quantity_ordered: number
          quantity_received?: number | null
          status?: string | null
          sup_id?: number | null
          target_w_id?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          p_id?: number | null
          po_id?: number
          price?: number | null
          quantity_ordered?: number
          quantity_received?: number | null
          status?: string | null
          sup_id?: number | null
          target_w_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["e_id"]
          },
          {
            foreignKeyName: "orders_p_id_fkey"
            columns: ["p_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["pid"]
          },
          {
            foreignKeyName: "orders_sup_id_fkey"
            columns: ["sup_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["sup_id"]
          },
          {
            foreignKeyName: "orders_target_w_id_fkey"
            columns: ["target_w_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["w_id"]
          },
        ]
      }
      product_warehouse: {
        Row: {
          pid: number
          stock: number | null
          w_id: number
        }
        Insert: {
          pid: number
          stock?: number | null
          w_id: number
        }
        Update: {
          pid?: number
          stock?: number | null
          w_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_warehouse_pid_fkey"
            columns: ["pid"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["pid"]
          },
          {
            foreignKeyName: "product_warehouse_w_id_fkey"
            columns: ["w_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["w_id"]
          },
        ]
      }
      products: {
        Row: {
          c_id: number | null
          created_at: string | null
          description: string | null
          last_updated: string | null
          manufacturer: string | null
          p_name: string
          pid: number
          quantity: number | null
          unit_price: number | null
        }
        Insert: {
          c_id?: number | null
          created_at?: string | null
          description?: string | null
          last_updated?: string | null
          manufacturer?: string | null
          p_name: string
          pid?: number
          quantity?: number | null
          unit_price?: number | null
        }
        Update: {
          c_id?: number | null
          created_at?: string | null
          description?: string | null
          last_updated?: string | null
          manufacturer?: string | null
          p_name?: string
          pid?: number
          quantity?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_c_id_fkey"
            columns: ["c_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["c_id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          permissions: Json | null
          role_id: number
          role_name: string
        }
        Insert: {
          created_at?: string | null
          permissions?: Json | null
          role_id?: number
          role_name: string
        }
        Update: {
          created_at?: string | null
          permissions?: Json | null
          role_id?: number
          role_name?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          s_name: string
          sup_id: number
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          s_name: string
          sup_id?: number
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          s_name?: string
          sup_id?: number
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amt: number
          created_at: string | null
          description: string | null
          e_id: string | null
          pid: number | null
          t_id: number
          target_w_id: number | null
          time: string | null
          type: string
          w_id: number | null
        }
        Insert: {
          amt: number
          created_at?: string | null
          description?: string | null
          e_id?: string | null
          pid?: number | null
          t_id?: number
          target_w_id?: number | null
          time?: string | null
          type: string
          w_id?: number | null
        }
        Update: {
          amt?: number
          created_at?: string | null
          description?: string | null
          e_id?: string | null
          pid?: number | null
          t_id?: number
          target_w_id?: number | null
          time?: string | null
          type?: string
          w_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_e_id_fkey"
            columns: ["e_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["e_id"]
          },
          {
            foreignKeyName: "transactions_pid_fkey"
            columns: ["pid"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["pid"]
          },
          {
            foreignKeyName: "transactions_target_w_id_fkey"
            columns: ["target_w_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["w_id"]
          },
          {
            foreignKeyName: "transactions_w_id_fkey"
            columns: ["w_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["w_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      warehouses: {
        Row: {
          address: string | null
          created_at: string | null
          mgr_id: string | null
          w_id: number
          w_name: string
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          mgr_id?: string | null
          w_id?: number
          w_name: string
        }
        Update: {
          address?: string | null
          created_at?: string | null
          mgr_id?: string | null
          w_id?: number
          w_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_mgr_id_fkey"
            columns: ["mgr_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["e_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "warehouse_staff" | "procurement_officer"
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
      app_role: ["admin", "manager", "warehouse_staff", "procurement_officer"],
    },
  },
} as const
