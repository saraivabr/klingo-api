import type { Metadata } from "next";

import { PaymentExperience } from "@/components/booking/payment-experience";

export const metadata: Metadata = {
  title: "Pagamento | IRB Prime Care",
};

export default function PaymentPage() {
  return <PaymentExperience />;
}
