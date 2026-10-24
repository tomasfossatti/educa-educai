"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Paperclip,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Clock,
  Upload,
} from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, ConceptPill } from "@/components/ui/badge";
import { Card } from "@/components/ui/layout";
import { cn } from "@/lib/cn";
import { triggerOpenSidebar } from "@/lib/sidebar";

export interface AttachedFile {
  id: string;
  name: string;
  size: string;
  time: string;
  extension: "txt" | "pdf" | "docx" | "md";
}

const INITIAL_ATTACHED_FILES: AttachedFile[] = [];

interface ClassDashboardProps {
  courseId: string;
  courseName: string;
  teacherName: string;
  totalClasses?: number;
  currentClassNumber?: number;
  conceptTitle?: string;
  conceptDescription?: string;
  userOrganization?: string;
  learningGoal?: string;
  personalizedApplication?: string;
  activity?: {
    id: string;
    title: string;
    description: string;
    isUnlocked: boolean;
  } | null;
  activeConversation?: {
    id: string;
    title: string;
    messageCount: number;
  } | null;
  onAttachConversation?: (conversationId: string) => void;
}

const CLASS_QUESTIONS = [
  "¿Cómo sé si mi hipótesis se puede refutar o es solo un deseo?",
  "¿Qué métrica de validación elijo para medir la demanda real?",
  "¿Cómo defino el umbral de éxito antes de realizar la prueba?",
  "¿Qué diferencia existe entre un problema real y la solución imaginada?",
  "¿Qué experimento simple y de bajo costo puedo probar esta semana?",
  "¿En qué plazo exacto conviene medir los resultados del experimento?",
];

