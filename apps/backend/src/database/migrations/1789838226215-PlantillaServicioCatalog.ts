import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlantillaServicioCatalog1789838226215 implements MigrationInterface {
  name = 'PlantillaServicioCatalog1789838226215';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Nota: el auto-generador de TypeORM propuso `DROP CONSTRAINT
    // "no_traslape_reserva_usuario"` aquí — es un falso positivo: esa
    // constraint EXCLUDE se creó con SQL crudo en la migración
    // ReservaSinTraslapeExclusionConstraint (TypeORM no la expresa vía
    // decorador, así que el diff no la reconoce como parte de la
    // entidad). Se removió esa línea para no destruir la defensa contra
    // doble-booking; ver también el down() de esta migración.
    await queryRunner.query(
      `CREATE TYPE "public"."plantillas_servicio_tipo_negocio_enum" AS ENUM('barberia', 'salon_belleza', 'clinica', 'clinica_dental', 'spa', 'estudio_tatuajes', 'entrenamiento_personal', 'estetica', 'veterinaria_grooming', 'otro')`,
    );
    await queryRunner.query(
      `CREATE TABLE "plantillas_servicio" ("creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id_plantilla" uuid NOT NULL DEFAULT uuid_generate_v4(), "tipo_negocio" "public"."plantillas_servicio_tipo_negocio_enum" NOT NULL, "nombre" character varying(150) NOT NULL, "duracion_minutos_sugerida" integer NOT NULL, "orden" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_7cf51b0d736049e13eecea26849" PRIMARY KEY ("id_plantilla"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_704979ff805a0b73a4ebd80ba0" ON "plantillas_servicio" ("tipo_negocio") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_704979ff805a0b73a4ebd80ba0"`);
    await queryRunner.query(`DROP TABLE "plantillas_servicio"`);
    await queryRunner.query(`DROP TYPE "public"."plantillas_servicio_tipo_negocio_enum"`);
  }
}
