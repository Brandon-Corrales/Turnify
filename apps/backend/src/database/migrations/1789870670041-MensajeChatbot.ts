import { MigrationInterface, QueryRunner } from "typeorm";

export class MensajeChatbot1789870670041 implements MigrationInterface {
    name = 'MensajeChatbot1789870670041'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // El auto-generador vuelve a proponer este DROP CONSTRAINT — mismo
        // falso positivo documentado en la migración PlantillaServicioCatalog
        // (la EXCLUDE constraint de no-traslape se creó con SQL crudo, TypeORM
        // no la reconoce como parte de la entidad Reserva). Removido a mano.
        await queryRunner.query(`CREATE TABLE "mensajes_chatbot" ("creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id_mensaje" uuid NOT NULL DEFAULT uuid_generate_v4(), "id_negocio" uuid NOT NULL, "id_usuario" uuid NOT NULL, "pregunta" text NOT NULL, "respuesta" text, CONSTRAINT "PK_fa44596a64ad7cb0ff14ccbac53" PRIMARY KEY ("id_mensaje"))`);
        await queryRunner.query(`CREATE INDEX "IDX_83c78074fea3a332817a4b4e17" ON "mensajes_chatbot" ("id_negocio") `);
        await queryRunner.query(`CREATE INDEX "IDX_0f163b67e8515ed5191c120302" ON "mensajes_chatbot" ("id_usuario") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_0f163b67e8515ed5191c120302"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_83c78074fea3a332817a4b4e17"`);
        await queryRunner.query(`DROP TABLE "mensajes_chatbot"`);
    }

}
