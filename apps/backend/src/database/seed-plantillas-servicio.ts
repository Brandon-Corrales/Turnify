import 'reflect-metadata';
import { AppDataSource } from './data-source';
import { PlantillaServicio, TipoNegocio } from './entities';

/**
 * Catálogo estático de servicios sugeridos por vertical (punto 2 del
 * brief). No es dato de un negocio ni editable vía API — se siembra una
 * sola vez (o se re-siembra completo si el equipo actualiza la lista en
 * docs/spec.md) y el onboarding del frontend solo lo LEE.
 *
 * Duraciones son valores por defecto razonables; el admin los edita en su
 * propio SERVICIO después de aceptarlos durante el onboarding.
 */
const CATALOGO: Record<Exclude<TipoNegocio, TipoNegocio.OTRO>, Array<[string, number]>> = {
  [TipoNegocio.BARBERIA]: [
    ['Corte de cabello', 30],
    ['Corte + barba', 45],
    ['Afeitado clásico', 20],
    ['Diseño de barba', 20],
    ['Corte infantil', 25],
    ['Corte a máquina (fade)', 30],
    ['Tratamiento capilar', 40],
  ],
  [TipoNegocio.SALON_BELLEZA]: [
    ['Corte y peinado', 45],
    ['Coloración', 90],
    ['Mechas/reflejos', 120],
    ['Manicure', 40],
    ['Pedicure', 45],
    ['Tratamiento capilar', 40],
    ['Alisado/keratina', 150],
    ['Maquillaje', 45],
    ['Depilación de cejas', 15],
  ],
  [TipoNegocio.CLINICA]: [
    ['Consulta general', 20],
    ['Consulta de seguimiento', 15],
    ['Control/chequeo', 20],
    ['Consulta de urgencia', 30],
    ['Certificado médico', 10],
    ['Toma de signos vitales', 10],
    ['Consulta de especialidad', 30],
  ],
  [TipoNegocio.CLINICA_DENTAL]: [
    ['Consulta/valoración inicial', 30],
    ['Limpieza dental', 45],
    ['Obturación (resina)', 45],
    ['Endodoncia (tratamiento de conducto)', 60],
    ['Extracción', 30],
    ['Blanqueamiento dental', 60],
    ['Ortodoncia (consulta/ajuste)', 30],
    ['Urgencia dental', 30],
  ],
  [TipoNegocio.SPA]: [
    ['Masaje relajante', 60],
    ['Masaje terapéutico', 60],
    ['Facial', 45],
    ['Exfoliación corporal', 45],
    ['Aromaterapia', 60],
    ['Piedras calientes', 75],
    ['Tratamiento corporal reafirmante', 60],
  ],
  [TipoNegocio.ESTUDIO_TATUAJES]: [
    ['Consulta de tatuaje', 20],
    ['Sesión de tatuaje', 120],
    ['Piercing', 20],
    ['Retoque', 30],
    ['Tatuaje pequeño (flash)', 45],
  ],
  [TipoNegocio.ENTRENAMIENTO_PERSONAL]: [
    ['Sesión individual', 60],
    ['Evaluación física inicial', 45],
    ['Clase grupal', 60],
    ['Seguimiento/plan de entrenamiento', 30],
    ['Sesión de acondicionamiento', 45],
  ],
  [TipoNegocio.ESTETICA]: [
    ['Limpieza facial', 45],
    ['Depilación', 30],
    ['Tratamiento anti-edad', 60],
    ['Radiofrecuencia', 45],
    ['Peeling químico', 30],
    ['Depilación láser', 30],
  ],
  [TipoNegocio.VETERINARIA_GROOMING]: [
    ['Baño y corte', 60],
    ['Consulta veterinaria', 20],
    ['Vacunación', 15],
    ['Desparasitación', 15],
    ['Corte de uñas', 15],
    ['Estética canina/felina', 60],
  ],
};

async function seedPlantillasServicio() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(PlantillaServicio);

  // Catálogo estático re-sembrable: se reemplaza completo en cada corrida
  // (no hay FKs hacia esta tabla — un SERVICIO real ya creado desde una
  // plantilla es una fila propia e independiente) para que un ajuste en
  // docs/spec.md se refleje corriendo el seed de nuevo, sin duplicar filas.
  await repo.clear();

  const filas = Object.entries(CATALOGO).flatMap(([tipoNegocio, servicios]) =>
    servicios.map(([nombre, duracionMinutosSugerida], orden) =>
      repo.create({
        tipoNegocio: tipoNegocio as TipoNegocio,
        nombre,
        duracionMinutosSugerida,
        orden,
      }),
    ),
  );

  await repo.save(filas);
  console.log(`Catálogo de plantillas de servicio sembrado: ${filas.length} filas.`);

  await AppDataSource.destroy();
}

seedPlantillasServicio().catch(async (err) => {
  console.error('Error al sembrar el catálogo de plantillas de servicio:', err);
  await AppDataSource.destroy();
  process.exit(1);
});
