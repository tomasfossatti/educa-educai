import {
  StudentInteractionSession,
} from './types.js';
import {
  InMemoryHeatmapRepository,
  generatePseudonymousStudentId,
} from './firestore-schema.js';
import { HeatmapAggregationService } from './aggregator-service.js';
import { formatHeatmapReportAsMarkdown } from './teacher-dashboard-model.js';

/**
 * Script de demostración interactiva: Simula la ingesta de dudas en Educai
 * y compila el Mapa de Calor para el docente.
 */
export async function runHeatmapSimulation(): Promise<void> {
  console.error('================================================================');
  console.error('  Educai: Demostración del Motor de Mapa de Calor (Heatmap)     ');
  console.error('================================================================\n');

  const repository = new InMemoryHeatmapRepository();
  const service = new HeatmapAggregationService(repository);

  const courseId = 9821;
  const courseName = 'Arquitectura de Software y Patrones de Diseño (INF346)';
  const totalStudents = 45;

  const syllabusConcepts = [
    'Inyección de Dependencias (IoC)',
    'Patrón Repositorio y Capa de Datos',
    'Concurrencia y Bloqueos (Deadlocks)',
    'Mapeo Objeto-Relacional (ORM) y Ciclo de Vida de Entidades',
    'Transacciones ACID y Aislamiento',
  ];

  console.error('1. Simulando ingesta de 12 sesiones de tutoría socrática en Firestore...');

  // Mock de 12 interacciones realistas con diferentes niveles de fricción
  const mockSessions: StudentInteractionSession[] = [
    {
      id: 'sess_001',
      courseId,
      anonymousStudentId: generatePseudonymousStudentId('alumno_gonzalez'),
      moduleUnit: 'Módulo 2: Desacoplamiento de Componentes',
      startedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      endedAt: new Date(Date.now() - 3600000 * 23.5).toISOString(),
      durationSeconds: 1800,
      primaryConcept: 'Inyección de Dependencias (IoC)',
      synthesizedDoubt: 'No comprende por qué no debe instanciar el servicio con "new" dentro del controlador.',
      dialogueTurnCount: 8,
      resolutionStatus: 'blocked',
      struggleLevel: 'critical',
      cognitiveFrictionScore: 85,
      tags: ['ioc', 'controller', 'new-operator'],
    },
    {
      id: 'sess_002',
      courseId,
      anonymousStudentId: generatePseudonymousStudentId('alumno_perez'),
      moduleUnit: 'Módulo 2: Desacoplamiento de Componentes',
      startedAt: new Date(Date.now() - 3600000 * 18).toISOString(),
      endedAt: new Date(Date.now() - 3600000 * 17.7).toISOString(),
      durationSeconds: 1080,
      primaryConcept: 'Inyección de Dependencias (IoC)',
      synthesizedDoubt: 'Confunde inyección por constructor con Service Locator.',
      dialogueTurnCount: 6,
      resolutionStatus: 'partially_resolved',
      struggleLevel: 'high',
      cognitiveFrictionScore: 70,
      tags: ['ioc', 'service-locator', 'constructor'],
    },
    {
      id: 'sess_003',
      courseId,
      anonymousStudentId: generatePseudonymousStudentId('alumno_martinez'),
      moduleUnit: 'Módulo 2: Desacoplamiento de Componentes',
      startedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
      endedAt: new Date(Date.now() - 3600000 * 11.8).toISOString(),
      durationSeconds: 720,
      primaryConcept: 'Inyección de Dependencias (IoC)',
      synthesizedDoubt: 'Duda sobre cómo registrar interfaces en el contenedor de IoC.',
      dialogueTurnCount: 4,
      resolutionStatus: 'resolved',
      struggleLevel: 'medium',
      cognitiveFrictionScore: 40,
      tags: ['container', 'interfaces'],
    },
    {
      id: 'sess_004',
      courseId,
      anonymousStudentId: generatePseudonymousStudentId('alumno_silva'),
      moduleUnit: 'Módulo 2: Desacoplamiento de Componentes',
      startedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
      endedAt: new Date(Date.now() - 3600000 * 7.5).toISOString(),
      durationSeconds: 1800,
      primaryConcept: 'Inyección de Dependencias (IoC)',
      synthesizedDoubt: 'El contenedor le arroja Circular Dependency Exception y no entiende cómo romper el ciclo.',
      dialogueTurnCount: 10,
      resolutionStatus: 'blocked',
      struggleLevel: 'critical',
      cognitiveFrictionScore: 90,
      tags: ['circular-dependency', 'ioc'],
    },
    {
      id: 'sess_005',
      courseId,
      anonymousStudentId: generatePseudonymousStudentId('alumno_diaz'),
      moduleUnit: 'Módulo 3: Persistencia y Capa de Datos',
      startedAt: new Date(Date.now() - 3600000 * 15).toISOString(),
      endedAt: new Date(Date.now() - 3600000 * 14.7).toISOString(),
      durationSeconds: 1080,
      primaryConcept: 'Patrón Repositorio y Capa de Datos',
      synthesizedDoubt: 'No sabe si poner lógica de validación de negocio dentro del Repositorio o en el Servicio.',
      dialogueTurnCount: 7,
      resolutionStatus: 'resolved',
      struggleLevel: 'medium',
      cognitiveFrictionScore: 45,
      tags: ['repository', 'business-logic'],
    },
    {
      id: 'sess_006',
      courseId,
      anonymousStudentId: generatePseudonymousStudentId('alumno_torres'),
      moduleUnit: 'Módulo 3: Persistencia y Capa de Datos',
      startedAt: new Date(Date.now() - 3600000 * 10).toISOString(),
      endedAt: new Date(Date.now() - 3600000 * 9.8).toISOString(),
      durationSeconds: 720,
      primaryConcept: 'Patrón Repositorio y Capa de Datos',
      synthesizedDoubt: 'Confunde IQueryable con IEnumerable y genera problemas de performance N+1.',
      dialogueTurnCount: 5,
      resolutionStatus: 'resolved',
      struggleLevel: 'medium',
      cognitiveFrictionScore: 50,
      tags: ['orm', 'n-plus-1', 'performance'],
    },
    {
      id: 'sess_007',
      courseId,
      anonymousStudentId: generatePseudonymousStudentId('alumno_alvarez'),
      moduleUnit: 'Módulo 4: Concurrencia y Rendimiento',
      startedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
      endedAt: new Date(Date.now() - 3600000 * 5.4).toISOString(),
      durationSeconds: 2160,
      primaryConcept: 'Concurrencia y Bloqueos (Deadlocks)',
      synthesizedDoubt: 'No logra reproducir un interbloqueo ni entender por qué ocurre bloqueo mutuo.',
      dialogueTurnCount: 11,
      resolutionStatus: 'blocked',
      struggleLevel: 'critical',
      cognitiveFrictionScore: 95,
      tags: ['deadlock', 'threads', 'mutex'],
    },
    {
      id: 'sess_008',
      courseId,
      anonymousStudentId: generatePseudonymousStudentId('alumno_suarez'),
      moduleUnit: 'Módulo 4: Concurrencia y Rendimiento',
      startedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      endedAt: new Date(Date.now() - 3600000 * 3.6).toISOString(),
      durationSeconds: 1440,
      primaryConcept: 'Concurrencia y Bloqueos (Deadlocks)',
      synthesizedDoubt: 'Duda sobre la diferencia entre Race Condition y Deadlock.',
      dialogueTurnCount: 6,
      resolutionStatus: 'partially_resolved',
      struggleLevel: 'high',
      cognitiveFrictionScore: 75,
      tags: ['race-condition', 'deadlock'],
    },
  ];

  for (const session of mockSessions) {
    await repository.recordInteractionSession(session);
  }

  console.error(`   ✅ ${mockSessions.length} interacciones guardadas con hashes de privacidad (ej: ${mockSessions[0].anonymousStudentId}).\n`);

  console.error('2. Ejecutando Motor de Agregación y Agrupamiento Semántico...');
  const report = await service.generateCourseHeatmap({
    courseId,
    courseName,
    periodName: 'Primer Semestre 2026 (Siglo 21)',
    totalEnrolledStudents: totalStudents,
    syllabusConcepts,
    timeframeDays: 7,
  });

  console.error('\n3. Generando Visualización del Dashboard del Docente:\n');
  const markdownView = formatHeatmapReportAsMarkdown(report);
  console.log(markdownView);
}

if (process.argv[1] && (process.argv[1].endsWith('demo-mock.ts') || process.argv[1].endsWith('demo-mock.js'))) {
  runHeatmapSimulation().catch((err) => {
    console.error('Error en la simulación:', err);
    process.exit(1);
  });
}
