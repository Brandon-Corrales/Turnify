import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1789786260363 implements MigrationInterface {
  name = 'InitialSchema1789786260363';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."notificaciones_tipo_enum" AS ENUM('recordatorio', 'confirmacion', 'cancelacion')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notificaciones_canal_enum" AS ENUM('email', 'whatsapp', 'sms')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notificaciones_estado_enum" AS ENUM('pendiente', 'enviada', 'fallida')`,
    );
    await queryRunner.query(
      `CREATE TABLE "notificaciones" ("creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id_notificacion" uuid NOT NULL DEFAULT uuid_generate_v4(), "id_reserva" uuid NOT NULL, "id_cliente" uuid NOT NULL, "tipo" "public"."notificaciones_tipo_enum" NOT NULL, "canal" "public"."notificaciones_canal_enum" NOT NULL, "estado" "public"."notificaciones_estado_enum" NOT NULL DEFAULT 'pendiente', "programado_para" TIMESTAMP WITH TIME ZONE NOT NULL, "enviado_en" TIMESTAMP WITH TIME ZONE, "mensaje" text NOT NULL, "reintentos" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_ff498b8eb6b226a9fc52889ddac" PRIMARY KEY ("id_notificacion"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2e1f4bc8c2377cb39a773ee7fe" ON "notificaciones" ("id_reserva") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_91cf297e5583dc366188da4f4a" ON "notificaciones" ("id_cliente") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e1fc5e910fca3d7ed1daae7c97" ON "notificaciones" ("estado") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5b8459fc62102453597a4c0547" ON "notificaciones" ("programado_para") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."clientes_canal_preferido_enum" AS ENUM('email', 'whatsapp')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."clientes_idioma_preferido_enum" AS ENUM('es', 'en')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."clientes_nivel_cliente_enum" AS ENUM('gratis', 'premium')`,
    );
    await queryRunner.query(
      `CREATE TABLE "clientes" ("creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id_cliente" uuid NOT NULL DEFAULT uuid_generate_v4(), "id_negocio" uuid NOT NULL, "nombre_completo" character varying(150) NOT NULL, "correo_electronico" character varying(255) NOT NULL, "telefono" character varying(30), "notas" text, "canal_preferido" "public"."clientes_canal_preferido_enum" NOT NULL DEFAULT 'email', "idioma_preferido" "public"."clientes_idioma_preferido_enum" NOT NULL DEFAULT 'es', "nivel_cliente" "public"."clientes_nivel_cliente_enum" NOT NULL DEFAULT 'gratis', "activo" boolean NOT NULL DEFAULT true, "eliminado_en" TIMESTAMP WITH TIME ZONE, CONSTRAINT "uq_cliente_negocio_correo" UNIQUE ("id_negocio", "correo_electronico"), CONSTRAINT "PK_4b7c4b981b60b5c6b1d04c84a54" PRIMARY KEY ("id_cliente"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cb101e6a459598ab6a082e4202" ON "clientes" ("id_negocio") `,
    );
    await queryRunner.query(
      `CREATE TABLE "servicios" ("creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id_servicio" uuid NOT NULL DEFAULT uuid_generate_v4(), "id_negocio" uuid NOT NULL, "nombre" character varying(150) NOT NULL, "descripcion" text, "duracion_minutos" integer NOT NULL, "precio" numeric(10,2) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "color_calendario" character varying(20), "eliminado_en" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_f07b149d3dd3cee237e2efe4922" PRIMARY KEY ("id_servicio"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_65460f69f8ff62c5c87b3a16d4" ON "servicios" ("id_negocio") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reservas_estado_enum" AS ENUM('pendiente', 'confirmada', 'cancelada', 'ausente')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reservas_origen_enum" AS ENUM('online', 'admin')`,
    );
    await queryRunner.query(
      `CREATE TABLE "reservas" ("creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id_reserva" uuid NOT NULL DEFAULT uuid_generate_v4(), "id_negocio" uuid NOT NULL, "id_cliente" uuid NOT NULL, "id_servicio" uuid NOT NULL, "id_usuario" uuid NOT NULL, "fecha_hora_inicio" TIMESTAMP WITH TIME ZONE NOT NULL, "fecha_hora_fin" TIMESTAMP WITH TIME ZONE NOT NULL, "estado" "public"."reservas_estado_enum" NOT NULL DEFAULT 'pendiente', "notas" text, "origen" "public"."reservas_origen_enum" NOT NULL DEFAULT 'online', CONSTRAINT "PK_b853240157bdace880757a4a791" PRIMARY KEY ("id_reserva"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a65d24ae46489baf46e3f36e7e" ON "reservas" ("id_negocio") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3380e97aa0b9269b7b27a49874" ON "reservas" ("id_cliente") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4ee2f9b99c437a7f4e66f671e0" ON "reservas" ("id_servicio") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7c1575cf897c9b4409d7acbbb6" ON "reservas" ("id_usuario") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_reserva_usuario_horario" ON "reservas" ("id_usuario", "fecha_hora_inicio", "fecha_hora_fin") `,
    );
    await queryRunner.query(
      `CREATE TABLE "disponibilidades" ("creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id_disponibilidad" uuid NOT NULL DEFAULT uuid_generate_v4(), "id_usuario" uuid NOT NULL, "id_negocio" uuid NOT NULL, "dia_semana" smallint NOT NULL, "hora_inicio" TIME NOT NULL, "hora_fin" TIME NOT NULL, "activo" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_3d7fe598faa43459ba89a779180" PRIMARY KEY ("id_disponibilidad"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3dd1ef82eda608953c0c11186a" ON "disponibilidades" ("id_usuario") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0cd8ba09071604926ee5e64e1b" ON "disponibilidades" ("id_negocio") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_disponibilidad_usuario_dia" ON "disponibilidades" ("id_usuario", "dia_semana") `,
    );
    await queryRunner.query(
      `CREATE TABLE "excepciones_disponibilidad" ("creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id_excepcion" uuid NOT NULL DEFAULT uuid_generate_v4(), "id_usuario" uuid NOT NULL, "fecha" date NOT NULL, "bloqueado" boolean NOT NULL DEFAULT true, "motivo" character varying(255), CONSTRAINT "PK_2cfa864b01aca2e71796ec21751" PRIMARY KEY ("id_excepcion"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_excepcion_usuario_fecha" ON "excepciones_disponibilidad" ("id_usuario", "fecha") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."usuarios_rol_enum" AS ENUM('admin', 'empleado')`,
    );
    await queryRunner.query(
      `CREATE TABLE "usuarios" ("creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id_usuario" uuid NOT NULL DEFAULT uuid_generate_v4(), "id_negocio" uuid NOT NULL, "nombre_completo" character varying(150) NOT NULL, "correo_electronico" character varying(255) NOT NULL, "contrasena_hash" character varying(255) NOT NULL, "rol" "public"."usuarios_rol_enum" NOT NULL DEFAULT 'empleado', "telefono" character varying(30), "activo" boolean NOT NULL DEFAULT true, "eliminado_en" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_e871b7157e4b74290df9baa9c93" UNIQUE ("correo_electronico"), CONSTRAINT "PK_dfe59db369749f9042499fd8107" PRIMARY KEY ("id_usuario"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d3d8cd932feb5657b5dd9583fd" ON "usuarios" ("id_negocio") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."suscripciones_plan_enum" AS ENUM('gratis', 'basico', 'premium', 'empresarial')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."suscripciones_estado_enum" AS ENUM('activa', 'suspendida', 'cancelada')`,
    );
    await queryRunner.query(
      `CREATE TABLE "suscripciones" ("creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id_suscripcion" uuid NOT NULL DEFAULT uuid_generate_v4(), "id_negocio" uuid NOT NULL, "plan" "public"."suscripciones_plan_enum" NOT NULL DEFAULT 'gratis', "fecha_inicio" TIMESTAMP WITH TIME ZONE NOT NULL, "fecha_fin" TIMESTAMP WITH TIME ZONE, "monto_mensual" numeric(10,2) NOT NULL DEFAULT '0', "estado" "public"."suscripciones_estado_enum" NOT NULL DEFAULT 'activa', "id_pago_pasarela" character varying(255), CONSTRAINT "PK_bef1416e2e5df72dfb8453173fd" PRIMARY KEY ("id_suscripcion"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a4e0fd5c8b627c79cc0a6ac1cc" ON "suscripciones" ("id_negocio") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."negocios_plan_suscripcion_enum" AS ENUM('gratis', 'basico', 'premium', 'empresarial')`,
    );
    await queryRunner.query(
      `CREATE TABLE "negocios" ("creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id_negocio" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre" character varying(150) NOT NULL, "tipo_negocio" character varying(100) NOT NULL, "correo_electronico" character varying(255) NOT NULL, "telefono" character varying(30), "direccion" character varying(255), "plan_suscripcion" "public"."negocios_plan_suscripcion_enum" NOT NULL DEFAULT 'gratis', "estado" character varying(30) NOT NULL DEFAULT 'activo', "fecha_registro" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "eliminado_en" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_3061d2b3c985425c1904391e14f" UNIQUE ("correo_electronico"), CONSTRAINT "PK_4f223b816c5a1ca0563ff3cbe0c" PRIMARY KEY ("id_negocio"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "notificaciones" ADD CONSTRAINT "FK_2e1f4bc8c2377cb39a773ee7fed" FOREIGN KEY ("id_reserva") REFERENCES "reservas"("id_reserva") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notificaciones" ADD CONSTRAINT "FK_91cf297e5583dc366188da4f4ac" FOREIGN KEY ("id_cliente") REFERENCES "clientes"("id_cliente") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "clientes" ADD CONSTRAINT "FK_cb101e6a459598ab6a082e42027" FOREIGN KEY ("id_negocio") REFERENCES "negocios"("id_negocio") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "servicios" ADD CONSTRAINT "FK_65460f69f8ff62c5c87b3a16d49" FOREIGN KEY ("id_negocio") REFERENCES "negocios"("id_negocio") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservas" ADD CONSTRAINT "FK_a65d24ae46489baf46e3f36e7e1" FOREIGN KEY ("id_negocio") REFERENCES "negocios"("id_negocio") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservas" ADD CONSTRAINT "FK_3380e97aa0b9269b7b27a498749" FOREIGN KEY ("id_cliente") REFERENCES "clientes"("id_cliente") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservas" ADD CONSTRAINT "FK_4ee2f9b99c437a7f4e66f671e04" FOREIGN KEY ("id_servicio") REFERENCES "servicios"("id_servicio") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservas" ADD CONSTRAINT "FK_7c1575cf897c9b4409d7acbbb61" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "disponibilidades" ADD CONSTRAINT "FK_3dd1ef82eda608953c0c11186a1" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "disponibilidades" ADD CONSTRAINT "FK_0cd8ba09071604926ee5e64e1bc" FOREIGN KEY ("id_negocio") REFERENCES "negocios"("id_negocio") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "excepciones_disponibilidad" ADD CONSTRAINT "FK_ec260c2d9351fb1dffedb345284" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD CONSTRAINT "FK_d3d8cd932feb5657b5dd9583fdb" FOREIGN KEY ("id_negocio") REFERENCES "negocios"("id_negocio") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "suscripciones" ADD CONSTRAINT "FK_a4e0fd5c8b627c79cc0a6ac1cc8" FOREIGN KEY ("id_negocio") REFERENCES "negocios"("id_negocio") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "suscripciones" DROP CONSTRAINT "FK_a4e0fd5c8b627c79cc0a6ac1cc8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP CONSTRAINT "FK_d3d8cd932feb5657b5dd9583fdb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "excepciones_disponibilidad" DROP CONSTRAINT "FK_ec260c2d9351fb1dffedb345284"`,
    );
    await queryRunner.query(
      `ALTER TABLE "disponibilidades" DROP CONSTRAINT "FK_0cd8ba09071604926ee5e64e1bc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "disponibilidades" DROP CONSTRAINT "FK_3dd1ef82eda608953c0c11186a1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservas" DROP CONSTRAINT "FK_7c1575cf897c9b4409d7acbbb61"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservas" DROP CONSTRAINT "FK_4ee2f9b99c437a7f4e66f671e04"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservas" DROP CONSTRAINT "FK_3380e97aa0b9269b7b27a498749"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservas" DROP CONSTRAINT "FK_a65d24ae46489baf46e3f36e7e1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "servicios" DROP CONSTRAINT "FK_65460f69f8ff62c5c87b3a16d49"`,
    );
    await queryRunner.query(
      `ALTER TABLE "clientes" DROP CONSTRAINT "FK_cb101e6a459598ab6a082e42027"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notificaciones" DROP CONSTRAINT "FK_91cf297e5583dc366188da4f4ac"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notificaciones" DROP CONSTRAINT "FK_2e1f4bc8c2377cb39a773ee7fed"`,
    );
    await queryRunner.query(`DROP TABLE "negocios"`);
    await queryRunner.query(`DROP TYPE "public"."negocios_plan_suscripcion_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a4e0fd5c8b627c79cc0a6ac1cc"`);
    await queryRunner.query(`DROP TABLE "suscripciones"`);
    await queryRunner.query(`DROP TYPE "public"."suscripciones_estado_enum"`);
    await queryRunner.query(`DROP TYPE "public"."suscripciones_plan_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d3d8cd932feb5657b5dd9583fd"`);
    await queryRunner.query(`DROP TABLE "usuarios"`);
    await queryRunner.query(`DROP TYPE "public"."usuarios_rol_enum"`);
    await queryRunner.query(`DROP INDEX "public"."idx_excepcion_usuario_fecha"`);
    await queryRunner.query(`DROP TABLE "excepciones_disponibilidad"`);
    await queryRunner.query(`DROP INDEX "public"."idx_disponibilidad_usuario_dia"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_0cd8ba09071604926ee5e64e1b"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_3dd1ef82eda608953c0c11186a"`);
    await queryRunner.query(`DROP TABLE "disponibilidades"`);
    await queryRunner.query(`DROP INDEX "public"."idx_reserva_usuario_horario"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7c1575cf897c9b4409d7acbbb6"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4ee2f9b99c437a7f4e66f671e0"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_3380e97aa0b9269b7b27a49874"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a65d24ae46489baf46e3f36e7e"`);
    await queryRunner.query(`DROP TABLE "reservas"`);
    await queryRunner.query(`DROP TYPE "public"."reservas_origen_enum"`);
    await queryRunner.query(`DROP TYPE "public"."reservas_estado_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_65460f69f8ff62c5c87b3a16d4"`);
    await queryRunner.query(`DROP TABLE "servicios"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_cb101e6a459598ab6a082e4202"`);
    await queryRunner.query(`DROP TABLE "clientes"`);
    await queryRunner.query(`DROP TYPE "public"."clientes_nivel_cliente_enum"`);
    await queryRunner.query(`DROP TYPE "public"."clientes_idioma_preferido_enum"`);
    await queryRunner.query(`DROP TYPE "public"."clientes_canal_preferido_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_5b8459fc62102453597a4c0547"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e1fc5e910fca3d7ed1daae7c97"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_91cf297e5583dc366188da4f4a"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2e1f4bc8c2377cb39a773ee7fe"`);
    await queryRunner.query(`DROP TABLE "notificaciones"`);
    await queryRunner.query(`DROP TYPE "public"."notificaciones_estado_enum"`);
    await queryRunner.query(`DROP TYPE "public"."notificaciones_canal_enum"`);
    await queryRunner.query(`DROP TYPE "public"."notificaciones_tipo_enum"`);
  }
}
