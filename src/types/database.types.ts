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
      conversations: {
        Row: {
          created_at: string
          id: string
          messages: Json
          products: Json
          tenant_id: string | null
          timestamp: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          messages?: Json
          products?: Json
          tenant_id?: string | null
          timestamp?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          products?: Json
          tenant_id?: string | null
          timestamp?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      libraries: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "libraries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_usage_events: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          input_tokens: number
          metadata: Json | null
          model: string
          output_tokens: number
          tenant_id: string | null
          total_tokens: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          input_tokens?: number
          metadata?: Json | null
          model: string
          output_tokens?: number
          tenant_id?: string | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          input_tokens?: number
          metadata?: Json | null
          model?: string
          output_tokens?: number
          tenant_id?: string | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "llm_usage_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      magrit_background_library: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string
          id: string
          name: string
          ordering_index: number
          tags: string[]
          thumbnail_url: string | null
          url: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string
          id?: string
          name: string
          ordering_index?: number
          tags?: string[]
          thumbnail_url?: string | null
          url: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string
          id?: string
          name?: string
          ordering_index?: number
          tags?: string[]
          thumbnail_url?: string | null
          url?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          id: string
          product_config: Json | null
          product_name: string
          quote_id: string | null
          reference: string
          status: string
          total_ht: number | null
          total_ttc: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_config?: Json | null
          product_name: string
          quote_id?: string | null
          reference: string
          status?: string
          total_ht?: number | null
          total_ttc?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_config?: Json | null
          product_name?: string
          quote_id?: string | null
          reference?: string
          status?: string
          total_ht?: number | null
          total_ttc?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      pim_candidates: {
        Row: {
          clariprint_normalized: Json | null
          created_at: string
          id: string
          llm_enrichment: Json | null
          merged_into: string | null
          raw_config: Json
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_quote_id: string | null
          source_tenant_id: string | null
          source_user_id: string | null
          status: string
          suggested_gamme: string | null
          suggested_kind: string | null
          updated_at: string
        }
        Insert: {
          clariprint_normalized?: Json | null
          created_at?: string
          id?: string
          llm_enrichment?: Json | null
          merged_into?: string | null
          raw_config: Json
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_quote_id?: string | null
          source_tenant_id?: string | null
          source_user_id?: string | null
          status?: string
          suggested_gamme?: string | null
          suggested_kind?: string | null
          updated_at?: string
        }
        Update: {
          clariprint_normalized?: Json | null
          created_at?: string
          id?: string
          llm_enrichment?: Json | null
          merged_into?: string | null
          raw_config?: Json
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_quote_id?: string | null
          source_tenant_id?: string | null
          source_user_id?: string | null
          status?: string
          suggested_gamme?: string | null
          suggested_kind?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pim_candidates_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "product_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pim_candidates_source_quote_id_fkey"
            columns: ["source_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pim_candidates_source_tenant_id_fkey"
            columns: ["source_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_definitions: {
        Row: {
          benefits: Json | null
          clariprint_ref: string | null
          commercial_pitch: string | null
          created_at: string
          description_template: string | null
          faq: Json | null
          gabarit_pdf_url: string | null
          gamme_slug: string
          generated_by: string | null
          h1_template: string | null
          id: string
          image_url: string | null
          keywords: string[] | null
          last_ordered_at: string | null
          last_reviewed_at: string | null
          locale: string
          mockup_3d_url: string | null
          name: string | null
          order_count: number | null
          quality_score: number | null
          schema_org: Json | null
          schema_org_type: string | null
          seo_description: string | null
          seo_keywords: string[] | null
          seo_title: string | null
          short_description_template: string | null
          technical_spec: Json | null
          title_template: string | null
          updated_at: string
          usage_examples: Json | null
          use_cases: Json | null
          validated_by: string | null
          variation_filter: Json
          version: number
        }
        Insert: {
          benefits?: Json | null
          clariprint_ref?: string | null
          commercial_pitch?: string | null
          created_at?: string
          description_template?: string | null
          faq?: Json | null
          gabarit_pdf_url?: string | null
          gamme_slug: string
          generated_by?: string | null
          h1_template?: string | null
          id?: string
          image_url?: string | null
          keywords?: string[] | null
          last_ordered_at?: string | null
          last_reviewed_at?: string | null
          locale?: string
          mockup_3d_url?: string | null
          name?: string | null
          order_count?: number | null
          quality_score?: number | null
          schema_org?: Json | null
          schema_org_type?: string | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          short_description_template?: string | null
          technical_spec?: Json | null
          title_template?: string | null
          updated_at?: string
          usage_examples?: Json | null
          use_cases?: Json | null
          validated_by?: string | null
          variation_filter?: Json
          version?: number
        }
        Update: {
          benefits?: Json | null
          clariprint_ref?: string | null
          commercial_pitch?: string | null
          created_at?: string
          description_template?: string | null
          faq?: Json | null
          gabarit_pdf_url?: string | null
          gamme_slug?: string
          generated_by?: string | null
          h1_template?: string | null
          id?: string
          image_url?: string | null
          keywords?: string[] | null
          last_ordered_at?: string | null
          last_reviewed_at?: string | null
          locale?: string
          mockup_3d_url?: string | null
          name?: string | null
          order_count?: number | null
          quality_score?: number | null
          schema_org?: Json | null
          schema_org_type?: string | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          short_description_template?: string | null
          technical_spec?: Json | null
          title_template?: string | null
          updated_at?: string
          usage_examples?: Json | null
          use_cases?: Json | null
          validated_by?: string | null
          variation_filter?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_definitions_gamme_slug_fkey"
            columns: ["gamme_slug"]
            isOneToOne: false
            referencedRelation: "product_gammes"
            referencedColumns: ["slug"]
          },
        ]
      }
      product_gammes: {
        Row: {
          created_at: string
          display_order: number
          id: string
          image_url: string | null
          matching_rules: Json
          name: string
          parent_slug: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          matching_rules?: Json
          name: string
          parent_slug?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          matching_rules?: Json
          name?: string
          parent_slug?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_gammes_parent_slug_fkey"
            columns: ["parent_slug"]
            isOneToOne: false
            referencedRelation: "product_gammes"
            referencedColumns: ["slug"]
          },
        ]
      }
      product_library: {
        Row: {
          active: boolean
          category: string
          config: Json
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          library_id: string | null
          name: string
          price_ht: number
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          category?: string
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          library_id?: string | null
          name: string
          price_ht?: number
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          category?: string
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          library_id?: string | null
          name?: string
          price_ht?: number
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_library_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_library_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_templates: {
        Row: {
          accent_color: string | null
          address: string | null
          brand_color: string | null
          city: string | null
          company_name: string | null
          country: string | null
          created_at: string
          email: string | null
          font_family: string | null
          footer_text: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          postal_code: string | null
          siret: string | null
          style: string | null
          tenant_id: string | null
          tva_number: string | null
          updated_at: string
          user_id: string
          validity_days: number | null
          website: string | null
        }
        Insert: {
          accent_color?: string | null
          address?: string | null
          brand_color?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          font_family?: string | null
          footer_text?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          postal_code?: string | null
          siret?: string | null
          style?: string | null
          tenant_id?: string | null
          tva_number?: string | null
          updated_at?: string
          user_id: string
          validity_days?: number | null
          website?: string | null
        }
        Update: {
          accent_color?: string | null
          address?: string | null
          brand_color?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          font_family?: string | null
          footer_text?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          siret?: string | null
          style?: string | null
          tenant_id?: string | null
          tva_number?: string | null
          updated_at?: string
          user_id?: string
          validity_days?: number | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          product_config: Json | null
          product_name: string
          reference: string
          status: string
          tenant_id: string | null
          total_ht: number | null
          total_ttc: number | null
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          product_config?: Json | null
          product_name: string
          reference: string
          status?: string
          tenant_id?: string | null
          total_ht?: number | null
          total_ttc?: number | null
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          product_config?: Json | null
          product_name?: string
          reference?: string
          status?: string
          tenant_id?: string | null
          total_ht?: number | null
          total_ttc?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_gamme_visual_preferences: {
        Row: {
          background_library_id: string | null
          background_source: string
          background_url: string | null
          gamme_slug: string
          id: string
          primary_color: string | null
          shop_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          background_library_id?: string | null
          background_source?: string
          background_url?: string | null
          gamme_slug: string
          id?: string
          primary_color?: string | null
          shop_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          background_library_id?: string | null
          background_source?: string
          background_url?: string | null
          gamme_slug?: string
          id?: string
          primary_color?: string | null
          shop_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_gamme_visual_preferences_background_library_id_fkey"
            columns: ["background_library_id"]
            isOneToOne: false
            referencedRelation: "magrit_background_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_gamme_visual_preferences_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_orders: {
        Row: {
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string | null
          id: string
          items: Json
          notes: string | null
          shop_id: string
          status: string
          total_ht: number
          total_ttc: number
        }
        Insert: {
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          id?: string
          items?: Json
          notes?: string | null
          shop_id: string
          status?: string
          total_ht?: number
          total_ttc?: number
        }
        Update: {
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          id?: string
          items?: Json
          notes?: string | null
          shop_id?: string
          status?: string
          total_ht?: number
          total_ttc?: number
        }
        Relationships: [
          {
            foreignKeyName: "shop_orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_products: {
        Row: {
          category: string
          config: Json
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          name: string
          price_ht: number
          product_id: string | null
          shop_id: string
          tenant_id: string | null
        }
        Insert: {
          category?: string
          config?: Json
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          name: string
          price_ht?: number
          product_id?: string | null
          shop_id: string
          tenant_id?: string | null
        }
        Update: {
          category?: string
          config?: Json
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          name?: string
          price_ht?: number
          product_id?: string | null
          shop_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_visual_preferences: {
        Row: {
          background_library_id: string | null
          background_source: string
          background_url: string | null
          id: string
          primary_color: string
          shop_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          background_library_id?: string | null
          background_source?: string
          background_url?: string | null
          id?: string
          primary_color?: string
          shop_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          background_library_id?: string | null
          background_source?: string
          background_url?: string | null
          id?: string
          primary_color?: string
          shop_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_visual_preferences_background_library_id_fkey"
            columns: ["background_library_id"]
            isOneToOne: false
            referencedRelation: "magrit_background_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_visual_preferences_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          active: boolean
          address: string | null
          contact_email: string | null
          created_at: string
          description: string | null
          excluded_product_ids: string[]
          id: string
          library_ids: string[]
          logo_url: string | null
          name: string
          owner_user_id: string
          slug: string
          tenant_id: string | null
          theme: Json
        }
        Insert: {
          active?: boolean
          address?: string | null
          contact_email?: string | null
          created_at?: string
          description?: string | null
          excluded_product_ids?: string[]
          id?: string
          library_ids?: string[]
          logo_url?: string | null
          name: string
          owner_user_id: string
          slug: string
          tenant_id?: string | null
          theme?: Json
        }
        Update: {
          active?: boolean
          address?: string | null
          contact_email?: string | null
          created_at?: string
          description?: string | null
          excluded_product_ids?: string[]
          id?: string
          library_ids?: string[]
          logo_url?: string | null
          name?: string
          owner_user_id?: string
          slug?: string
          tenant_id?: string | null
          theme?: Json
        }
        Relationships: [
          {
            foreignKeyName: "shops_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_gamme_subscriptions: {
        Row: {
          active: boolean
          added_at: string
          added_by: string | null
          display_order: number
          gamme_slug: string
          tenant_id: string
        }
        Insert: {
          active?: boolean
          added_at?: string
          added_by?: string | null
          display_order?: number
          gamme_slug: string
          tenant_id: string
        }
        Update: {
          active?: boolean
          added_at?: string
          added_by?: string | null
          display_order?: number
          gamme_slug?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_gamme_subscriptions_gamme_slug_fkey"
            columns: ["gamme_slug"]
            isOneToOne: false
            referencedRelation: "product_gammes"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "tenant_gamme_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invitations: {
        Row: {
          accepted_at: string | null
          access_scope: string
          allowed_shop_ids: string[]
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          pending_role_ids: string[]
          permissions: Json
          role: string
          tenant_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          access_scope?: string
          allowed_shop_ids?: string[]
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          pending_role_ids?: string[]
          permissions?: Json
          role?: string
          tenant_id: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          access_scope?: string
          allowed_shop_ids?: string[]
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          pending_role_ids?: string[]
          permissions?: Json
          role?: string
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_member_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          performed_by: string
          target_user_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          performed_by: string
          target_user_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          performed_by?: string
          target_user_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_member_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          access_scope: string
          allowed_shop_ids: string[]
          invited_by: string | null
          joined_at: string
          permissions: Json
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          access_scope?: string
          allowed_shop_ids?: string[]
          invited_by?: string | null
          joined_at?: string
          permissions?: Json
          role?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          access_scope?: string
          allowed_shop_ids?: string[]
          invited_by?: string | null
          joined_at?: string
          permissions?: Json
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_order_items: {
        Row: {
          canva_asset_url: string | null
          clariprint_options: Json
          created_at: string
          id: string
          line_total_ht: number
          order_id: string
          product_id: string | null
          product_label: string
          quantity: number
          unit_price_ht: number
        }
        Insert: {
          canva_asset_url?: string | null
          clariprint_options: Json
          created_at?: string
          id?: string
          line_total_ht: number
          order_id: string
          product_id?: string | null
          product_label: string
          quantity: number
          unit_price_ht: number
        }
        Update: {
          canva_asset_url?: string | null
          clariprint_options?: Json
          created_at?: string
          id?: string
          line_total_ht?: number
          order_id?: string
          product_id?: string | null
          product_label?: string
          quantity?: number
          unit_price_ht?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "tenant_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_order_items_product_id_fk"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_library"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_order_role_events: {
        Row: {
          actor_user_id: string | null
          event_type: string
          id: string
          occurred_at: string
          order_id: string
          payload: Json
          role_definition_id: string | null
          user_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          event_type: string
          id?: string
          occurred_at?: string
          order_id: string
          payload?: Json
          role_definition_id?: string | null
          user_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          event_type?: string
          id?: string
          occurred_at?: string
          order_id?: string
          payload?: Json
          role_definition_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_order_role_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "tenant_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_order_role_events_role_definition_id_fkey"
            columns: ["role_definition_id"]
            isOneToOne: false
            referencedRelation: "tenant_role_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_order_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          order_id: string
          revoked_at: string | null
          revoked_by: string | null
          role_definition_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          order_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          role_definition_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          order_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          role_definition_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_order_roles_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "tenant_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_order_roles_role_definition_id_fkey"
            columns: ["role_definition_id"]
            isOneToOne: false
            referencedRelation: "tenant_role_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_order_status_definitions: {
        Row: {
          archived_at: string | null
          code: string
          color: string
          created_at: string
          id: string
          is_terminal: boolean
          label: string
          ordering_index: number
          tenant_id: string
        }
        Insert: {
          archived_at?: string | null
          code: string
          color?: string
          created_at?: string
          id?: string
          is_terminal?: boolean
          label: string
          ordering_index?: number
          tenant_id: string
        }
        Update: {
          archived_at?: string | null
          code?: string
          color?: string
          created_at?: string
          id?: string
          is_terminal?: boolean
          label?: string
          ordering_index?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_order_status_definitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_order_status_events: {
        Row: {
          actor_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["tenant_order_status"] | null
          id: string
          metadata: Json
          order_id: string
          reason: string | null
          to_status: Database["public"]["Enums"]["tenant_order_status"]
        }
        Insert: {
          actor_id: string
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["tenant_order_status"]
            | null
          id?: string
          metadata?: Json
          order_id: string
          reason?: string | null
          to_status: Database["public"]["Enums"]["tenant_order_status"]
        }
        Update: {
          actor_id?: string
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["tenant_order_status"]
            | null
          id?: string
          metadata?: Json
          order_id?: string
          reason?: string | null
          to_status?: Database["public"]["Enums"]["tenant_order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "tenant_order_status_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "tenant_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_order_status_transitions: {
        Row: {
          archived_at: string | null
          created_at: string
          from_status_code: string
          id: string
          required_capability: string | null
          self_service_creator: boolean
          tenant_id: string
          to_status_code: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          from_status_code: string
          id?: string
          required_capability?: string | null
          self_service_creator?: boolean
          tenant_id: string
          to_status_code: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          from_status_code?: string
          id?: string
          required_capability?: string | null
          self_service_creator?: boolean
          tenant_id?: string
          to_status_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_order_status_transitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_orders: {
        Row: {
          cancelled_at: string | null
          created_at: string
          created_by: string
          currency: string
          id: string
          invoice_number: string | null
          invoice_status: string | null
          notes: string | null
          pa_id: string | null
          ppf_message_id: string | null
          shop_id: string
          status: Database["public"]["Enums"]["tenant_order_status"]
          stripe_payment_intent_id: string | null
          tenant_id: string
          total_ht: number
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          created_by: string
          currency?: string
          id?: string
          invoice_number?: string | null
          invoice_status?: string | null
          notes?: string | null
          pa_id?: string | null
          ppf_message_id?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["tenant_order_status"]
          stripe_payment_intent_id?: string | null
          tenant_id: string
          total_ht: number
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          invoice_number?: string | null
          invoice_status?: string | null
          notes?: string | null
          pa_id?: string | null
          ppf_message_id?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["tenant_order_status"]
          stripe_payment_intent_id?: string | null
          tenant_id?: string
          total_ht?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_role_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          revoked_at: string | null
          revoked_by: string | null
          role_definition_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          role_definition_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          role_definition_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_role_assignments_role_definition_id_fkey"
            columns: ["role_definition_id"]
            isOneToOne: false
            referencedRelation: "tenant_role_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_role_definitions: {
        Row: {
          archived_at: string | null
          capabilities: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          notify_policy: string
          ordering_index: number
          scope: string
          scope_shop_id: string | null
          tenant_id: string
        }
        Insert: {
          archived_at?: string | null
          capabilities?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          notify_policy?: string
          ordering_index?: number
          scope?: string
          scope_shop_id?: string | null
          tenant_id: string
        }
        Update: {
          archived_at?: string | null
          capabilities?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          notify_policy?: string
          ordering_index?: number
          scope?: string
          scope_shop_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_role_definitions_scope_shop_id_fkey"
            columns: ["scope_shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_role_definitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_slug_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          expires_at: string
          id: string
          new_slug: string
          old_slug: string
          tenant_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          expires_at?: string
          id?: string
          new_slug: string
          old_slug: string
          tenant_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          expires_at?: string
          id?: string
          new_slug?: string
          old_slug?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_slug_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          is_system_tenant: boolean
          name: string
          parent_tenant_id: string | null
          plan: string
          settings: Json
          siren: string | null
          siren_data: Json | null
          slug: string
          tax_regime: Database["public"]["Enums"]["tax_regime_enum"]
          updated_at: string
          verified: boolean
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_system_tenant?: boolean
          name: string
          parent_tenant_id?: string | null
          plan?: string
          settings?: Json
          siren?: string | null
          siren_data?: Json | null
          slug: string
          tax_regime?: Database["public"]["Enums"]["tax_regime_enum"]
          updated_at?: string
          verified?: boolean
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_system_tenant?: boolean
          name?: string
          parent_tenant_id?: string | null
          plan?: string
          settings?: Json
          siren?: string | null
          siren_data?: Json | null
          slug?: string
          tax_regime?: Database["public"]["Enums"]["tax_regime_enum"]
          updated_at?: string
          verified?: boolean
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_parent_tenant_id_fkey"
            columns: ["parent_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          default_delivery_zone: string
          default_quote_template_id: string | null
          is_admin: boolean
          language: string
          last_tenant_id: string | null
          notifications_email: boolean
          plan: string
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          default_delivery_zone?: string
          default_quote_template_id?: string | null
          is_admin?: boolean
          language?: string
          last_tenant_id?: string | null
          notifications_email?: boolean
          plan?: string
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          default_delivery_zone?: string
          default_quote_template_id?: string | null
          is_admin?: boolean
          language?: string
          last_tenant_id?: string | null
          notifications_email?: boolean
          plan?: string
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_last_tenant_id_fkey"
            columns: ["last_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_tenant_invitation: { Args: { p_token: string }; Returns: string }
      assign_tenant_order_role: {
        Args: {
          p_order_id: string
          p_role_definition_id: string
          p_user_id: string
        }
        Returns: string
      }
      bootstrap_magrit_admin: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      create_tenant_with_owner: {
        Args: { p_name: string; p_parent_tenant_id?: string; p_slug: string }
        Returns: string
      }
      current_user_can_access_shop: {
        Args: { p_shop_id: string }
        Returns: boolean
      }
      current_user_tenant_ids: { Args: never; Returns: string[] }
      get_order_audit_trail: {
        Args: { p_order_id: string }
        Returns: {
          actor_email: string
          actor_id: string
          event_id: string
          event_type: string
          kind: string
          occurred_at: string
          order_id: string
          payload: Json
          role_name: string
        }[]
      }
      get_subtenant_kpis: {
        Args: { p_parent_tenant_id: string }
        Returns: {
          created_at: string
          member_count: number
          month_ca_ht: number
          month_order_count: number
          tenant_id: string
          tenant_name: string
          tenant_slug: string
        }[]
      }
      get_tenant_llm_usage: {
        Args: {
          p_period_end?: string
          p_period_start?: string
          p_tenant_id: string
        }
        Returns: {
          request_count: number
          total_tokens: number
          user_id: string
        }[]
      }
      get_tenant_members_with_email: {
        Args: { p_tenant_id: string }
        Returns: {
          access_scope: string
          allowed_shop_ids: string[]
          email: string
          joined_at: string
          permissions: Json
          role: string
          user_id: string
        }[]
      }
      get_user_llm_usage: {
        Args: {
          p_period_end?: string
          p_period_start?: string
          p_user_id: string
        }
        Returns: {
          input_tokens: number
          output_tokens: number
          request_count: number
          total_tokens: number
        }[]
      }
      get_user_subtenants: {
        Args: { p_parent_tenant_id: string }
        Returns: {
          created_at: string
          id: string
          is_system_tenant: boolean
          name: string
          parent_tenant_id: string | null
          plan: string
          settings: Json
          siren: string | null
          siren_data: Json | null
          slug: string
          tax_regime: Database["public"]["Enums"]["tax_regime_enum"]
          updated_at: string
          verified: boolean
          verified_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "tenants"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      is_subtenant_member_direct: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      is_subtenant_member_inherited: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      move_user_between_subtenants: {
        Args: {
          p_from_tenant_id: string
          p_to_tenant_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      resolve_shop_background: {
        Args: { p_gamme_slug: string; p_shop_id: string }
        Returns: {
          background_url: string
          primary_color: string
          source: string
        }[]
      }
      resolve_tenant_slug: { Args: { p_slug: string }; Returns: string }
      revoke_tenant_order_role: {
        Args: { p_assignment_id: string }
        Returns: string
      }
      seed_tenant_status_transitions: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      tenant_active_gammes: { Args: { p_tenant_id: string }; Returns: string[] }
      transition_tenant_order_status: {
        Args: {
          p_new_status_code: string
          p_order_id: string
          p_reason?: string
        }
        Returns: string
      }
      update_tenant_order_role_capabilities: {
        Args: { p_capabilities: Json; p_role_definition_id: string }
        Returns: undefined
      }
      update_tenant_order_status: {
        Args: {
          p_new_status: Database["public"]["Enums"]["tenant_order_status"]
          p_order_id: string
          p_reason?: string
        }
        Returns: string
      }
      user_can_create_order: { Args: { p_tenant_id: string }; Returns: boolean }
      user_can_manage_shop_assets: {
        Args: { p_shop_id: string }
        Returns: boolean
      }
      user_can_validate_order: {
        Args: { p_order_id: string }
        Returns: boolean
      }
      user_has_capability: {
        Args: { p_capability: string; p_tenant_id: string }
        Returns: boolean
      }
      user_has_order_role: {
        Args: { p_capability: string; p_order_id: string }
        Returns: boolean
      }
      user_role_in_tenant: { Args: { p_tenant_id: string }; Returns: string }
    }
    Enums: {
      tax_regime_enum:
        | "metropole_fr"
        | "dom_tom"
        | "franchise_tva"
        | "export_eu"
        | "export_world"
      tenant_order_status:
        | "draft"
        | "validated"
        | "in_production"
        | "shipped"
        | "delivered"
        | "invoiced"
        | "cancelled"
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
      tax_regime_enum: [
        "metropole_fr",
        "dom_tom",
        "franchise_tva",
        "export_eu",
        "export_world",
      ],
      tenant_order_status: [
        "draft",
        "validated",
        "in_production",
        "shipped",
        "delivered",
        "invoiced",
        "cancelled",
      ],
    },
  },
} as const

