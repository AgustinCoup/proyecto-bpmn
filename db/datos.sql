BEGIN;
TRUNCATE TABLE cuenta_empresa, curso, empresa RESTART IDENTITY CASCADE;

INSERT INTO empresa (id, nombre, cuit, contacto_nombre, contacto_email, contacto_telefono) VALUES
    (1, 'Agropecuaria Río Cuarto S.A.', '30-71122334-5', 'Martín Gómez', 'mgomez@agroriocuarto.com.ar', '+54 358 411-2233'),
    (2, 'Metalúrgica del Sur S.R.L.', '30-72233445-6', 'Laura Fernández', 'lfernandez@metalsur.com.ar', '+54 358 422-3344');

INSERT INTO cuenta_empresa (id, empresa_id, usuario, clave_hash) VALUES
    (1, 1, 'emp_30711223345', 'test');

INSERT INTO curso (id, empresa_id, tematica, descripcion, cantidad_participantes, fechas_preferidas, estado, process_instance_id) VALUES
    (1, 1, 'Seguridad e Higiene', 'Capacitación obligatoria en planta.', 25, 'Diciembre 2026', 'EN_PROCESO', 'proc-inst-demo-001');

SELECT setval(pg_get_serial_sequence('empresa', 'id'), COALESCE((SELECT MAX(id) FROM empresa), 1));
SELECT setval(pg_get_serial_sequence('cuenta_empresa', 'id'), COALESCE((SELECT MAX(id) FROM cuenta_empresa), 1));
SELECT setval(pg_get_serial_sequence('curso', 'id'), COALESCE((SELECT MAX(id) FROM curso), 1));
COMMIT;