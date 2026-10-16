export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      bookings: {
        Row: {
          booking_date: string;
          created_at: string;
          id: string;
          order_id: string;
          slot_time: string;
          status: string;
        };
        Insert: {
          booking_date: string;
          created_at?: string;
          id?: string;
          order_id: string;
          slot_time: string;
          status?: string;
        };
        Update: {
          booking_date?: string;
          created_at?: string;
          id?: string;
          order_id?: string;
          slot_time?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          quantity: number;
          service_id: string | null;
          service_name: string;
          subtotal: number;
          unit_price: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          quantity: number;
          service_id?: string | null;
          service_name: string;
          subtotal: number;
          unit_price: number;
        };
        Update: {
          id?: string;
          order_id?: string;
          quantity?: number;
          service_id?: string | null;
          service_name?: string;
          subtotal?: number;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      professionals: {
        Row: {
          active: boolean;
          id: string;
          name: string;
          updated_at: string;
          whatsapp: string;
        };
        Insert: {
          active?: boolean;
          id: string;
          name: string;
          updated_at?: string;
          whatsapp: string;
        };
        Update: {
          active?: boolean;
          id?: string;
          name?: string;
          updated_at?: string;
          whatsapp?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          cep: string | null;
          code: string;
          complement: string | null;
          confirmation_token: string | null;
          created_at: string;
          customer_name: string;
          delivery_method: string;
          district: string | null;
          id: string;
          notes: string | null;
          paid_amount: number;
          payment_status: string;
          phone: string;
          pickup_fee: number;
          plate: string | null;
          professional_name: string | null;
          professional_phone: string | null;
          reference: string | null;
          status: string;
          street: string | null;
          subtotal: number;
          total: number;
          updated_at: string;
          vehicle_model: string;
        };
        Insert: {
          cep?: string | null;
          code?: string;
          complement?: string | null;
          confirmation_token?: string | null;
          created_at?: string;
          customer_name: string;
          delivery_method: string;
          district?: string | null;
          id?: string;
          notes?: string | null;
          paid_amount?: number;
          payment_status?: string;
          phone: string;
          pickup_fee?: number;
          plate?: string | null;
          professional_name?: string | null;
          professional_phone?: string | null;
          reference?: string | null;
          status?: string;
          street?: string | null;
          subtotal: number;
          total: number;
          updated_at?: string;
          vehicle_model: string;
        };
        Update: {
          cep?: string | null;
          code?: string;
          complement?: string | null;
          confirmation_token?: string | null;
          created_at?: string;
          customer_name?: string;
          delivery_method?: string;
          district?: string | null;
          id?: string;
          notes?: string | null;
          paid_amount?: number;
          payment_status?: string;
          phone?: string;
          pickup_fee?: number;
          plate?: string | null;
          professional_name?: string | null;
          professional_phone?: string | null;
          reference?: string | null;
          status?: string;
          street?: string | null;
          subtotal?: number;
          total?: number;
          updated_at?: string;
          vehicle_model?: string;
        };
        Relationships: [];
      };
      services: {
        Row: {
          active: boolean;
          created_at: string;
          description: string;
          id: string;
          image_key: string;
          image_url: string | null;
          name: string;
          price: number;
          sort_order: number;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          description?: string;
          id?: string;
          image_key?: string;
          image_url?: string | null;
          name: string;
          price: number;
          sort_order?: number;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          description?: string;
          id?: string;
          image_key?: string;
          image_url?: string | null;
          name?: string;
          price?: number;
          sort_order?: number;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          address: string | null;
          company_name: string;
          contact_info: string | null;
          id: number;
          instagram: string | null;
          pickup_fee: number;
          schedule: Json;
          slot_capacity: number;
          timezone: string;
          updated_at: string;
          whatsapp: string | null;
        };
        Insert: {
          address?: string | null;
          company_name?: string;
          contact_info?: string | null;
          id?: number;
          instagram?: string | null;
          pickup_fee?: number;
          schedule?: Json;
          slot_capacity?: number;
          timezone?: string;
          updated_at?: string;
          whatsapp?: string | null;
        };
        Update: {
          address?: string | null;
          company_name?: string;
          contact_info?: string | null;
          id?: number;
          instagram?: string | null;
          pickup_fee?: number;
          schedule?: Json;
          slot_capacity?: number;
          timezone?: string;
          updated_at?: string;
          whatsapp?: string | null;
        };
        Relationships: [];
      };
      slot_blocks: {
        Row: {
          block_date: string;
          created_at: string;
          id: string;
          reason: string | null;
          slot_time: string;
        };
        Insert: {
          block_date: string;
          created_at?: string;
          id?: string;
          reason?: string | null;
          slot_time: string;
        };
        Update: {
          block_date?: string;
          created_at?: string;
          id?: string;
          reason?: string | null;
          slot_time?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_set_slot_block: {
        Args: { _blocked: boolean; _date: string; _slot_time: string };
        Returns: string;
      };
      create_order: { Args: { payload: Json }; Returns: Json };
      create_order_with_professional: {
        Args: {
          _payload: Json;
          _professional_name: string;
          _professional_phone: string;
          _confirmation_token: string;
        };
        Returns: Json;
      };
      get_availability: {
        Args: { _date: string };
        Returns: {
          slot_time: string;
          state: string;
        }[];
      };
      get_order_summary: {
        Args: { _id: string; _confirmation_token: string };
        Returns: Json;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin"],
    },
  },
} as const;
