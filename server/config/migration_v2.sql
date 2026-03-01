CREATE TABLE IF NOT EXISTS proyectos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    creado_por INT,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Si 'tests' ya existe, le añadimos proyecto_id.
-- Como algunos motores no soportan IF NOT EXISTS en ADD COLUMN, esto puede fallar si ya existe,
-- pero para este entorno lo corremos asumiendo que no se ha añadido.
ALTER TABLE tests ADD COLUMN proyecto_id INT NULL;
ALTER TABLE tests ADD CONSTRAINT fk_tests_proyecto FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE;

-- Insertar un proyecto por defecto
INSERT INTO proyectos (nombre, descripcion) VALUES ('Proyecto Base', 'Proyecto principal para agrupar las pruebas existentes');

-- Mover todos los tests actuales al proyecto por defecto
UPDATE tests SET proyecto_id = (SELECT id FROM proyectos LIMIT 1) WHERE proyecto_id IS NULL;
