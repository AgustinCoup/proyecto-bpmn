-- Informes de resultados (PDF) que genera el equipo docente en la tarea "Informe".
-- Idempotente: se puede correr varias veces. No modifica schema.sql ni datos.sql.
-- El id de esta tabla es el que viaja en la variable de proceso `informePdf`
-- y el que queda en curso.informe_pdf.
CREATE TABLE IF NOT EXISTS informe (
    id SERIAL PRIMARY KEY,
    curso_id INTEGER NOT NULL REFERENCES curso(id) ON DELETE CASCADE,
    nombre_archivo VARCHAR(120) NOT NULL,
    contenido BYTEA NOT NULL CHECK (octet_length(contenido) > 0),
    creado_por VARCHAR(100) NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS informe_curso_idx ON informe (curso_id);
