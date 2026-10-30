-- BioMed Service Academy — server database schema (PostgreSQL 14+)
-- Chain: manufacturer → model → equipment → components → PM / QA / service / faults / documents.
-- The browser prototype stores the same records in localStorage/IndexedDB; this schema
-- is the production target. JSONB columns hold flexible content so new equipment types
-- need no schema change.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE roles (
  id          serial PRIMARY KEY,
  name        text UNIQUE NOT NULL,              -- trainee, technician, engineer, senior, instructor, admin
  permissions jsonb NOT NULL DEFAULT '[]'
);

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  full_name     text NOT NULL,
  role_id       int  NOT NULL REFERENCES roles(id),
  department    text,
  training_level smallint NOT NULL DEFAULT 1 CHECK (training_level BETWEEN 1 AND 5),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE equipment_categories (
  id    text PRIMARY KEY,                         -- imaging, icu, lab, other, custom…
  name  text NOT NULL,
  icon  text,
  color text
);

-- An equipment *type* (e.g. "Ventilator"). Content lives in related tables + content jsonb.
CREATE TABLE equipment (
  id          text PRIMARY KEY,                   -- ventilator, ct, mri…
  category_id text NOT NULL REFERENCES equipment_categories(id),
  name        text NOT NULL,
  difficulty  text CHECK (difficulty IN ('Beginner','Intermediate','Advanced','Expert')),
  est_hours   numeric(5,1),
  summary     text,
  principle   jsonb DEFAULT '[]',
  parameters  jsonb DEFAULT '[]',
  hazards     jsonb DEFAULT '[]',                 -- [{label,type}]
  diagram     jsonb,                              -- {w,h,nodes,links,zones}
  workflow    jsonb DEFAULT '[]',                 -- animated "how it works" stages
  operation   jsonb DEFAULT '[]',
  safety      jsonb DEFAULT '[]',
  published   boolean NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE manufacturers (
  id   text PRIMARY KEY,
  name text UNIQUE NOT NULL,
  website text
);

CREATE TABLE models (
  id              text PRIMARY KEY,
  manufacturer_id text NOT NULL REFERENCES manufacturers(id),
  equipment_id    text NOT NULL REFERENCES equipment(id),
  name            text NOT NULL,
  software_versions text[],
  architecture    jsonb,                          -- model-specific diagram override
  notes           text,
  UNIQUE (manufacturer_id, name)
);

CREATE TABLE components (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id text NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  model_id     text REFERENCES models(id),        -- NULL = generic for the equipment type
  node_key     text NOT NULL,                     -- matches diagram node id
  name         text NOT NULL,
  function     text, principle text, input text, output text, normal_condition text,
  common_failure text, symptoms text, testing_method text, service_procedure text,
  safety_precautions text,
  spare_parts  jsonb DEFAULT '[]',
  UNIQUE (equipment_id, model_id, node_key)
);

CREATE TABLE training_modules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id text REFERENCES equipment(id),
  tab_key      text NOT NULL,                     -- overview, how, components, operation, pm, qa, …
  title        text NOT NULL,
  level        smallint NOT NULL CHECK (level BETWEEN 1 AND 5),
  sort_order   int NOT NULL DEFAULT 0
);

CREATE TABLE training_lessons (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id  uuid NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
  title      text NOT NULL,
  visual     jsonb,                               -- diagram / image / animation refs
  explanation text,
  interaction jsonb,
  practical_task text,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE pm_procedures (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id text NOT NULL REFERENCES equipment(id),
  model_id     text REFERENCES models(id),
  frequency    text NOT NULL CHECK (frequency IN ('daily','weekly','monthly','quarterly','halfyearly','annual')),
  task         text NOT NULL,
  why          text, tools text, safety text, procedure text, acceptance_criteria text,
  component_id uuid REFERENCES components(id),
  source_document_id uuid,                        -- FK added below
  sort_order   int NOT NULL DEFAULT 0
);

-- Acceptance limits are data, never code: each row cites its protocol/standard source.
CREATE TABLE qa_procedures (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id text NOT NULL REFERENCES equipment(id),
  model_id     text REFERENCES models(id),
  test_key     text NOT NULL,
  test_name    text NOT NULL,
  setup        text, measurement text, unit text, compared text, report_format text,
  limit_mode   text CHECK (limit_mode IN ('abs','pct','check')),
  limit_tolerance numeric,
  limit_source text,                              -- protocol / manual section / standard + revision
  approved_by  uuid REFERENCES users(id),
  approved_at  timestamptz
);

CREATE TABLE error_codes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id text REFERENCES manufacturers(id),   -- NULL = generic training code
  model_id     text REFERENCES models(id),
  equipment_id text NOT NULL REFERENCES equipment(id),
  code         text NOT NULL,
  description  text NOT NULL,
  possible_causes jsonb DEFAULT '[]',
  component_id uuid REFERENCES components(id),
  diagnostic_checks jsonb DEFAULT '[]',
  service_procedure text,
  verification text,
  related_pm_id uuid REFERENCES pm_procedures(id),
  is_training_code boolean NOT NULL DEFAULT false,
  UNIQUE (model_id, code)
);

