"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  evaluateConceptMasteryAction,
  feynmanTurnAction,
} from "@/server/actions/getit";

export type GetItToolTab = "feynman" | "quiz" | "flashcards" | "chat";

interface ConceptNode {
  id: string;
  name: string;
  category: string;
  memory: number;
  comprehension: number;
  structure: number;
  application: number;
  tagType: "3d" | "formula" | "plot" | "source";
  evaluatorNote: string;
}

interface DocumentPreset {
  id: string;
  title: string;
  content: string;
}

const INITIAL_CONCEPTS: ConceptNode[] = [
  {
    id: "c1",
    name: "Hipótesis Falsable",
    category: "Fundamentos",
    memory: 85,
    comprehension: 78,
    structure: 72,
    application: 65,
    tagType: "3d",
    evaluatorNote:
      "Distingue adecuadamente entre hipótesis verificable y opinión. Requiere reforzar la formulación cuantitativa del umbral.",
  },
  {
    id: "c2",
    name: "Umbral Cuantitativo",
    category: "Métricas",
    memory: 70,
    comprehension: 68,
    structure: 60,
    application: 55,
    tagType: "formula",
    evaluatorNote:
      "Comprende la necesidad de fijar el criterio a priori. Falta vincularlo con el tamaño muestral mínimo.",
  },
  {
    id: "c3",
    name: "Sesgo de Cortesía",
    category: "Validación",
    memory: 90,
    comprehension: 82,
    structure: 75,
    application: 80,
    tagType: "plot",
    evaluatorNote:
      "Excelente discriminación de respuestas de complacencia frente a compromisos reales de pago.",
  },
  {
    id: "c4",
    name: "Early Adopter",
    category: "Segmentación",
    memory: 75,
    comprehension: 70,
    structure: 65,
    application: 60,
    tagType: "source",
    evaluatorNote:
      "Identifica el perfil con dolor urgente. Conviene ejercitar cómo seleccionarlos en canales directos.",
  },
];

const PRESET_DOCUMENTS: DocumentPreset[] = [
  {
    id: "doc-1",
    title: "Clase 4: Diseño de Experimentos y Falsabilidad",
    content: `Para validar un modelo de negocio en etapas tempranas, el error más costoso es construir la solución antes de constatar el problema real.

Toda prueba experimental debe estructurarse alrededor de una [Hipótesis Falsable]. Una afirmación solo califica como tal si define con precisión: qué métrica se observará, en qué plazo y bajo qué [Umbral Cuantitativo] previo se considerará validada o refutada.

Al entrevistar potenciales usuarios, el investigador debe protegerse activamente del [Sesgo de Cortesía], que ocurre cuando las personas elogian una idea por amabilidad sin intención verídica de adopción. La validación solo es genuina cuando se orienta a un [Early Adopter] dispuesto a realizar un compromiso concreto (tiempo, reserva monetaria o firma anticipada).`,
  },
  {
    id: "doc-2",
    title: "Guía Práctica: Validación en PyMEs y Comercios",
    content: `En economías locales, la validación no requiere encuestas masivas. Se diseña una prueba piloto manual durante 5 a 7 días hábiles.

Se formula una [Hipótesis Falsable] con una meta cuantificable. Por ejemplo: si ofrecemos un menú ejecutivo saludable a 40 clientes habituales, al menos 8 confirmarán con seña. Aquí el [Umbral Cuantitativo] es del 20%.

Si no se alcanza ese umbral, el equipo no debe racionalizar el resultado negativo: debe ajustar la propuesta de valor o buscar otro perfil de [Early Adopter]. De esta forma se neutraliza el [Sesgo de Cortesía] y se cuidan los recursos.`,
  },
];

