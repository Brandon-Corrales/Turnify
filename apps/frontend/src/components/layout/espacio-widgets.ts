/**
 * Espacio inferior para que los botones flotantes (UserWay abajo al centro,
 * ~60 px desde el borde; chatbot abajo a la derecha, hasta 80 px) nunca
 * tapen el final del contenido: al hacer scroll hasta abajo, lo último de
 * la pantalla (la última fila del calendario o de una tabla, un botón)
 * queda por encima de ellos. Una sola constante para todas las pantallas.
 */
export const ESPACIO_INFERIOR_WIDGETS = 'pb-24';
