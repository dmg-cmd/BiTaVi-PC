# Reglas de Comunicación y Desarrollo - BiTaVi

## 1. Idioma
- Toda la comunicación con el usuario debe ser estrictamente en **español**.
- Todos los pensamientos internos (thought process) y respuestas deben redactarse en **español**.
- La documentación, comentarios clave y mensajes de la interfaz de usuario deben estar en **español**.

## 2. Sistema Estricto de Versionado del Software (X.Y.Z)
El sistema sigue la progresión numérica **`X.Y.Z`** (Mayor.Medio.Menor):
1. **Dígito de la derecha (`Z`)**:
   - Se incrementa en `+1` con **cada cambio** realizado en la app.
   - Cuenta hasta llegar a **`10`**.
2. **Dígito del medio (`Y`)**:
   - Cuando el dígito de la derecha (`Z`) llega a `10`, el dígito del medio (`Y`) se incrementa en `+1`, y el de la derecha vuelve a `0` (ej: de `0.2.9` a `0.2.10` y luego a `0.3.0`).
   - Cuenta hasta llegar a **`5`**.
3. **Dígito de la izquierda (`X`)**:
   - Cuando el dígito del medio (`Y`) llega a `5` (ej: `0.5.0`), el dígito de la izquierda (`X`) se incrementa en `+1`, y los demás vuelven a `0` (ej: `1.0.0`).

- **Regla de actualización**: Mantener siempre explícito y sincronizado el número de versión en:
  - `package.json`
  - `index.html` (badge de versión)
  - `docs/01_arquitectura_y_versionado.md`

## 3. Documentación
- Todos los documentos de especificación técnica, manuales y funciones de la app se mantendrán actualizados dentro del directorio `docs/`.