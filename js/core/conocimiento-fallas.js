// =====================================================================
// CONOCIMIENTO TÉCNICO · causas probables de falla por componente
// ---------------------------------------------------------------------
// Para cada PIEZA (mismas keys que PIEZAS en core/analisis-fallas.js):
//   f: falla / síntoma · m: motivos (keys de MOTIVOS) con que calza · c: causas probables (más común primero)
//   r: qué revisar · p: cómo prevenirla
// Lo usan el módulo Análisis de Fallas y el Perfil para sugerir "por qué pudo fallar y qué revisar".
// Mismo contenido que el documento "Causas de falla por componente FRC". Para afinar: editar aquí.
// =====================================================================

export const CONOCIMIENTO = {
  // ------------------------------ ELÉCTRICO / CONTROL ------------------------------
  BATERIA: [
    { f: 'No parte / batería descargada', m: ['DESCARGA', 'SIN_MOTIVO'], c: ['Alternador no carga (correa suelta, regulador malo)', 'Consumo parásito con el equipo apagado (GPS, módulo, luces)', 'Corta corriente abierto o mal contacto', 'Batería al final de su vida útil (2–3 años)', 'Equipo detenido muchos días sin mantenedor de carga'], r: ['Voltaje en reposo (12,6 V cargada / bajo 12,2 V descargada)', 'Voltaje con motor andando (13,8–14,4 V)', 'Consumo con equipo apagado', 'Bornes y corta corriente'], p: 'Medir voltaje en cada mantención; mantenedor de carga o corta corriente abierto en equipos detenidos.' },
    { f: 'Bornes sulfatados', m: ['DESCARGA', 'DESGASTE'], c: ['Gases de la batería por sobrecarga', 'Terminales sueltos', 'Humedad y polvo'], r: ['Limpieza de bornes', 'Apriete de terminales', 'Voltaje de carga (sobrecarga > 14,8 V)'], p: 'Limpiar y engrasar bornes en cada 250 h.' },
    { f: 'Batería robada', m: ['ROBO'], c: ['Equipo en faena sin vigilancia', 'Gabinete sin candado'], r: ['Chapa y candado del gabinete'], p: 'Candado en gabinete y registro de batería por AFI.' }
  ],
  MOTOR_PARTIDA: [
    { f: 'No gira / hace clic', m: ['SIN_MOTIVO', 'QUEMADO', 'DESCARGA'], c: ['Batería baja o cables de partida con mala conexión', 'Solenoide o relé de partida malo', 'Carbones gastados', 'Bendix trabado'], r: ['Voltaje en el motor de partida al dar arranque (mín. 10 V)', 'Cable de masa y positivo', 'Relé / solenoide'], p: 'Revisar conexiones de partida en cada 250 h; no dar arranques de más de 15 s seguidos.' },
    { f: 'Gira lento', m: ['DESGASTE', 'DESCARGA'], c: ['Batería débil', 'Bujes y carbones gastados', 'Aceite muy espeso en frío'], r: ['Caída de voltaje al arrancar', 'Consumo del motor de partida'], p: 'Usar el aceite de la viscosidad indicada; cambiar batería débil a tiempo.' }
  ],
  CORTA_CORRIENTE: [
    { f: 'Equipo sin energía', m: ['SIN_MOTIVO', 'QUEMADO', 'GOLPE'], c: ['Corta corriente apagado o mal posicionado', 'Contactos quemados por sobrecorriente', 'Manilla quebrada'], r: ['Continuidad en posición ON', 'Temperatura del corta corriente'], p: 'Corta corriente de buena capacidad (A) y señalizado.' }
  ],
  BOCINA: [
    { f: 'No suena / no enciende', m: ['SIN_MOTIVO', 'QUEMADO', 'GOLPE'], c: ['Fusible quemado', 'Cable cortado o terminal suelto', 'Componente mojado o golpeado'], r: ['Fusible y relé', 'Continuidad del cableado', 'Masa'], p: 'Verificar en el check list diario (exigido en faena).' }
  ],
  ALTERNADOR: [
    { f: 'No carga la batería', m: ['SIN_MOTIVO', 'DESCARGA', 'QUEMADO'], c: ['Correa suelta o cortada', 'Regulador interno malo', 'Diodos quemados', 'Cable de excitación (D+) cortado'], r: ['Voltaje con motor andando (13,8–14,4 V)', 'Tensión de la correa', 'Testigo de carga'], p: 'Revisar tensión de correa y voltaje de carga en cada 250 h.' },
    { f: 'Ruido', m: ['DESGASTE', 'SUELTO'], c: ['Rodamiento gastado', 'Polea suelta'], r: ['Juego del eje', 'Apriete de polea'], p: 'Escuchar el alternador en cada mantención.' }
  ],
  CABLEADO: [
    { f: 'Falla intermitente / sin señal', m: ['SUELTO', 'ROTURA', 'SIN_MOTIVO'], c: ['Terminal suelto o sulfatado', 'Cable cortado por roce o vibración', 'Masa (tierra) en mal estado', 'Roedores'], r: ['Continuidad', 'Caída de voltaje en la línea', 'Puntos de roce y amarras'], p: 'Amarras y protección (corrugado) en zonas de roce; revisar masas en cada 500 h.' },
    { f: 'Cable quemado / derretido', m: ['QUEMADO'], c: ['Cortocircuito', 'Cable de menor sección que la necesaria', 'Contacto con escape u otra parte caliente'], r: ['Fusible correcto (amperaje)', 'Ruteo lejos del escape'], p: 'Nunca reemplazar un fusible por uno de más amperaje.' }
  ],
  FUSIBLE_RELE: [
    { f: 'Fusible quemado una y otra vez', m: ['QUEMADO', 'SIN_MOTIVO'], c: ['Cortocircuito en el circuito que protege', 'Consumidor trabado (motor, bomba)', 'Fusible de menos amperaje que el indicado'], r: ['Aislamiento del circuito', 'Consumo del componente'], p: 'Buscar la causa antes de cambiar el fusible.' }
  ],
  SENSOR: [
    { f: 'Lectura errónea / alarma falsa', m: ['AJUSTE', 'SIN_MOTIVO', 'SUELTO'], c: ['Conector suelto, sulfatado o con agua', 'Sensor malo', 'Cable cortado (lee 0 o máximo)', 'Parámetro mal configurado en el módulo'], r: ['Conector y pines', 'Resistencia del sensor vs tabla del fabricante', 'Comparar con un instrumento manual (manómetro, termómetro)'], p: 'Proteger conectores con grasa dieléctrica; no lavar a presión el tablero.' }
  ],
  SOLENOIDE: [
    { f: 'Se apaga solo / no corta combustible', m: ['SIN_MOTIVO', 'QUEMADO'], c: ['Bobina quemada', 'Falta de voltaje (relé o cable)', 'Émbolo trabado por suciedad'], r: ['Voltaje en el solenoide', 'Resistencia de la bobina'], p: 'Mantener limpio el sistema de combustible.' }
  ],
  LLAVE_CONTACTO: [
    { f: 'No da contacto', m: ['DESGASTE', 'GOLPE', 'SIN_MOTIVO'], c: ['Contactos internos gastados', 'Llave forzada o distinta'], r: ['Continuidad en cada posición'], p: 'Usar la llave correcta; no forzarla.' }
  ],
  CONTROLADOR: [
    { f: 'Lecturas erróneas / no muestra', m: ['AJUSTE', 'SIN_MOTIVO'], c: ['Sensor o cableado malo (el módulo muestra lo que recibe)', 'Parámetros desconfigurados', 'Voltaje de alimentación bajo (batería)', 'Módulo dañado por humedad o sobrevoltaje'], r: ['Alimentación del módulo (12/24 V estable)', 'Sensores con instrumento manual', 'Parámetros vs equipo gemelo', 'Historial de alarmas del módulo'], p: 'Respaldar parámetros; tablero cerrado y seco; batería en buen estado.' },
    { f: 'Equipo se detiene por alarma', m: ['SIN_MOTIVO', 'TEMPERATURA', 'FALTA_MANT'], c: ['Alarma real (temperatura, presión de aceite, nivel)', 'Sensor malo que da alarma falsa'], r: ['Leer el código de alarma antes de resetear', 'Confirmar con instrumento manual'], p: 'Anotar siempre el código de alarma en la OT.' }
  ],
  // ------------------------------ GENERACIÓN ------------------------------
  AVR: [
    { f: 'No genera voltaje / voltaje inestable', m: ['QUEMADO', 'AJUSTE', 'SIN_MOTIVO'], c: ['AVR quemado (sobrecarga, cortocircuito en la carga)', 'Pérdida de magnetismo remanente', 'Diodos del puente rectificador malos', 'Ajuste del potenciómetro movido', 'RPM fuera de rango (frecuencia)'], r: ['Voltaje de salida y frecuencia (50 Hz)', 'Diodos rotativos', 'Resistencia de la excitatriz', 'Conexiones del AVR'], p: 'No sobrecargar el generador; banco de carga periódico; proteger del polvo.' }
  ],
  ALIMENTADORES: [
    { f: 'Recalentamiento / conexión quemada', m: ['QUEMADO', 'SUELTO', 'TEMPERATURA'], c: ['Terminal suelto (alta resistencia)', 'Cable de menor sección que la carga', 'Desbalance de fases'], r: ['Apriete de terminales', 'Temperatura con pistola infrarroja', 'Amperaje por fase'], p: 'Reapriete de terminales y medición de corriente en cada instalación.' }
  ],
  BREAKER: [
    { f: 'Se dispara (bota)', m: ['SIN_MOTIVO', 'QUEMADO'], c: ['Sobrecarga de la faena', 'Cortocircuito o falla a tierra en la instalación del cliente', 'Breaker dañado o mal calibrado'], r: ['Amperaje vs nominal', 'Aislamiento de la instalación', 'Fases balanceadas'], p: 'Conocer la carga de la faena antes de instalar; no puentear el breaker.' }
  ],
  TRANSFERENCIA: [
    { f: 'No transfiere', m: ['SIN_MOTIVO', 'AJUSTE'], c: ['Contactor o motor de la transferencia malo', 'Señal de red / grupo no llega al módulo', 'Configuración de tiempos'], r: ['Señales en el módulo ATS', 'Contactores'], p: 'Prueba de transferencia programada.' }
  ],
  EXCITATRIZ: [
    { f: 'No genera / genera bajo', m: ['QUEMADO', 'SIN_MOTIVO'], c: ['Bobinado quemado por sobrecarga', 'Humedad en el bobinado', 'Diodos rotativos malos'], r: ['Aislamiento (megado)', 'Resistencia de bobinas', 'Diodos'], p: 'Evitar sobrecarga; secar el generador si estuvo expuesto a agua.' }
  ],
  // ------------------------------ MOTOR ------------------------------
  CORREA: [
    { f: 'Se corta', m: ['ROTURA', 'SIN_MOTIVO'], c: ['Mal tensada (suelta patina, tensa se fatiga)', 'Polea o tensor desalineado o trabado', 'Rodamiento de alternador / bomba de agua trabado', 'Correa cristalizada por vida útil', 'Contaminada con aceite o combustible'], r: ['Giro libre de poleas y tensor', 'Alineación de poleas', 'Fugas de aceite cerca de la correa'], p: 'Revisar tensión y estado en cada 250 h; cambiar con sus horas aunque se vea bien.' },
    { f: 'Suelta / chilla', m: ['SUELTO', 'DESGASTE'], c: ['Tensor débil', 'Correa estirada', 'Poleas gastadas'], r: ['Tensión', 'Desgaste del canal de la polea'], p: 'Ajustar tensión al cambiar o revisar.' }
  ],
  POLEA_TENSOR: [
    { f: 'Ruido / desalineada', m: ['DESGASTE', 'SUELTO', 'ROTURA'], c: ['Rodamiento del tensor gastado', 'Resorte del tensor débil', 'Perno suelto'], r: ['Juego y giro libre', 'Apriete'], p: 'Cambiar el tensor junto con la correa en las mantenciones mayores.' }
  ],
  INYECTOR: [
    { f: 'Humo negro / pierde potencia / golpeteo', m: ['OBSTRUCCION', 'DESGASTE', 'SIN_MOTIVO'], c: ['Combustible con agua o sucio', 'Inyector goteando o tapado', 'Filtro de combustible saturado'], r: ['Prueba de inyectores en banco', 'Calidad del combustible y decantador'], p: 'Drenar decantador a diario; filtros de combustible a su tiempo; combustible de proveedor confiable.' }
  ],
  TURBO: [
    { f: 'Humo azul / pierde aceite / silba', m: ['DESGASTE', 'FUGA', 'ROTURA'], c: ['Falta de lubricación (apagar en caliente, aceite viejo)', 'Filtro de aire roto o mal sellado (entra polvo)', 'Objeto extraño en la admisión'], r: ['Juego axial y radial del eje', 'Ductos de admisión y abrazaderas', 'Aceite en la admisión'], p: 'Dejar enfriar 3–5 min antes de apagar; filtro de aire bien sellado.' }
  ],
  CULATA: [
    { f: 'Pierde refrigerante / aceite mezclado / sobrecalienta', m: ['TEMPERATURA', 'FUGA', 'ROTURA'], c: ['Sobrecalentamiento previo (falta de refrigerante, radiador tapado)', 'Empaquetadura vencida', 'Culata deformada o trizada'], r: ['Prueba de presión del sistema de refrigeración', 'Aceite con aspecto lechoso', 'Gases en el depósito de refrigerante'], p: 'Nivel de refrigerante en cada check list; parar el equipo ante alarma de temperatura.' }
  ],
  RETEN_CIGUENAL: [
    { f: 'Fuga de aceite', m: ['FUGA', 'DESGASTE'], c: ['Retén endurecido por vida útil', 'Respiradero del cárter tapado (presión interna)', 'Eje rayado'], r: ['Respiradero del motor', 'Nivel de aceite (exceso)'], p: 'Mantener limpio el respiradero; no sobrellenar de aceite.' }
  ],
  ESCAPE: [
    { f: 'Ruido / fuga de gases', m: ['ROTURA', 'SUELTO', 'DESGASTE'], c: ['Abrazaderas sueltas por vibración', 'Silenciador corroído', 'Flexible de escape roto'], r: ['Soportes y abrazaderas', 'Corrosión'], p: 'Revisar soportes en cada 500 h.' }
  ],
  BOMBA_ACEITE: [
    { f: 'Baja presión de aceite', m: ['FALTA_MANT', 'DESGASTE', 'SIN_MOTIVO'], c: ['Nivel de aceite bajo', 'Aceite diluido con combustible o muy viejo', 'Filtro de aceite tapado', 'Desgaste interno del motor'], r: ['Nivel y estado del aceite', 'Presión con manómetro', 'Sensor de presión'], p: 'Cambiar aceite y filtro a sus horas; usar el aceite indicado.' }
  ],
  // ------------------------------ COMBUSTIBLE ------------------------------
  BOMBA_INYECTORA: [
    { f: 'No parte / pierde potencia', m: ['OBSTRUCCION', 'DESGASTE', 'SIN_MOTIVO'], c: ['Agua en el combustible', 'Aire en el sistema', 'Desgaste interno'], r: ['Decantador', 'Purgado del sistema', 'Calibración en taller especialista'], p: 'Combustible limpio y decantador drenado.' }
  ],
  BOMBA_COMB: [
    { f: 'No llega combustible', m: ['SIN_MOTIVO', 'OBSTRUCCION', 'QUEMADO'], c: ['Filtro saturado', 'Bomba eléctrica sin voltaje o quemada', 'Estanque sin combustible o con barro', 'Toma de aire en las líneas'], r: ['Voltaje en la bomba', 'Caudal de entrega', 'Líneas y abrazaderas'], p: 'No dejar que el estanque se vacíe (arrastra barro y entra aire).' }
  ],
  ESTANQUE: [
    { f: 'Fuga / barro / agua', m: ['FUGA', 'OBSTRUCCION', 'ROTURA'], c: ['Condensación por estanque medio vacío', 'Combustible contaminado', 'Golpe o corrosión'], r: ['Fondo del estanque y drenaje', 'Tapa y respiradero'], p: 'Estanque lleno al final del turno; limpieza anual.' },
    { f: 'Robo de combustible', m: ['ROBO'], c: ['Tapa sin candado'], r: ['Tapa con llave'], p: 'Tapa con candado y control de nivel.' }
  ],
  SEPARADOR: [
    { f: 'Agua en el combustible', m: ['OBSTRUCCION', 'FALTA_MANT'], c: ['No se drena el decantador', 'Combustible contaminado', 'Condensación en el estanque'], r: ['Vaso del decantador', 'Sensor de agua (si tiene)'], p: 'Drenar el decantador en el check list diario.' }
  ],
  FILTRO_COMB: [
    { f: 'Saturado / equipo pierde fuerza', m: ['OBSTRUCCION', 'FALTA_MANT'], c: ['Combustible sucio', 'Cambio atrasado', 'Filtro alternativo de baja calidad'], r: ['Horas desde el último cambio', 'Estado del decantador'], p: 'Cambiar en cada mantención; usar marcas probadas (módulo Filtros).' }
  ],
  // ------------------------------ REFRIGERACIÓN ------------------------------
  RADIADOR: [
    { f: 'Sobrecalienta', m: ['TEMPERATURA', 'OBSTRUCCION', 'FALTA_MANT'], c: ['Panal tapado por polvo (faena minera)', 'Bajo nivel de refrigerante', 'Termostato pegado cerrado', 'Correa del ventilador suelta'], r: ['Limpieza del panal (por dentro y fuera)', 'Nivel y concentración de refrigerante', 'Temperatura de entrada vs salida'], p: 'Soplar el radiador en cada 250 h (más seguido en faena con polvo).' },
    { f: 'Fuga', m: ['FUGA', 'ROTURA', 'GOLPE'], c: ['Panal picado por golpe o vibración', 'Corrosión por refrigerante viejo o agua sola', 'Tapa del radiador mala (exceso de presión)'], r: ['Prueba de presión', 'Soportes del radiador', 'Tapa'], p: 'Usar refrigerante (no agua sola) y cambiarlo según horas.' }
  ],
  ENFRIADOR: [
    { f: 'Sobrecalienta el aceite / fuga', m: ['TEMPERATURA', 'OBSTRUCCION', 'FUGA'], c: ['Panal tapado por polvo', 'Fuga en conexiones'], r: ['Limpieza', 'Conexiones'], p: 'Limpiar junto con el radiador.' }
  ],
  BOMBA_AGUA: [
    { f: 'Fuga por el sello / ruido', m: ['FUGA', 'DESGASTE'], c: ['Sello mecánico gastado', 'Rodamiento gastado por correa demasiado tensa', 'Refrigerante sucio (abrasivo)'], r: ['Orificio testigo (gotea)', 'Juego del eje'], p: 'Correa con la tensión correcta; refrigerante limpio.' }
  ],
  TERMOSTATO: [
    { f: 'Sobrecalienta / no calienta', m: ['TEMPERATURA', 'SIN_MOTIVO'], c: ['Pegado cerrado (sobrecalienta) o abierto (no llega a temperatura)', 'Sacado y no repuesto'], r: ['Prueba en agua caliente', 'Temperatura de manguera superior vs inferior'], p: 'Nunca dejar el motor sin termostato.' }
  ],
  VENTILADOR: [
    { f: 'Aspa quebrada / roza', m: ['ROTURA', 'GOLPE', 'SUELTO'], c: ['Objeto extraño', 'Soporte del motor o del radiador suelto', 'Fatiga del material'], r: ['Soportes y pernos', 'Distancia al radiador'], p: 'Revisar pernos y soportes en cada 500 h.' }
  ],
  // ------------------------------ HIDRÁULICO / AIRE ------------------------------
  MANGUERA: [
    { f: 'Revienta / fuga', m: ['ROTURA', 'FUGA', 'DESGASTE'], c: ['Roce contra estructura', 'Manguera vencida o cristalizada (sol, calor)', 'Presión sobre la nominal', 'Radio de curvatura muy cerrado'], r: ['Puntos de roce', 'Fecha y presión de trabajo de la manguera', 'Presión del sistema'], p: 'Protector espiral en zonas de roce; cambio preventivo por años de uso.' }
  ],
  MANIFOLD: [
    { f: 'Fuga / válvula pegada', m: ['FUGA', 'OBSTRUCCION', 'DESGASTE'], c: ['Sellos internos gastados', 'Aceite contaminado', 'Válvula de alivio descalibrada'], r: ['Limpieza del aceite (filtro)', 'Presiones de trabajo'], p: 'Cambiar aceite y filtro hidráulico a sus horas.' }
  ],
  VALVULA_ADMISION: [
    { f: 'No carga / no descarga / bota aire', m: ['AJUSTE', 'DESGASTE', 'OBSTRUCCION'], c: ['Sellos o membrana de la válvula gastados', 'Válvula de seguridad que abre bajo su presión (descalibrada)', 'Señal de control (solenoide) mala'], r: ['Presión de apertura de la válvula de seguridad', 'Solenoide de carga / descarga', 'Kit de reparación'], p: 'Kit de válvulas según horas del fabricante.' }
  ],
  CILINDRO: [
    { f: 'Pierde aceite / cede', m: ['FUGA', 'DESGASTE', 'ROTURA'], c: ['Sellos gastados', 'Vástago rayado (golpe o suciedad)', 'Aceite contaminado'], r: ['Vástago', 'Sellos', 'Contaminación del aceite'], p: 'Limpiar vástagos; guardar el equipo con cilindros recogidos.' }
  ],
  SELLO: [
    { f: 'Fuga', m: ['FUGA', 'DESGASTE'], c: ['Envejecimiento', 'Montaje incorrecto', 'Temperatura o presión alta'], r: ['Asiento del sello', 'Temperatura del sistema'], p: 'Usar el sello correcto y lubricar al montar.' }
  ],
  BOMBA_HIDR: [
    { f: 'Pierde presión / ruido', m: ['DESGASTE', 'OBSTRUCCION', 'SIN_MOTIVO'], c: ['Aceite contaminado o nivel bajo (cavitación)', 'Filtro de succión tapado', 'Desgaste interno'], r: ['Nivel y estado del aceite', 'Presión con manómetro', 'Ruido de cavitación'], p: 'Aceite y filtros a su tiempo; tapa del estanque cerrada.' }
  ],
  ACOPLE: [
    { f: 'Fuga / se suelta / quebrado', m: ['FUGA', 'ROTURA', 'GOLPE', 'SUELTO'], c: ['Acople arrastrado por el suelo', 'Conexión con presión (se fuerza)', 'Desgaste de los sellos'], r: ['Estado de bolitas y sellos', 'Tapas guardapolvo'], p: 'Usar tapas guardapolvo; aliviar presión antes de conectar.' }
  ],
  FILTRO_AIRE: [
    { f: 'Saturado / restricción', m: ['OBSTRUCCION', 'FALTA_MANT'], c: ['Faena con mucho polvo', 'Cambio atrasado', 'Indicador de restricción no revisado'], r: ['Indicador de restricción', 'Sello del filtro y abrazaderas'], p: 'Mantención intermedia (solo filtros de aire) en faenas con polvo; soplar en el check list.' },
    { f: 'Roto / mal sellado', m: ['ROTURA', 'GOLPE'], c: ['Soplado con aire a demasiada presión', 'Mal montaje'], r: ['Revisar con luz por dentro', 'Polvo en el ducto limpio'], p: 'Soplar desde adentro hacia afuera a baja presión; no reutilizar filtros dañados.' }
  ],
  FILTRO_ACEITE: [
    { f: 'Fuga por el filtro', m: ['FUGA', 'SUELTO'], c: ['Filtro mal apretado', 'Empaquetadura antigua pegada (doble empaque)', 'Filtro equivocado'], r: ['Que no quede el empaque viejo', 'Código del filtro (módulo Filtros)'], p: 'Lubricar el empaque y apretar a mano según el fabricante.' }
  ],
  FILTRO: [
    { f: 'Saturado', m: ['OBSTRUCCION', 'FALTA_MANT'], c: ['Cambio atrasado', 'Fluido contaminado'], r: ['Horas desde el último cambio'], p: 'Cambiar según la pauta.' }
  ],
  // ------------------------------ COMPRESORES ------------------------------
  UNIDAD_COMPRESORA: [
    { f: 'Alta temperatura / se detiene', m: ['TEMPERATURA', 'OBSTRUCCION', 'FALTA_MANT'], c: ['Enfriador de aceite tapado', 'Nivel de aceite bajo', 'Aceite degradado o equivocado', 'Separador de aceite saturado'], r: ['Nivel y tipo de aceite', 'Limpieza del enfriador', 'Diferencial del separador'], p: 'Aceite y separador según horas; limpiar enfriador en cada 250 h.' },
    { f: 'Arrastre de aceite en el aire', m: ['FUGA', 'OBSTRUCCION'], c: ['Separador de aceite dañado o saturado', 'Nivel de aceite excesivo', 'Línea de retorno tapada'], r: ['Separador', 'Nivel', 'Retorno (scavenge)'], p: 'No sobrellenar; separador a sus horas.' }
  ],
  SEP_ACEITE: [
    { f: 'Saturado / pasa aceite', m: ['OBSTRUCCION', 'FALTA_MANT', 'ROTURA'], c: ['Cambio atrasado', 'Aceite degradado', 'Golpe de presión'], r: ['Diferencial de presión', 'Consumo de aceite'], p: 'Cambio según horas del fabricante (pauta 1000).' }
  ],
  // ------------------------------ RODADO / ESTRUCTURA ------------------------------
  NEUMATICO: [
    { f: 'Pinchazo / desgaste', m: ['ROTURA', 'DESGASTE', 'GOLPE'], c: ['Terreno con material cortante', 'Presión incorrecta', 'Desalineación o maza con juego'], r: ['Presión', 'Desgaste disparejo', 'Pernos de rueda'], p: 'Presión en el check list; reapriete de pernos tras traslados.' }
  ],
  RODAMIENTO: [
    { f: 'Ruido / calienta / juego', m: ['DESGASTE', 'FALTA_MANT', 'TEMPERATURA'], c: ['Falta de grasa', 'Agua o tierra en la maza', 'Sobrecarga o golpe'], r: ['Juego de la rueda', 'Temperatura de la maza después de remolcar'], p: 'Engrase de mazas según pauta; revisar sellos.' }
  ],
  ESTABILIZADOR: [
    { f: 'Pata trabada / doblada', m: ['ROTURA', 'GOLPE', 'FALTA_MANT'], c: ['Falta de engrase', 'Remolcar con patas abajo', 'Terreno blando'], r: ['Pasadores y seguros', 'Rectitud'], p: 'Engrasar y verificar patas arriba antes de mover.' }
  ],
  PASADOR: [
    { f: 'Pasador gastado / perno suelto', m: ['DESGASTE', 'SUELTO', 'ROTURA'], c: ['Falta de engrase', 'Vibración', 'Seguro perdido'], r: ['Juego en articulaciones', 'Seguros y chavetas'], p: 'Engrase según pauta; reponer seguros.' }
  ],
  FRENO: [
    { f: 'No frena bien', m: ['DESGASTE', 'FUGA', 'AJUSTE'], c: ['Pastillas o balatas gastadas', 'Fuga de líquido (DOT4)', 'Regulación'], r: ['Espesor de pastillas', 'Nivel de líquido'], p: 'Revisión según km/horas; líquido cada 2 años.' }
  ],
  PUERTA: [
    { f: 'Chapa o bisagra rota', m: ['ROTURA', 'GOLPE', 'DESGASTE'], c: ['Golpes en traslado', 'Puerta abierta con viento', 'Falta de lubricación'], r: ['Topes y pestillos'], p: 'Lubricar bisagras; trabar puertas en traslado.' }
  ],
  PARABRISAS: [
    { f: 'Trizado / limpia no funciona', m: ['ROTURA', 'GOLPE', 'SIN_MOTIVO'], c: ['Piedras', 'Motor del limpia o fusible'], r: ['Fusible y motor'], p: 'Reparar trizaduras pequeñas antes de que crezcan.' }
  ],
  LANZA: [
    { f: 'Lanza o enganche dañado', m: ['ROTURA', 'GOLPE', 'DESGASTE'], c: ['Maniobra brusca', 'Enganche de distinto tamaño', 'Fatiga'], r: ['Soldaduras', 'Pasador y cadena de seguridad'], p: 'Revisar antes de cada traslado.' }
  ],
  CARCASA: [
    { f: 'Gabinete dañado', m: ['GOLPE', 'ROTURA'], c: ['Golpes en faena o traslado'], r: ['Sello de puertas (entra polvo)'], p: 'Reparar a tiempo para que no entre polvo ni agua.' }
  ],
  // ------------------------------ ILUMINACIÓN ------------------------------
  AMPOLLETA: [
    { f: 'Foco no enciende', m: ['QUEMADO', 'SIN_MOTIVO', 'GOLPE'], c: ['Ampolleta o LED quemado', 'Balastro o driver malo', 'Conector con agua', 'Voltaje inestable del generador'], r: ['Voltaje en el foco', 'Conector', 'Balastro'], p: 'Sellar conectores; revisar voltaje del generador de la torre.' }
  ],
  BALASTRO: [
    { f: 'Foco parpadea o no enciende', m: ['QUEMADO', 'SIN_MOTIVO'], c: ['Balastro quemado por calor o humedad', 'Voltaje fuera de rango'], r: ['Voltaje de entrada', 'Ventilación'], p: 'Gabinete ventilado y seco.' }
  ],
  MASTIL: [
    { f: 'Mástil no sube / baja / piola cortada', m: ['ROTURA', 'DESGASTE', 'FALTA_MANT'], c: ['Piola deshilachada o mal enrollada', 'Trinquete o winche sin lubricar', 'Subir con viento fuerte'], r: ['Estado de la piola en todo su largo', 'Freno del winche', 'Poleas del mástil'], p: 'Revisar piola en cada 250 h; no subir el mástil con viento sobre lo indicado.' }
  ]
};

/** Sugerencias para una pieza (y motivo si se conoce): las fallas que calzan con el motivo primero. */
export const causasProbables = (pieza, motivo = null) => {
  const l = CONOCIMIENTO[pieza] || [];
  if (!motivo || motivo === 'SIN_MOTIVO') return l;
  const a = l.filter(x => (x.m || []).includes(motivo));
  return a.length ? [...a, ...l.filter(x => !a.includes(x))] : l;
};
export const tieneConocimiento = (pieza) => Boolean(CONOCIMIENTO[pieza]);
