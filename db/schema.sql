CREATE TABLE IF NOT EXISTS empresa (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    cuit VARCHAR(20) NOT NULL UNIQUE,
    contacto_nombre VARCHAR(150) NOT NULL,
    contacto_email VARCHAR(150) NOT NULL,
    contacto_telefono VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS cuenta_empresa (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL UNIQUE REFERENCES empresa(id) ON DELETE CASCADE,
    usuario VARCHAR(100) NOT NULL UNIQUE,
    clave_hash VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS curso (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresa(id) ON DELETE RESTRICT,
    tematica VARCHAR(200) NOT NULL,
    descripcion TEXT NOT NULL,
    cantidad_participantes INTEGER NOT NULL CHECK (cantidad_participantes > 0),
    fechas_preferidas VARCHAR(255) NOT NULL,
    nombre VARCHAR(200),
    programa TEXT,
    presupuesto NUMERIC(12, 2),
    fecha_inicio TIMESTAMP WITH TIME ZONE,
    fecha_fin TIMESTAMP WITH TIME ZONE,
    informe_pdf INTEGER,
    estado VARCHAR(30) NOT NULL DEFAULT 'EN_PROCESO',
    process_instance_id VARCHAR(64) UNIQUE,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);