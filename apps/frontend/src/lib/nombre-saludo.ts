const TITULOS_PROFESIONALES = /^(?:lic(?:da)?\.?|dr(?:a)?\.?|ing\.?|arq\.?|abg(?:da)?\.?|m\.?sc\.?|msc|mba|prof(?:a)?\.?)\s+/i;

export function nombreParaSaludo(nombreCompleto?: string | null): string {
  let nombre = nombreCompleto?.trim() ?? '';
  while (TITULOS_PROFESIONALES.test(nombre)) {
    nombre = nombre.replace(TITULOS_PROFESIONALES, '').trim();
  }
  return nombre.split(/\s+/)[0] ?? '';
}