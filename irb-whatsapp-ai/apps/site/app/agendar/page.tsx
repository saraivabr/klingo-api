import type { Metadata } from "next";

import { BookingExperience } from "@/components/booking/booking-experience";

export const metadata: Metadata = {
  title: "Agendar Consulta | IRB Prime Care - Saúde e Bem-estar",
  description:
    "Agende sua consulta médica online na IRB Prime Care. Escolha especialidade, médico, data e horário de forma rápida e segura.",
};

export default function BookingPage() {
  return <BookingExperience />;
}
