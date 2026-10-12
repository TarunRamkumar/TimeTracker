export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: {
          active: boolean;
          color: string;
          created_at: string;
          currency: string | null;
          description: string | null;
          hourly_rate: number | null;
          icon: string;
          id: string;
          name: string;
          parent_category_ids: string[];
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          color: string;
          created_at?: string;
          currency?: string | null;
          description?: string | null;
          hourly_rate?: number | null;
          icon: string;
          id: string;
          name: string;
          parent_category_ids?: string[];
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          color?: string;
          created_at?: string;
          currency?: string | null;
          description?: string | null;
          hourly_rate?: number | null;
          icon?: string;
          id?: string;
          name?: string;
          parent_category_ids?: string[];
          updated_at?: string;
        };
      };
      integration_accounts: {
        Row: {
          created_at: string;
          external_account_id: string;
          id: string;
          last_synced_at: string | null;
          provider: 'google-calendar' | 'notion' | 'clockify';
          status: 'connected' | 'disconnected' | 'error' | 'syncing';
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          external_account_id: string;
          id: string;
          last_synced_at?: string | null;
          provider: 'google-calendar' | 'notion' | 'clockify';
          status?: 'connected' | 'disconnected' | 'error' | 'syncing';
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          external_account_id?: string;
          id?: string;
          last_synced_at?: string | null;
          provider?: 'google-calendar' | 'notion' | 'clockify';
          status?: 'connected' | 'disconnected' | 'error' | 'syncing';
          updated_at?: string;
        };
      };
      projects: {
        Row: {
          category_id: string;
          created_at: string;
          description: string;
          end_date: string | null;
          id: string;
          name: string;
          start_date: string | null;
          status: 'active' | 'archived' | 'completed';
          updated_at: string;
        };
        Insert: {
          category_id: string;
          created_at?: string;
          description?: string;
          end_date?: string | null;
          id: string;
          name: string;
          start_date?: string | null;
          status?: 'active' | 'archived' | 'completed';
          updated_at?: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          description?: string;
          end_date?: string | null;
          id?: string;
          name?: string;
          start_date?: string | null;
          status?: 'active' | 'archived' | 'completed';
          updated_at?: string;
        };
      };
      tags: {
        Row: {
          color: string;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          color: string;
          created_at?: string;
          id: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
      };
      task_progress_entries: {
        Row: {
          created_at: string;
          duration_minutes: number;
          ended_at: string | null;
          id: string;
          note: string;
          source: 'timer' | 'manual' | 'block-note';
          started_at: string | null;
          task_id: string;
          time_block_id: string | null;
          timer_session_id: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          duration_minutes?: number;
          ended_at?: string | null;
          id: string;
          note?: string;
          source: 'timer' | 'manual' | 'block-note';
          started_at?: string | null;
          task_id: string;
          time_block_id?: string | null;
          timer_session_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          duration_minutes?: number;
          ended_at?: string | null;
          id?: string;
          note?: string;
          source?: 'timer' | 'manual' | 'block-note';
          started_at?: string | null;
          task_id?: string;
          time_block_id?: string | null;
          timer_session_id?: string | null;
          updated_at?: string;
        };
      };
      task_tags: {
        Row: {
          created_at: string;
          tag_id: string;
          task_id: string;
        };
        Insert: {
          created_at?: string;
          tag_id: string;
          task_id: string;
        };
        Update: {
          created_at?: string;
          tag_id?: string;
          task_id?: string;
        };
      };
      tasks: {
        Row: {
          actual_minutes: number;
          calendar_block_id: string | null;
          category_id: string;
          created_at: string;
          description: string;
          due_date: string | null;
          estimated_minutes: number | null;
          id: string;
          priority: 'low' | 'medium' | 'high';
          project_id: string | null;
          scheduled_end: string | null;
          scheduled_start: string | null;
          status: 'inbox' | 'next' | 'doing' | 'waiting' | 'done';
          title: string;
          updated_at: string;
        };
        Insert: {
          actual_minutes?: number;
          calendar_block_id?: string | null;
          category_id: string;
          created_at?: string;
          description?: string;
          due_date?: string | null;
          estimated_minutes?: number | null;
          id: string;
          priority?: 'low' | 'medium' | 'high';
          project_id?: string | null;
          scheduled_end?: string | null;
          scheduled_start?: string | null;
          status?: 'inbox' | 'next' | 'doing' | 'waiting' | 'done';
          title: string;
          updated_at?: string;
        };
        Update: {
          actual_minutes?: number;
          calendar_block_id?: string | null;
          category_id?: string;
          created_at?: string;
          description?: string;
          due_date?: string | null;
          estimated_minutes?: number | null;
          id?: string;
          priority?: 'low' | 'medium' | 'high';
          project_id?: string | null;
          scheduled_end?: string | null;
          scheduled_start?: string | null;
          status?: 'inbox' | 'next' | 'doing' | 'waiting' | 'done';
          title?: string;
          updated_at?: string;
        };
      };
      time_block_notes: {
        Row: {
          content: string;
          created_at: string;
          duration_minutes: number;
          id: string;
          kind: 'work-note' | 'recap';
          task_progress_entry_id: string | null;
          time_block_id: string;
          timer_session_id: string | null;
          updated_at: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          duration_minutes?: number;
          id: string;
          kind?: 'work-note' | 'recap';
          task_progress_entry_id?: string | null;
          time_block_id: string;
          timer_session_id?: string | null;
          updated_at?: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          duration_minutes?: number;
          id?: string;
          kind?: 'work-note' | 'recap';
          task_progress_entry_id?: string | null;
          time_block_id?: string;
          timer_session_id?: string | null;
          updated_at?: string;
        };
      };
      time_block_tags: {
        Row: {
          created_at: string;
          tag_id: string;
          time_block_id: string;
        };
        Insert: {
          created_at?: string;
          tag_id: string;
          time_block_id: string;
        };
        Update: {
          created_at?: string;
          tag_id?: string;
          time_block_id?: string;
        };
      };
      time_blocks: {
        Row: {
          actual_minutes: number;
          calendar_id: string | null;
          category_id: string;
          created_at: string;
          currency: string | null;
          description: string;
          end_at: string;
          google_event_id: string | null;
          hourly_rate: number | null;
          id: string;
          parent_block_id: string | null;
          planned_minutes: number;
          project_boundary_type: 'start' | 'end' | null;
          project_id: string | null;
          recurrence_count: number | null;
          recurrence_days_of_week: number[] | null;
          recurrence_end_type: 'onDate' | 'afterOccurrences' | null;
          recurrence_exclusion_dates: string[] | null;
          recurrence_frequency: 'weekly' | null;
          recurrence_index: number | null;
          recurrence_series_id: string | null;
          recurrence_until: string | null;
          source: 'manual' | 'google-calendar' | 'task' | 'pomodoro';
          start_at: string;
          status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
          task_id: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          actual_minutes?: number;
          calendar_id?: string | null;
          category_id: string;
          created_at?: string;
          currency?: string | null;
          description?: string;
          end_at: string;
          google_event_id?: string | null;
          hourly_rate?: number | null;
          id: string;
          parent_block_id?: string | null;
          planned_minutes?: number;
          project_boundary_type?: 'start' | 'end' | null;
          project_id?: string | null;
          recurrence_count?: number | null;
          recurrence_days_of_week?: number[] | null;
          recurrence_end_type?: 'onDate' | 'afterOccurrences' | null;
          recurrence_exclusion_dates?: string[] | null;
          recurrence_frequency?: 'weekly' | null;
          recurrence_index?: number | null;
          recurrence_series_id?: string | null;
          recurrence_until?: string | null;
          source?: 'manual' | 'google-calendar' | 'task' | 'pomodoro';
          start_at: string;
          status?: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
          task_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          actual_minutes?: number;
          calendar_id?: string | null;
          category_id?: string;
          created_at?: string;
          currency?: string | null;
          description?: string;
          end_at?: string;
          google_event_id?: string | null;
          hourly_rate?: number | null;
          id?: string;
          parent_block_id?: string | null;
          planned_minutes?: number;
          project_boundary_type?: 'start' | 'end' | null;
          project_id?: string | null;
          recurrence_count?: number | null;
          recurrence_days_of_week?: number[] | null;
          recurrence_end_type?: 'onDate' | 'afterOccurrences' | null;
          recurrence_exclusion_dates?: string[] | null;
          recurrence_frequency?: 'weekly' | null;
          recurrence_index?: number | null;
          recurrence_series_id?: string | null;
          recurrence_until?: string | null;
          source?: 'manual' | 'google-calendar' | 'task' | 'pomodoro';
          start_at?: string;
          status?: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
          task_id?: string | null;
          title?: string;
          updated_at?: string;
        };
      };
      timer_sessions: {
        Row: {
          category_id: string;
          created_at: string;
          duration_minutes: number;
          end_time: string | null;
          id: string;
          pomodoro_mode: boolean;
          source: 'web' | 'extension';
          start_time: string;
          task_id: string | null;
          updated_at: string;
        };
        Insert: {
          category_id: string;
          created_at?: string;
          duration_minutes?: number;
          end_time?: string | null;
          id: string;
          pomodoro_mode?: boolean;
          source?: 'web' | 'extension';
          start_time: string;
          task_id?: string | null;
          updated_at?: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          duration_minutes?: number;
          end_time?: string | null;
          id?: string;
          pomodoro_mode?: boolean;
          source?: 'web' | 'extension';
          start_time?: string;
          task_id?: string | null;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
