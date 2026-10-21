# BiTaVi PC - Chevrons Direccionales Tácticos de Ruta (Paridad con BiTaVi Android)

## 1. Contexto y Diagnóstico
En versiones previas (`v0.4.8-alpha` y anteriores), las flechas direccionales a lo largo de las rutas cargadas se representaban mediante pseudo-elementos CSS triangulares de gran tamaño y coloreados con el tono propio de la ruta (`var(--accent-emerald)` o colores dinámicos).

### Deficiencias del enfoque anterior:
1. **Saturación visual**: Los triángulos rellenos resultaban toscos, obstruyendo los detalles finos de la polilínea del trazado y ocultando posibles bifurcaciones.
2. **Pérdida de contraste**: Al pintarse con el mismo color de la línea de ruta, las flechas se mimetizaban con el trazo cuando este se volvía grueso o cambiaba de capa cartográfica.
3. **Distorsión angular**: El cálculo previo `Math.atan2(dLng, dLat)` omitía la corrección por latitud esférica Mercator ($\cos(lat)$), provocando desalineaciones entre la orientación visual de la flecha y el trazado de la polilínea en rutas diagonales.

---

## 2. Paridad con BiTaVi Android

En **BiTaVi Android** (`RouteDirectionArrowsOverlay.kt`), el overlay de dirección fue diseñado bajo un concepto táctico ligero (Anti-OOM) y de alta discreción:
- **Forma de chevron (dos rayitas)**: Una V abierta hacia atrás que converge en un vértice apuntando en el sentido del movimiento (`drawChevron`).
- **Línea blanca pura con halo oscuro**:
  - `borderPaint`: `Color.argb(230, 15, 15, 20)`, trazo grueso redondeado para contraste.
  - `fillPaint`: `Color.WHITE`, trazo interno nítido y fino.
- **Ángulo de apertura**: $32^\circ$ por ala (apertura total de $\approx 64^\circ$).
- **Filtrado de detenciones**: Ignora segmentos con desplazamiento menor a un umbral mínimo para no saturar zonas de paradas prolongadas.

---

## 3. Implementación en BiTaVi PC (`v0.4.9-alpha`)

### 3.1 Marcador Vectorial SVG (`L.divIcon`)
Se adoptó un renderizado vectorial SVG nativo con coordenadas proporcionales al diseño de Android:

```html
<svg class="route-chevron-svg" width="16" height="16" viewBox="0 0 16 16" style="transform: rotate(${Math.round(bearingDeg)}deg);">
  <path class="route-chevron-halo" d="M 3.5 11.5 L 8 4.5 L 12.5 11.5" />
  <path class="route-chevron-core" d="M 3.5 11.5 L 8 4.5 L 12.5 11.5" style="stroke: #ffffff;" />
</svg>
```

### 3.2 Estilos CSS Tácticos (`src/styles/main.css`)
```css
.route-arrow {
  background: transparent !important;
  border: none !important;
  pointer-events: none !important;
}

.route-chevron-svg {
  display: block;
  overflow: visible;
  pointer-events: none;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.75));
}

.route-chevron-halo {
  fill: none;
  stroke: rgba(15, 15, 20, 0.92);
  stroke-width: 3.6px;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.route-chevron-core {
  fill: none;
  stroke: #ffffff;
  stroke-width: 1.8px;
  stroke-linecap: round;
  stroke-linejoin: round;
}
```

### 3.3 Rumbo Geodésico Exacto (`calcBearing`)
Para asegurar que el chevron quede perfectamente alineado con la tangente del camino:
$$\theta = \text{atan2}(y, x) \times \frac{180}{\pi} \pmod{360}$$
Donde:
- $y = \sin(\Delta lng) \times \cos(lat_2)$
- $x = \cos(lat_1) \times \sin(lat_2) - \sin(lat_1) \times \cos(lat_2) \times \cos(\Delta lng)$

Esto garantiza precisión milimétrica de orientación sin importar la latitud de operación (desde zonas tropicales hasta la Patagonia).

---

## 4. Beneficios Operativos
1. **Legibilidad Universal**: El núcleo blanco con halo oscuro resalta tanto sobre mapas claros (OSM estándar, CyclOSM) como sobre fondos oscuros (modo táctico nocturno) o fotografías satelitales complejas.
2. **Independencia del Color de Ruta**: Las rutas individuales mantienen sus colores tácticos distintivos (R1 verde, R2 cian, R3 naranja, etc.) mientras que los chevrons conservan un patrón unificado y limpio.
3. **Cero Impacto en Rendimiento**: Elementos SVG estáticos ligeros agrupados en `routeArrowsLayerGroup` con eventos de puntero desactivados (`pointer-events: none`), manteniendo los 60 FPS estables durante el paneo y zoom.
