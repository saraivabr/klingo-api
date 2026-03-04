-- Teleconsultation rooms (WebRTC nativo, sem dependência externa)
CREATE TABLE IF NOT EXISTS teleconsultation_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES appointments(id),
  patient_id UUID REFERENCES patients(id),
  doctor_id UUID REFERENCES doctors(id),
  room_code VARCHAR(20) UNIQUE NOT NULL,
  patient_token VARCHAR(30) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting',
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX teleconsultation_rooms_status_idx ON teleconsultation_rooms(status);
CREATE UNIQUE INDEX teleconsultation_rooms_room_code_idx ON teleconsultation_rooms(room_code);
CREATE UNIQUE INDEX teleconsultation_rooms_patient_token_idx ON teleconsultation_rooms(patient_token);
CREATE INDEX teleconsultation_rooms_scheduled_at_idx ON teleconsultation_rooms(scheduled_at);

-- Prescriptions
CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teleconsultation_id UUID REFERENCES teleconsultation_rooms(id),
  doctor_id UUID REFERENCES doctors(id),
  patient_id UUID REFERENCES patients(id),
  type VARCHAR(20) NOT NULL,
  content JSONB NOT NULL,
  pdf_url TEXT,
  sent_via_whatsapp BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX prescriptions_teleconsultation_id_idx ON prescriptions(teleconsultation_id);
