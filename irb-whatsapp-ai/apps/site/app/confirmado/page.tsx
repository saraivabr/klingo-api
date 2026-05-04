import type { Metadata } from "next";

import { ConfirmedExperience } from "@/components/booking/confirmed-experience";

export const metadata: Metadata = {
  title: "Agendamento Confirmado | IRB Prime Care",
};

export default function ConfirmedPage() {
  return <ConfirmedExperience />;
}