export function ClassDashboard({
  courseId,
  courseName,
  teacherName,
  totalClasses = 8,
  currentClassNumber = 4,
  conceptTitle = "hipótesis falsables",
  conceptDescription,
  userOrganization = "tu restaurante en el centro de Rosario",
  learningGoal,
  activity = {
    id: "practice-logistics",
    title: "Práctica: hipótesis falsables en logística de última milla",
    description:
      "Una empresa de logística quiere ofrecer entregas en franjas de una hora, con un costo extra, a clientes de comercios online. No sabe si alguien pagaría por ese servicio.",
    isUnlocked: false,
  },
  activeConversation,
  onAttachConversation,
}: ClassDashboardProps) {
  const [classElapsedMinutes, setClassElapsedMinutes] = useState(38);
  const totalClassMinutes = 120;
  const breakMinute = 60;

  const [isUnlocked, setIsUnlocked] = useState(activity?.isUnlocked ?? false);
  const [attached, setAttached] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);
  const [activeButton, setActiveButton] = useState<"genera" | "adjunta" | "conversa" | null>(null);

  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>(INITIAL_ATTACHED_FILES);
  const [isDragging, setIsDragging] = useState(false);

  const attachDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (attachDropdownRef.current && !attachDropdownRef.current.contains(e.target as Node)) {
        setIsAttachOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsAttachOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const [questionIndex, setQuestionIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setQuestionIndex((prev) => (prev + 1) % CLASS_QUESTIONS.length);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const handleGeneraClick = () => {
    setActiveButton((prev) => (prev === "genera" ? null : "genera"));
    triggerOpenSidebar();
  };

  const handleAttachClick = () => {
    setIsAttachOpen((prev) => !prev);
    setActiveButton((prev) => (prev === "adjunta" ? null : "adjunta"));
  };

  const handleConversaClick = () => {
    setActiveButton((prev) => (prev === "conversa" ? null : "conversa"));
    window.dispatchEvent(
      new CustomEvent("educai:open-floating-tutor", {
        detail: {
          courseId,
          courseName,
          conceptTitle,
          conceptDescription,
          initialQuestion: undefined,
        },
      })
    );
  };

  const handleAskQuestion = (question: string) => {
    setActiveButton("conversa");
    window.dispatchEvent(
      new CustomEvent("educai:open-floating-tutor", {
        detail: {
          courseId,
          courseName,
          conceptTitle,
          conceptDescription,
          initialQuestion: question,
        },
      })
    );
  };

  const processFiles = (files: File[]) => {
    const validExtensions = ["txt", "pdf", "docx", "md"];
    const newFiles: AttachedFile[] = [];

    files.forEach((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext && validExtensions.includes(ext)) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        const sizeKb = Math.round(file.size / 1024);
        const displaySize = file.size >= 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;

        newFiles.push({
          id: Math.random().toString(36).substring(7),
          name: file.name,
          size: displaySize,
          time: "Recién",
          extension: ext as "txt" | "pdf" | "docx" | "md",
        });
      }
    });

    if (newFiles.length > 0) {
      setAttachedFiles((prev) => [...prev, ...newFiles]);
      setAttached(true);
      setIsAttachOpen(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files));
    }
  };

  const effectiveConcept = conceptTitle || "hipótesis falsables";
  const effectiveOrg = userOrganization || "tu restaurante en el centro de Rosario";
  const effectiveDescription =
    conceptDescription ||
    "Aprender a formular afirmaciones claras que un experimento real pueda desmentir, definiendo una métrica observable y un umbral de éxito antes de invertir tiempo o dinero.";

  const courseProgressPercent = Math.round((currentClassNumber / totalClasses) * 100);

  const minutesToBreak = Math.max(0, breakMinute - classElapsedMinutes);
  const minutesToEnd = Math.max(0, totalClassMinutes - classElapsedMinutes);

  const block1Percent = Math.min(100, Math.round((Math.min(classElapsedMinutes, breakMinute) / breakMinute) * 100));
  const block2Elapsed = Math.max(0, classElapsedMinutes - breakMinute);
  const block2Duration = totalClassMinutes - breakMinute;
  const block2Percent = Math.min(100, Math.round((block2Elapsed / block2Duration) * 100));
  const hasBlock2Started = classElapsedMinutes >= breakMinute;

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto py-2">
      {/* Avance general de la materia */}
      <Card padding="sm" className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted">
          <span className="flex items-center gap-1.5 font-medium text-ink-2">
            <span className="size-1.5 rounded-full bg-primary" />
            <span>Avance general de la materia</span>
          </span>
          <span className="font-mono font-medium text-ink">
            Clase {currentClassNumber} de {totalClasses} ({courseProgressPercent}%)
          </span>
        </div>

        {/* Barra de progreso con pista limpia sin bordes de botón */}
        <div role="progressbar" aria-valuenow={courseProgressPercent} aria-valuemin={0} aria-valuemax={100} className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-colors duration-200"
            style={{ width: `${courseProgressPercent}%` }}
          />
        </div>

        {/* Hitos con componentes Badge */}
        <div className="pt-1">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Badge tone="success" className="justify-start gap-1.5">
              <Check className="size-3 shrink-0" />
              <span className="truncate">Hito 1: Segmentación</span>
            </Badge>

            <Badge tone="success" className="justify-start gap-1.5">
              <Check className="size-3 shrink-0" />
              <span className="truncate">Hito 2: Propuesta</span>
            </Badge>

            <Badge tone="primary" className="justify-start gap-1.5">
              <span className="size-1.5 rounded-full bg-primary shrink-0 animate-pulse" />
              <span className="truncate">Hito 3: En curso hoy</span>
            </Badge>

            <Badge tone="muted" className="justify-start gap-1.5">
              <span className="size-1.5 rounded-full bg-muted shrink-0" />
              <span className="truncate">Hito 4: Validación</span>
            </Badge>
          </div>
        </div>
      </Card>

      {/* Estado de la clase en curso */}
      <Card padding="sm" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge tone="success">Clase en curso</Badge>
          <div className="text-xs font-medium text-muted flex items-center gap-1.5">
            <Clock className="size-3.5" />
            {minutesToBreak > 0 ? (
              <span>Recreo en {minutesToBreak} min</span>
            ) : (
              <span>Segunda parte · Termina en {minutesToEnd} min</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="text-xs text-muted font-medium flex justify-between">
              <span>Bloque 1</span>
              <span>{block1Percent}%</span>
            </div>
            <div role="progressbar" aria-valuenow={block1Percent} aria-valuemin={0} aria-valuemax={100} className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-success transition-colors duration-200"
                style={{ width: `${block1Percent}%` }}
              />
            </div>
          </div>

          <div className={cn("space-y-1.5", !hasBlock2Started && "opacity-50")}>
            <div className="text-xs text-muted font-medium flex justify-between">
              <span>Bloque 2</span>
              <span>{hasBlock2Started ? `${block2Percent}%` : "En espera"}</span>
            </div>
            <div role="progressbar" aria-valuenow={block2Percent} aria-valuemin={0} aria-valuemax={100} className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-colors duration-200"
                style={{ width: `${block2Percent}%` }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Aplicación personalizada y sugerencia reflexiva */}
      <Card padding="lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink leading-snug">
              Hoy vas a aplicar{" "}
              <ConceptPill tone="primary">{effectiveConcept.toLowerCase()}</ConceptPill>{" "}
              en <span className="text-ink-2">{effectiveOrg}</span>
            </h1>
            {effectiveDescription && (
              <p className="text-sm text-muted leading-relaxed">
                {effectiveDescription}
              </p>
            )}
          </div>

          {/* Pregunta interactiva socrática usando Button size=card */}
          <div className="shrink-0 w-full lg:w-80">
            <Button
              variant="secondary"
              size="card"
              onClick={() => handleAskQuestion(CLASS_QUESTIONS[questionIndex])}
              className="w-full text-left"
              aria-label="Preguntarle a la IA esta consulta"
            >
              <p className="text-xs sm:text-sm text-ink leading-relaxed min-h-10 italic">
                “{CLASS_QUESTIONS[questionIndex]}”
              </p>
              <div className="flex justify-end items-center w-full">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <span>Preguntale a la IA</span>
                  <ArrowRight className="size-3.5" />
                </span>
              </div>
            </Button>
          </div>
        </div>
      </Card>

      {/* Acciones principales: Generá, Adjuntá, Conversá */}
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 py-1 shrink-0">
        <Button
          variant={activeButton === "genera" ? "primary" : "secondary"}
          size="md"
          onClick={handleGeneraClick}
          className="gap-2"
        >
          <Sparkles className="size-4" />
          <span>Generá</span>
        </Button>

        <div className="relative">
          <Button
            variant={attachedFiles.length > 0 || isAttachOpen ? "primary" : "secondary"}
            size="md"
            onClick={handleAttachClick}
            className="gap-2"
            aria-expanded={isAttachOpen}
          >
            {attachedFiles.length > 0 ? (
              <>
                <Check className="size-4" />
                <span>Adjuntado ({attachedFiles.length})</span>
              </>
            ) : (
              <>
                <Paperclip className="size-4" />
                <span>Adjuntá</span>
              </>
            )}
          </Button>

          {/* Desplegable de subida */}
          {isAttachOpen && (
            <div
              ref={attachDropdownRef}
              className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-80 max-w-full rounded-xl border border-line bg-surface p-4 shadow-lg z-50 animate-in fade-in duration-150 space-y-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.pdf,.docx,.md"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                variant="secondary"
                size="dropzone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files) {
                    processFiles(Array.from(e.dataTransfer.files));
                  }
                }}
                className={cn(
                  "w-full flex-col",
                  isDragging && "border-primary"
                )}
              >
                <Upload className="size-6 text-muted" />
                <p className="text-xs font-semibold text-ink">
                  Subí o arrastrá tu archivo (.txt, .pdf, .md)
                </p>
                <p className="text-xs text-muted">Para vincular evidencia a esta clase</p>
              </Button>
            </div>
          )}
        </div>

        <Button
          variant={activeButton === "conversa" ? "primary" : "secondary"}
          size="md"
          onClick={handleConversaClick}
          className="gap-2"
        >
          <MessageSquare className="size-4" />
          <span>Conversá</span>
        </Button>
      </div>

      {/* Tarjeta de actividad / Challenge de la clase */}
      <Card padding="md" className="space-y-3">
        <div className="flex items-center justify-between">
          <Badge tone={isUnlocked ? "success" : "muted"}>
            {isUnlocked ? "Actividad activa" : "Actividad en espera"}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsUnlocked(!isUnlocked)}
            className="text-xs text-muted hover:text-primary underline"
          >
            {isUnlocked ? "Simular: Bloquear" : "Simular: Desbloquear como docente"}
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1 flex-1">
            <h3 className="text-base font-semibold text-ink">
              {activity?.title || "Práctica: hipótesis falsables en logística de última milla"}
            </h3>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              {activity?.description ||
                "Una empresa de logística quiere ofrecer entregas en franjas de una hora, con un costo extra, a clientes de comercios online. No sabe si alguien pagaría por ese servicio."}
            </p>
          </div>

          <div className="shrink-0">
            {isUnlocked ? (
              <ButtonLink
                href={`/s/courses/${courseId}/activities`}
                variant="primary"
                size="sm"
              >
                Abrir actividad
              </ButtonLink>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                disabled
              >
                En espera
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
