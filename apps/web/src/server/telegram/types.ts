/** Bot API update'ining bizga kerakli qismi. */
export interface TgUser { id: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string; language_code?: string }
export interface TgLocation { latitude: number; longitude: number; horizontal_accuracy?: number; live_period?: number }
export interface TgMessage {
  message_id: number;
  date: number;
  chat: { id: number; type: string };
  from?: TgUser;
  text?: string;
  contact?: { phone_number: string; user_id?: number; first_name?: string };
  location?: TgLocation;
  venue?: unknown;
  video_note?: { file_id: string; file_unique_id: string; duration: number; length: number; file_size?: number };
  video?: { file_id: string; duration?: number; mime_type?: string; file_size?: number };
  photo?: Array<{ file_id: string; width: number; height: number; file_size?: number }>;
  caption?: string;
  forward_origin?: unknown;
  forward_date?: number;
}
export interface TgCallback { id: string; from: TgUser; data?: string; message?: { message_id: number; chat: { id: number } } }
export interface TgUpdate { update_id: number; message?: TgMessage; edited_message?: TgMessage; callback_query?: TgCallback }
