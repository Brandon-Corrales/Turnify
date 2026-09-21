import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: {
      // El estilo de decoradores de NestJS (constructores vacíos con solo
      // parámetros inyectados, clases sin miembros propios en módulos)
      // dispara falsos positivos en varias reglas genéricas de TS.
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      // FindOptionsWhere<T> de TypeORM es invariante y no combina bien con
      // el genérico de TenantScopedRepository; los `as any` puntuales ahí
      // son deliberados. Se avisa en vez de bloquear el build por esto.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // En mocks de test, `any` es la norma de la industria, no un descuido.
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  prettierConfig,
);
