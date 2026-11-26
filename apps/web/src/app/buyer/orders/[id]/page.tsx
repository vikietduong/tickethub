import { BuyerOrderDetailPage } from "@/features/payment";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <BuyerOrderDetailPage params={params} />;
}
