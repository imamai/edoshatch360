import { LoadingPanel } from "@/components/ui/spinner";

/**
 * Next renders this automatically while a segment under /app streams in, so
 * every navigation in the app gets the circular loading state without any
 * per-page wiring.
 */
export default function Loading() {
  return <LoadingPanel />;
}
