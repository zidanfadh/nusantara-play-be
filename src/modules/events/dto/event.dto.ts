import { IsOptional, IsObject } from 'class-validator';
import { EventJenis, EventStatus } from '../entities/event.entity';

export class EventDto {
  id: string;
  nama: string;
  deskripsi: string;
  jenis: EventJenis;
  type?: EventJenis; // Alias
  status: EventStatus;
  tanggal_mulai: Date;
  tanggal_selesai: Date;
  lokasi: string;
  daerah_id: string;
  latitude?: number;
  longitude?: number;
  kuota_peserta?: number;
  jumlah_peserta: number;
  banner_url?: string;
  galeri_foto?: string[];
  persyaratan?: string;
  formulir_custom?: Record<string, any>;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  published_at?: Date;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  daerah?: any;
  organizer?: any;
  registrationCount?: number;
  userRegistrationStatus?: string;
}

export class EventRegistrationDto {
  id: string;
  event_id: string;
  user_id: string;
  data_pendaftaran: Record<string, any>;
  status: string;
  checked_in_at?: Date;
  certificate_id?: string;
  created_at: Date;
  updated_at: Date;
  event?: any;
  user?: any;
}

export class RegisterEventDto {
  @IsOptional()
  @IsObject()
  data_pendaftaran?: Record<string, any>;
}
