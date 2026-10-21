# BiTaVi PC - Simulador y Reproductor Táctico de Viaje (Playback de Ruta)

> **Documento Oficial del Sistema**: `docs/15_simulador_reproductor_tactico_viaje.md`  
> **Versión del Sistema**: `v1.0.1-alpha`  
> **Fecha de Emisión**: 2026-10-21  
> **Estado**: Activo / En Producción  

---

## 1. Justificación y Propósito Operativo

Durante el análisis posterior a una expedición o misión táctica, visualizar únicamente la polilínea estática de una ruta no permite dimensionar:
1. La evolución cronológica y el ritmo de marcha del vehículo o explorador.
2. La aceleración o variaciones de velocidad en pendientes o terrenos complejos.
3. El momento y ubicación exacta en que se capturaron fotografías o se registraron waypoints.

A partir de la versión **`v1.0.1-alpha`**, BiTaVi PC incorpora el **Simulador y Reproductor Táctico de Viaje** (`src/components/playback.js`), un motor desacoplado que reproduce el recorrido animado paso a paso sobre el mapa cartográfico con marcador móvil vectorial, orientación por rumbo dinámico y telemetría en vivo.

---

## 2. Arquitectura del Componente `RoutePlaybackSimulator`

El componente está desacoplado en el módulo [`src/components/playback.js`](../src/components/playback.js) y se integra con la capa Leaflet mediante las siguientes especificaciones:

### 2.1. Cálculo de Rumbo Dinámico (*Spherical Bearing*)
Para orientar la flecha del vehículo táctico hacia la dirección exacta de avance entre dos puntos geográficos consecutivos $(lat_1, lon_1)$ y $(lat_2, lon_2)$, se utiliza la fórmula esférica de navegación:

$$\theta = \text{atan2}\left(\sin(\Delta\lambda) \cdot \cos(\varphi_2),\; \cos(\varphi_1)\cdot\sin(\varphi_2) - \sin(\varphi_1)\cdot\cos(\varphi_2)\cdot\cos(\Delta\lambda)\right)$$

El resultado en radianes se normaliza a un ángulo de $0^\circ$ a $360^\circ$ y se traduce dinámicamente a la rotación CSS del icono SVG (`transform: rotate(bearing deg)`), así como a puntos cardinales tácticos (`N`, `NNE`, `NE`, `ENE`, `E`, etc.).

### 2.2. Cálculo de Distancias y Telemetría Instantánea
- **Fórmula de Haversine**: Permite precalcular la distancia acumulada de la ruta en metros, habilitando un deslizador de línea de tiempo (*timeline slider*) porcentual y continuo de $0\%$ a $100\%$.
- **Velocidad Instantánea**: Extrae la velocidad registrada en el punto GPS o calcula $\Delta\text{distancia} / \Delta\text{tiempo}$ convirtiéndola en $\text{km/h}$.
- **Altitud y Marca Temporal**: Refleja la cota de elevación en metros y la hora exacta del registro.

### 2.3. Bucle de Animación a 60 FPS con `requestAnimationFrame`
El movimiento no bloquea el hilo principal y se ajusta a la tasa de refresco del monitor mediante `requestAnimationFrame`. La velocidad de avance es configurable en tiempo real por el usuario:
- `1x` (tiempo normalizado base)
- `2x`, `5x`, `10x`, `20x`, `50x` (modo patrulla acelerada o avance rápido).

### 2.4. Detección de Proximidad de Fotografías y Waypoints
En cada actualización de coordenadas, el simulador evalúa la distancia geográfica a las fotografías geolocalizadas cargadas en el mapa. Si el vehículo transita a menos de 60 metros de un punto de captura, notifica el evento al HUD para alertar al operador.

---

## 3. Elementos de la Interfaz HUD (`#playback-bar`)

La barra flotante de reproducción se sitúa sobre el visor cartográfico e integra:
1. **Línea de Estado Superior**:
   - Indicador de estado con pulso luminoso cian (`sim-dot pulsing`).
   - Identificador o nombre personalizado de la ruta activa.
   - Telemetría en vivo: Distancia recorrida / Distancia total, Velocidad instantánea ($\text{km/h}$), Altitud ($\text{m}$), Rumbo en grados y cuadrante cardinal, y Marca temporal.
2. **Línea de Tiempo (*Timeline Slider*)**:
   - Barra deslizante táctica que permite desplazarse hacia adelante o hacia atrás a cualquier punto del trayecto en tiempo real.
3. **Fila de Control Táctico**:
   - Botón `[▶ Iniciar]` / `[⏸ Pausar]` / `[▶ Reanudar]`.
   - Botón `[⏹ Reiniciar]` (rebobinado al punto de partida).
   - Botonera selectora de velocidad: `1x`, `2x`, `5x`, `10x`, `20x`, `50x`.
   - Interruptor `[🎯 Seguir Cámara]`: centrado dinámico opcional del mapa en torno al marcador en movimiento.
   - Botón de cierre (`✕`) que detiene la animación y retira el marcador del mapa.