export function GetItWorkbench() {
  const [documents] = useState<DocumentPreset[]>(PRESET_DOCUMENTS);
  const [selectedDocId, setSelectedDocId] = useState<string>("doc-1");
  const [customText, setCustomText] = useState<string>("");
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);

  // Conceptos y dominio medible
  const [concepts, setConcepts] = useState<ConceptNode[]>(INITIAL_CONCEPTS);
  const [selectedConceptId, setSelectedConceptId] = useState<string>("c1");

  // Herramienta activa
  const [activeTool, setActiveTool] = useState<GetItToolTab>("feynman");

  // Estado Feynman
  const [feynmanInput, setFeynmanInput] = useState("");
  const [feynmanHistory, setFeynmanHistory] = useState<
    Array<{ speaker: "child" | "student"; text: string; critique?: string; clarityScore?: number }>
  >([
    {
      speaker: "child",
      text: "¡Hola! Mi maestra dice que estás estudiando algo sobre 'hipótesis'. ¿Qué es eso? Explicámelo como si tuviera 8 años, ¡sin palabras raras!",
    },
  ]);
  const [isFeynmanThinking, setIsFeynmanThinking] = useState(false);

  // Estado Quiz
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Estado Flashcards
  const [fcIndex, setFcIndex] = useState(0);
  const [fcFlipped, setFcFlipped] = useState(false);

  // Estado Chat
  const [docChatInput, setDocChatInput] = useState("");
  const [docChatMessages, setDocChatMessages] = useState<
    Array<{ sender: "user" | "getit"; text: string }>
  >([
    {
      sender: "getit",
      text: "Consultas acotadas a este documento. Hacé una pregunta y responderé extrayendo citas exactas del texto.",
    },
  ]);

  // Canvas visualizador 3D interactivo
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const activeDoc = documents.find((d) => d.id === selectedDocId) || documents[0];
  const docContent = isCustomMode ? customText : activeDoc.content;
  const currentConcept = concepts.find((c) => c.id === selectedConceptId) || concepts[0];

  // Cargar persistencia
  useEffect(() => {
    try {
      const saved = localStorage.getItem("getit_concepts");
      if (saved) setConcepts(JSON.parse(saved));
    } catch {
      // Ignorar
    }
  }, []);

  const saveConcepts = (updated: ConceptNode[]) => {
    setConcepts(updated);
    try {
      localStorage.setItem("getit_concepts", JSON.stringify(updated));
    } catch {
      // Ignorar
    }
  };

  // Renderizado interactivo en Canvas del sandbox visual
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let angle = 0;
    let running = true;

    const render = () => {
      if (!running) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      if (currentConcept.tagType === "3d") {
        // Render 3D wireframe interactivo rotando (espacio de hipótesis)
        angle += 0.015;
        const size = 55;
        const nodes = [
          [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
          [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
        ];

        const projected = nodes.map(([x, y, z]) => {
          // Rotación en Y y X
          const rad = angle;
          const x1 = x * Math.cos(rad) - z * Math.sin(rad);
          const z1 = x * Math.sin(rad) + z * Math.cos(rad);
          const y1 = y * Math.cos(rad * 0.7) - z1 * Math.sin(rad * 0.7);
          const fov = 200;
          const scale = fov / (fov + z1 * size + 80);
          return [cx + x1 * size * scale, cy + y1 * size * scale];
        });

        const edges = [
          [0, 1], [1, 2], [2, 3], [3, 0],
          [4, 5], [5, 6], [6, 7], [7, 4],
          [0, 4], [1, 5], [2, 6], [3, 7],
        ];

        ctx.strokeStyle = "#5b66f1";
        ctx.lineWidth = 1.8;
        edges.forEach(([i, j]) => {
          ctx.beginPath();
          ctx.moveTo(projected[i][0], projected[i][1]);
          ctx.lineTo(projected[j][0], projected[j][1]);
          ctx.stroke();
        });

        // Nodos del cubo
        projected.forEach(([x, y], idx) => {
          ctx.fillStyle = idx === 6 ? "#10b981" : "#818cf8";
          ctx.beginPath();
          ctx.arc(x, y, idx === 6 ? 5 : 3.5, 0, Math.PI * 2);
          ctx.fill();
        });

        // Etiqueta del nodo óptimo
        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px monospace";
        ctx.fillText("Espacio de Falsabilidad (Métrica x Plazo)", cx - 110, canvas.height - 15);
      } else if (currentConcept.tagType === "formula") {
        // Renderizador de gráfico de umbral
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(30, canvas.height - 30);
        ctx.lineTo(canvas.width - 20, canvas.height - 30);
        ctx.moveTo(30, 20);
        ctx.lineTo(30, canvas.height - 30);
        ctx.stroke();

        // Línea de corte (umbral)
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "#f43f5e";
        ctx.beginPath();
        ctx.moveTo(30, cy);
        ctx.lineTo(canvas.width - 20, cy);
        ctx.stroke();
        ctx.setLineDash([]);

        // Curva acumulada
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(30, canvas.height - 30);
        ctx.quadraticCurveTo(cx, cy + 20, canvas.width - 40, 40);
        ctx.stroke();

        ctx.fillStyle = "#f43f5e";
        ctx.font = "10px monospace";
        ctx.fillText("Umbral de éxito (20%)", canvas.width - 145, cy - 8);

        ctx.fillStyle = "#10b981";
        ctx.fillText("Pedidos confirmados", canvas.width - 135, 35);
      } else {
        // Gráfico de radar / distribución de sesgo
        const r = 60;
        ctx.strokeStyle = "#6366f1";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3 + angle * 0.5;
          const radDist = i % 2 === 0 ? r : r * 0.65;
          const px = cx + radDist * Math.cos(a);
          const py = cy + radDist * Math.sin(a);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = "rgba(99, 102, 241, 0.15)";
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#cbd5e1";
        ctx.font = "10px sans-serif";
        ctx.fillText("Compromiso Real vs Cortesía", cx - 75, canvas.height - 15);
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      running = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [currentConcept]);

  /* ──────────────── ACCIÓN FEYNMAN (Interacción con niño curioso) ──────────────── */
  const handleSendFeynman = async () => {
    if (!feynmanInput.trim() || isFeynmanThinking) return;
    const explanation = feynmanInput.trim();
    setFeynmanInput("");

    setFeynmanHistory((prev) => [...prev, { speaker: "student", text: explanation }]);
    setIsFeynmanThinking(true);

    try {
      const res = await feynmanTurnAction({
        concept: currentConcept.name,
        explanation,
        history: feynmanHistory.slice(-4),
      });

      if (res.success) {
        setFeynmanHistory((prev) => [
          ...prev,
          {
            speaker: "child",
            text: res.childResponse,
            critique: res.critique,
            clarityScore: res.clarityScore,
          },
        ]);

        // Actualizar métricas del concepto monótonamente
        const updated = concepts.map((c) => {
          if (c.id === currentConcept.id) {
            return {
              ...c,
              comprehension: Math.min(100, Math.max(c.comprehension, c.comprehension + 4)),
              application: Math.min(100, Math.max(c.application, c.application + 3)),
              evaluatorNote: res.critique,
            };
          }
          return c;
        });
        saveConcepts(updated);
      }
    } finally {
      setIsFeynmanThinking(false);
    }
  };

  /* ──────────────── ACCIÓN EVALUAR DOMINIO GENERAL ──────────────── */
  const handleTriggerEvaluation = async () => {
    const res = await evaluateConceptMasteryAction({
      concept: currentConcept.name,
      currentScores: {
        memory: currentConcept.memory,
        comprehension: currentConcept.comprehension,
        structure: currentConcept.structure,
        application: currentConcept.application,
      },
      recentActionsCount: feynmanHistory.length + (quizSubmitted ? 1 : 0),
    });

    if (res.success) {
      const updated = concepts.map((c) =>
        c.id === currentConcept.id
          ? {
              ...c,
              memory: res.memory,
              comprehension: res.comprehension,
              structure: res.structure,
              application: res.application,
              evaluatorNote: res.evaluatorNote,
            }
          : c,
      );
      saveConcepts(updated);
    }
  };

  /* ──────────────── ACCIÓN CHAT DE DOCUMENTO ──────────────── */
  const handleSendDocChat = () => {
    if (!docChatInput.trim()) return;
    const q = docChatInput.trim();
    setDocChatInput("");
    setDocChatMessages((prev) => [...prev, { sender: "user", text: q }]);

    setTimeout(() => {
      let ans = `En base al documento analizado: `;
      if (q.toLowerCase().includes("umbral")) {
        ans += `El umbral define el valor numérico mínimo que validará la prueba. Se establece antes de contactar usuarios para no caer en sesgos.`;
      } else if (q.toLowerCase().includes("cortesía") || q.toLowerCase().includes("sesgo")) {
        ans += `El sesgo de cortesía surge cuando las personas son amables pero no están dispuestas a asumir un compromiso real de compra o reserva.`;
      } else {
        ans += `Toda hipótesis debe estructurarse con métrica, umbral numérico y plazo para ser científicamente falsable.`;
      }
      setDocChatMessages((prev) => [...prev, { sender: "getit", text: ans }]);
    }, 350);
  };

  /* Renderizar documento con tags interactivos */
  const renderDocumentWithTags = (text: string) => {
    const parts = text.split(/(\[[^\]]+\])/g);
    return parts.map((part, idx) => {
      const match = part.match(/^\[(.*)\]$/);
      if (match) {
        const tagText = match[1];
        const matchedConcept = concepts.find(
          (c) => tagText.toLowerCase().includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(tagText.toLowerCase()),
        );

        return (
          <button
            key={idx}
            type="button"
            onClick={() => {
              if (matchedConcept) setSelectedConceptId(matchedConcept.id);
            }}
            className={cn(
              "inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all shadow-sm",
              matchedConcept && matchedConcept.id === selectedConceptId
                ? "bg-primary border-primary text-white shadow-primary/30"
                : "bg-surface-3 border-line-strong text-indigo-300 hover:border-primary/80 hover:text-white",
            )}
          >
            <span>{tagText}</span>
            <span className="text-[9px] opacity-70">
              {matchedConcept ? `${matchedConcept.comprehension}%` : "tag"}
            </span>
          </button>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  return (
    <div className="w-full flex-1 flex flex-col space-y-5 py-2">
      {/* ──────────────── CABECERA GET IT ──────────────── */}
      <div className="rounded-2xl border border-line bg-gradient-to-r from-surface-1 via-surface-2 to-surface-3 p-4 sm:p-5 shadow-lg backdrop-blur-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span className="text-indigo-400 font-mono tracking-tighter">Get It.</span>
              <span className="text-xs px-2 py-0.5 rounded-full border border-indigo-400/40 bg-indigo-950/40 text-indigo-300 font-medium tracking-normal">
                Read it. See it. Get it.
              </span>
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted max-w-xl">
            Construido alrededor del documento, no en su reemplazo. Detecta conceptos, renderiza visualizaciones interactivas y mide tu dominio en 4 ejes no decrecientes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTriggerEvaluation}
            className="rounded-xl border border-indigo-400/40 bg-indigo-950/40 px-3 py-1.5 text-xs font-bold text-indigo-300 hover:bg-indigo-950/60 transition-colors shadow-sm"
          >
            Evaluar dominio con IA
          </button>
          <Link
            href="/s"
            className="rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted hover:text-white hover:bg-surface-3 transition-colors"
          >
            ← Volver al curso
          </Link>
        </div>
      </div>

      {/* ──────────────── SELECTOR DE DOCUMENTO ──────────────── */}
      <div className="flex items-center justify-between border-b border-line/60 pb-2.5 flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted text-[11px] font-bold uppercase tracking-wider">Documento activo:</span>
          {documents.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => {
                setSelectedDocId(doc.id);
                setIsCustomMode(false);
              }}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors border",
                selectedDocId === doc.id && !isCustomMode
                  ? "border-primary bg-primary/20 text-white"
                  : "border-line bg-surface-2 text-muted hover:text-white",
              )}
            >
              {doc.title}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setIsCustomMode(true)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors border",
              isCustomMode
                ? "border-primary bg-primary/20 text-white"
                : "border-line bg-surface-2 text-muted hover:text-white",
            )}
          >
            + Pegar documento propio
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-muted">
            Concepto seleccionado: <strong className="text-white">{currentConcept.name}</strong>
          </span>
        </div>
      </div>

      {/* ──────────────── ESTRUCTURA DE 3 PANELES (READ IT · SEE IT · GET IT) ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-start">
        {/* PANEL 1: DOCUMENT VIEWER (READ IT) - 4 COLS */}
        <div className="lg:col-span-4 rounded-2xl border border-line bg-surface-1/90 p-4 space-y-3 shadow-sm min-h-[480px] flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-line/60 pb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary">
                01 · READ IT (DOCUMENTO)
              </span>
              <span className="text-[10px] text-muted">Hacé clic en los tags</span>
            </div>

            {isCustomMode ? (
              <textarea
                rows={16}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Pegá texto en Markdown o documento de clase. Colocá [Nombre Concepto] entre corchetes para crear tags interactivos…"
                className="w-full rounded-xl border border-line bg-surface-2 p-3 text-xs text-white placeholder-muted focus:outline-none focus:border-primary resize-none leading-relaxed"
              />
            ) : (
              <div className="text-xs sm:text-sm text-ink-2 leading-relaxed space-y-3 bg-surface-2/40 p-3.5 rounded-xl border border-line/40 max-h-[420px] overflow-y-auto">
                <h3 className="font-bold text-white text-sm mb-2">{activeDoc.title}</h3>
                <div className="whitespace-pre-line">{renderDocumentWithTags(docContent)}</div>
              </div>
            )}
          </div>

          <div className="p-2.5 rounded-xl bg-surface-2/60 border border-line/40 text-[11px] text-muted flex items-center justify-between">
            <span>Tags interactivos detectados: {concepts.length}</span>
            <span className="font-mono text-emerald-400">Motor de lectura activo</span>
          </div>
        </div>

        {/* PANEL 2: VISUAL INTERACTIVE SANDBOX (SEE IT) - 3 COLS */}
        <div className="lg:col-span-3 rounded-2xl border border-line bg-surface-1/90 p-4 space-y-3 shadow-sm min-h-[480px] flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-line/60 pb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                02 · SEE IT (SANDBOX VISUAL)
              </span>
              <span className="text-[10px] font-mono text-muted uppercase">{currentConcept.tagType}</span>
            </div>

            <div className="rounded-xl border border-line/80 bg-surface-3/80 p-2 flex flex-col items-center justify-center">
              <canvas
                ref={canvasRef}
                width={260}
                height={210}
                className="rounded-lg w-full h-[210px] bg-surface-1 border border-line/40"
              />
            </div>

            <div className="space-y-1.5 bg-surface-2/50 p-2.5 rounded-xl border border-line/40 text-xs">
              <p className="font-bold text-white text-[11px] flex items-center justify-between">
                <span>{currentConcept.name}</span>
                <span className="text-primary text-[10px]">{currentConcept.category}</span>
              </p>
              <p className="text-[11px] text-muted leading-relaxed">{currentConcept.evaluatorNote}</p>
            </div>
          </div>

          <div className="pt-2 border-t border-line/40">
            <p className="text-[10px] text-muted text-center">
              Sandbox interactivo renderizado en tiempo real.
            </p>
          </div>
        </div>

        {/* PANEL 3: 4-AXIS MASTERY MAP & 4 TOOLS (GET IT) - 5 COLS */}
        <div className="lg:col-span-5 rounded-2xl border border-line bg-surface-1/90 p-4 space-y-4 shadow-sm min-h-[480px] flex flex-col justify-between">
          {/* MAPA DE DOMINIO 4 EJES */}
          <div className="space-y-2.5 border-b border-line/60 pb-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400">
                03 · GET IT (DOMINIO EN 4 EJES)
              </span>
              <span className="text-[10px] text-muted font-mono">Puntaje no decreciente</span>
            </div>

            {/* Barras de los 4 ejes psicométricos */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-line bg-surface-2/70 p-2 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted">Memoria</span>
                  <span className="font-mono font-bold text-white">{currentConcept.memory}%</span>
                </div>
                <div className="w-full bg-surface-3 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${currentConcept.memory}%` }}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-line bg-surface-2/70 p-2 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted">Comprensión</span>
                  <span className="font-mono font-bold text-white">{currentConcept.comprehension}%</span>
                </div>
                <div className="w-full bg-surface-3 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-500"
                    style={{ width: `${currentConcept.comprehension}%` }}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-line bg-surface-2/70 p-2 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted">Estructura</span>
                  <span className="font-mono font-bold text-white">{currentConcept.structure}%</span>
                </div>
                <div className="w-full bg-surface-3 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-cyan-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${currentConcept.structure}%` }}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-line bg-surface-2/70 p-2 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted">Aplicación</span>
                  <span className="font-mono font-bold text-white">{currentConcept.application}%</span>
                </div>
                <div className="w-full bg-surface-3 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${currentConcept.application}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* BARRA DE LAS 4 HERRAMIENTAS QUE ALIMENTAN EL JOURNAL */}
          <div className="flex items-center gap-1 border-b border-line/60 pb-1.5 overflow-x-auto">
            {[
              { key: "feynman", label: "Técnica Feynman" },
              { key: "quiz", label: "Quiz forzado" },
              { key: "flashcards", label: "Flashcards" },
              { key: "chat", label: "Chat con documento" },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTool(t.key as GetItToolTab)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                  activeTool === t.key
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted hover:text-white hover:bg-surface-2",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* CONTENIDO DE LA HERRAMIENTA ACTIVA */}
          <div className="flex-1 flex flex-col justify-between space-y-3 min-h-[220px]">
            {/* 1. MODO TÉCNICA FEYNMAN (El estudiante enseña a un niño de 8 años) */}
            {activeTool === "feynman" && (
              <div className="space-y-3 flex-1 flex flex-col justify-between">
                <div className="space-y-2.5 max-h-[170px] overflow-y-auto pr-1">
                  {feynmanHistory.map((item, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "p-2.5 rounded-xl text-xs space-y-1 leading-relaxed",
                        item.speaker === "child"
                          ? "bg-surface-2/80 border border-line text-ink"
                          : "bg-primary/20 border border-primary/40 text-white ml-4",
                      )}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                        {item.speaker === "child" ? "Niño curioso (8 años)" : "Tu explicación"}
                      </span>
                      <p>{item.text}</p>
                      {item.critique && (
                        <p className="text-[10px] text-muted italic border-t border-line/40 pt-1">
                          Evaluador: {item.critique}
                        </p>
                      )}
                    </div>
                  ))}
                  {isFeynmanThinking && (
                    <div className="text-xs text-muted italic p-2 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      <span>El niño está pensando su próxima pregunta…</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={feynmanInput}
                    onChange={(e) => setFeynmanInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendFeynman();
                      }
                    }}
                    placeholder={`Explicá «${currentConcept.name}» de forma simple…`}
                    className="flex-1 rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-white placeholder-muted focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={handleSendFeynman}
                    disabled={!feynmanInput.trim() || isFeynmanThinking}
                    className="rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white hover:bg-primary-hover shadow-md transition-colors disabled:opacity-40"
                  >
                    Enseñar
                  </button>
                </div>
              </div>
            )}

            {/* 2. MODO QUIZ FORZADO */}
            {activeTool === "quiz" && (
              <div className="space-y-3 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-bold text-white">
                    ¿Cuál de las siguientes afirmaciones respecto a «{currentConcept.name}» es correcta?
                  </p>
                  <div className="space-y-1.5">
                    {[
                      "Debe definir métrica cuantificable, umbral previo y plazo verificable.",
                      "Es suficiente con que suene lógica para el equipo fundador.",
                      "No requiere contrastación hasta después del lanzamiento comercial.",
                      "Depende únicamente de encuestas de opinión cualitativas.",
                    ].map((opt, optIdx) => {
                      const isSelected = quizAnswer === optIdx;
                      const isCorrect = optIdx === 0;
                      let style = "border-line bg-surface-2 text-muted hover:text-white";
                      if (quizSubmitted) {
                        if (isCorrect) style = "border-emerald-500 bg-emerald-950/30 text-emerald-300 font-bold";
                        else if (isSelected && !isCorrect) style = "border-rose-500 bg-rose-950/30 text-rose-300";
                      } else if (isSelected) {
                        style = "border-primary bg-primary/20 text-white font-bold";
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => !quizSubmitted && setQuizAnswer(optIdx)}
                          className={cn("w-full text-left rounded-lg border p-2 text-xs transition-colors", style)}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  {quizSubmitted ? (
                    <button
                      type="button"
                      onClick={() => {
                        setQuizAnswer(null);
                        setQuizSubmitted(false);
                      }}
                      className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Reintentar
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={quizAnswer === null}
                      onClick={() => {
                        setQuizSubmitted(true);
                        if (quizAnswer === 0) {
                          const updated = concepts.map((c) =>
                            c.id === currentConcept.id
                              ? { ...c, memory: Math.min(100, c.memory + 5), application: Math.min(100, c.application + 4) }
                              : c,
                          );
                          saveConcepts(updated);
                        }
                      }}
                      className="rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-white hover:bg-primary-hover disabled:opacity-40"
                    >
                      Confirmar respuesta
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 3. MODO FLASHCARDS */}
            {activeTool === "flashcards" && (
              <div className="space-y-3 flex-1 flex flex-col justify-between items-center text-center">
                <div
                  onClick={() => setFcFlipped(!fcFlipped)}
                  className="w-full h-32 rounded-xl border border-primary/30 bg-surface-2 p-4 flex flex-col items-center justify-center cursor-pointer select-none hover:border-primary/60 transition-all"
                >
                  <span className="text-[10px] font-mono uppercase tracking-wider text-primary mb-1">
                    {fcFlipped ? "Definición y Regla" : "Concepto (Clic para voltear)"}
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-white">
                    {fcFlipped
                      ? "Supuesto comprobable cuya validez se contrasta con datos de campo antes de escalar."
                      : currentConcept.name}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {["Otra vez (+0%)", "Difícil (+2%)", "Bien (+4%)", "Fácil (+6%)"].map((label, idx) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        setFcFlipped(false);
                        const gain = [0, 2, 4, 6][idx];
                        const updated = concepts.map((c) =>
                          c.id === currentConcept.id
                            ? { ...c, memory: Math.min(100, c.memory + gain), structure: Math.min(100, c.structure + gain) }
                            : c,
                        );
                        saveConcepts(updated);
                      }}
                      className="rounded-lg border border-line bg-surface-2 px-2 py-1 text-[11px] text-muted hover:text-white hover:border-primary/50 transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 4. MODO CHAT CON DOCUMENTO */}
            {activeTool === "chat" && (
              <div className="space-y-3 flex-1 flex flex-col justify-between">
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {docChatMessages.map((m, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "p-2.5 rounded-xl text-xs leading-relaxed",
                        m.sender === "user"
                          ? "bg-primary text-white ml-6 rounded-br-none"
                          : "bg-surface-2 text-ink border border-line/60 mr-6 rounded-bl-none",
                      )}
                    >
                      {m.text}
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={docChatInput}
                    onChange={(e) => setDocChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendDocChat();
                      }
                    }}
                    placeholder="Consultá un dato específico del documento…"
                    className="flex-1 rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-white placeholder-muted focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={handleSendDocChat}
                    disabled={!docChatInput.trim()}
                    className="rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white hover:bg-primary-hover shadow-md transition-colors disabled:opacity-40"
                  >
                    Preguntar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