CREATE TABLE service_cases (
  id           text PRIMARY KEY,
  equipment_id text REFERENCES equipment(id),
  kind         text NOT NULL CHECK (kind IN ('case','scenario')),
  title        text NOT NULL,
  priority     text,
  difficulty_level smallint,
  content      jsonb NOT NULL                     -- ticket, evidence, checks, diagnoses, debrief
);

CREATE TABLE troubleshooting_steps (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id text NOT NULL REFERENCES equipment(id),
  symptom      text NOT NULL,
  stage        text NOT NULL CHECK (stage IN ('symptom','cause','test','measurement','decision','repair','verification')),
  content      jsonb NOT NULL,
  sort_order   int NOT NULL DEFAULT 0
);

CREATE TABLE service_tools (
  id     text PRIMARY KEY,
  name   text NOT NULL,
  purpose text,
  steps  jsonb NOT NULL                           -- select, connect, measure, expected, interpret, document
);

CREATE TABLE documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  doc_type     text NOT NULL CHECK (doc_type IN ('PDF','SOP','Service Manual','User Manual','PM Checklist','QA Manual','Calibration Certificate','Service Report','Training Material')),
  storage_key  text NOT NULL,                     -- object storage path
  mime_type    text, size_bytes bigint, revision text,
  equipment_id text REFERENCES equipment(id),
  model_id     text REFERENCES models(id),
  component_id uuid REFERENCES components(id),
  error_code_id uuid REFERENCES error_codes(id),
  full_text    text,
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(full_text,''))) STORED,
  uploaded_by  uuid REFERENCES users(id),
  uploaded_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX documents_search_idx ON documents USING gin (search_vector);
ALTER TABLE pm_procedures ADD CONSTRAINT pm_source_doc_fk FOREIGN KEY (source_document_id) REFERENCES documents(id);

CREATE TABLE document_bookmarks (
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  page        int,
  PRIMARY KEY (user_id, document_id)
);

-- A physical asset in the hospital.
CREATE TABLE assets (
  id           text PRIMARY KEY,                  -- encoded in the QR code
  model_id     text REFERENCES models(id),
  equipment_id text NOT NULL REFERENCES equipment(id),
  serial_number text NOT NULL,
  location     text,
  installed_on date,
  pm_due_on    date,
  qa_status    text,
  UNIQUE (model_id, serial_number)
);

CREATE TABLE equipment_qr_codes (
  asset_id   text PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  payload    text NOT NULL,                       -- URL …#/asset/<id>
  printed_at timestamptz
);

CREATE TABLE service_records (
  id           text PRIMARY KEY,                  -- SR-xxxxxxx
  asset_id     text REFERENCES assets(id),
  equipment_id text NOT NULL REFERENCES equipment(id),
  complaint text, error_code text, initial_inspection text, diagnosis text, root_cause text,
  action_taken text, parts_replaced text, testing_performed text,
  final_status text, downtime_hours numeric(6,1),
  engineer_id  uuid REFERENCES users(id),
  service_date date NOT NULL,
  signature_key text,
  is_training  boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pm_records (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id    text REFERENCES assets(id),
  equipment_id text NOT NULL REFERENCES equipment(id),
  frequency   text NOT NULL,
  overall     text NOT NULL CHECK (overall IN ('PASS','FAIL')),
  engineer_id uuid REFERENCES users(id),
  performed_on date NOT NULL,
  signature_key text,
  items       jsonb NOT NULL                       -- [{pm_procedure_id, result, status, remarks, photo_key}]
);

CREATE TABLE qa_records (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id    text REFERENCES assets(id),
  qa_procedure_id uuid NOT NULL REFERENCES qa_procedures(id),
  points      jsonb NOT NULL,                      -- [[set, measured], …]
  limit_snapshot jsonb,                            -- limit + source at time of test
  result      text NOT NULL CHECK (result IN ('PASS','FAIL','NO LIMIT')),
  engineer_id uuid REFERENCES users(id),
  performed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE assessments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id text REFERENCES equipment(id),     -- NULL = final / cross-equipment
  title        text NOT NULL,
  level        smallint,
  pass_pct     smallint NOT NULL DEFAULT 70,
  advanced_pct smallint NOT NULL DEFAULT 90
);

CREATE TABLE questions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid REFERENCES assessments(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('mcq','image','component','scenario','practical')),
  domain        text NOT NULL CHECK (domain IN ('knowledge','technical','troubleshooting','safety','documentation')),
  prompt        text NOT NULL,
  media         jsonb,
  explanation   text
);

CREATE TABLE answers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  text        text NOT NULL,
  is_correct  boolean NOT NULL DEFAULT false,
  sort_order  int NOT NULL DEFAULT 0
);

CREATE TABLE training_progress (
  user_id      uuid REFERENCES users(id) ON DELETE CASCADE,
  equipment_id text REFERENCES equipment(id),
  module_key   text NOT NULL,                     -- tab key, component key, scenario id, …
  status       text NOT NULL CHECK (status IN ('visited','completed','passed','failed')),
  score        numeric(5,1),
  domain_scores jsonb,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, equipment_id, module_key)
);

CREATE INDEX ON models (equipment_id);
CREATE INDEX ON components (equipment_id);
CREATE INDEX ON error_codes (equipment_id, code);
CREATE INDEX ON service_records (asset_id, service_date DESC);
CREATE INDEX ON pm_records (asset_id, performed_on DESC);
CREATE INDEX ON training_progress (user_id);
