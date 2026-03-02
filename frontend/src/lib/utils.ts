import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export const statusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    intake: "Intake",
    triagem: "Triagem",
    processamento: "Processamento",
    revisao: "Revisão",
    concluido: "Concluído",
  };
  return labels[status] || status;
};

export const statusColor = (status: string): string => {
  const colors: Record<string, string> = {
    intake: "bg-gray-100 text-gray-700",
    triagem: "bg-blue-100 text-blue-700",
    processamento: "bg-yellow-100 text-yellow-700",
    revisao: "bg-purple-100 text-purple-700",
    concluido: "bg-green-100 text-green-700",
  };
  return colors[status] || "bg-gray-100 text-gray-700";
};

export const urgencyLabel = (urgency: string): string => {
  const labels: Record<string, string> = {
    normal: "Normal",
    urgente: "Urgente",
    muito_urgente: "Muito Urgente",
  };
  return labels[urgency] || urgency;
};
