import { apiFetch } from './api';
import type { TipoNegocio } from './tipo-negocio';

export interface PlantillaServicio {
  idPlantilla: string;
  tipoNegocio: TipoNegocio;
  nombre: string;
  duracionMinutosSugerida: number;
  orden: number;
}

export const plantillasServicioApi = {
  listar: (tipoNegocio: TipoNegocio) =>
    apiFetch<PlantillaServicio[]>(`/plantillas-servicio?tipoNegocio=${tipoNegocio}`),
};
