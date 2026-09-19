import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import { AppDataSource } from './data-source';
import {
  Negocio,
  Usuario,
  Cliente,
  Servicio,
  RolUsuario,
  CanalPreferido,
  Idioma,
  NivelCliente,
  PlanSuscripcion,
} from './entities';

async function seed() {
  await AppDataSource.initialize();

  const negocioRepo = AppDataSource.getRepository(Negocio);
  const usuarioRepo = AppDataSource.getRepository(Usuario);
  const clienteRepo = AppDataSource.getRepository(Cliente);
  const servicioRepo = AppDataSource.getRepository(Servicio);

  const existente = await negocioRepo.findOne({
    where: { correoElectronico: 'demo@turnify.app' },
  });
  if (existente) {
    console.log('Seed ya aplicado (negocio demo@turnify.app existe). Nada que hacer.');
    await AppDataSource.destroy();
    return;
  }

  const negocio = await negocioRepo.save(
    negocioRepo.create({
      nombre: 'Barbería Demo Turnify',
      tipoNegocio: 'barberia',
      correoElectronico: 'demo@turnify.app',
      telefono: '+506 8888-0000',
      direccion: 'Nicoya, Guanacaste, Costa Rica',
      planSuscripcion: PlanSuscripcion.GRATIS,
      estado: 'activo',
      fechaRegistro: new Date(),
    }),
  );

  const contrasenaHash = await bcrypt.hash('Turnify123!', 10);

  const admin = await usuarioRepo.save(
    usuarioRepo.create({
      idNegocio: negocio.idNegocio,
      nombreCompleto: 'Admin Demo',
      correoElectronico: 'admin@turnify.app',
      contrasenaHash,
      rol: RolUsuario.ADMIN,
      telefono: '+506 8888-0001',
      activo: true,
    }),
  );

  const servicios = await servicioRepo.save([
    servicioRepo.create({
      idNegocio: negocio.idNegocio,
      nombre: 'Corte clásico',
      descripcion: 'Corte de cabello tradicional',
      duracionMinutos: 30,
      precio: '8000.00',
      colorCalendario: '#4f46e5',
    }),
    servicioRepo.create({
      idNegocio: negocio.idNegocio,
      nombre: 'Corte + barba',
      descripcion: 'Corte de cabello y arreglo de barba',
      duracionMinutos: 45,
      precio: '12000.00',
      colorCalendario: '#059669',
    }),
    servicioRepo.create({
      idNegocio: negocio.idNegocio,
      nombre: 'Afeitado clásico',
      descripcion: 'Afeitado con navaja y toalla caliente',
      duracionMinutos: 20,
      precio: '6000.00',
      colorCalendario: '#d97706',
    }),
  ]);

  await clienteRepo.save([
    clienteRepo.create({
      idNegocio: negocio.idNegocio,
      nombreCompleto: 'Cliente Frecuente',
      correoElectronico: 'cliente1@example.com',
      telefono: '+506 8888-1111',
      canalPreferido: CanalPreferido.EMAIL,
      idiomaPreferido: Idioma.ES,
      nivelCliente: NivelCliente.PREMIUM,
    }),
    clienteRepo.create({
      idNegocio: negocio.idNegocio,
      nombreCompleto: 'Cliente Nuevo',
      correoElectronico: 'cliente2@example.com',
      telefono: '+506 8888-2222',
      canalPreferido: CanalPreferido.EMAIL,
      idiomaPreferido: Idioma.ES,
      nivelCliente: NivelCliente.GRATIS,
    }),
  ]);

  console.log('Seed aplicado:');
  console.log(`  Negocio:  ${negocio.nombre} (${negocio.idNegocio})`);
  console.log(`  Admin:    ${admin.correoElectronico} / Turnify123!`);
  console.log(`  Servicios: ${servicios.length}`);

  await AppDataSource.destroy();
}

seed().catch(async (err) => {
  console.error('Error al aplicar el seed:', err);
  await AppDataSource.destroy();
  process.exit(1);
});
