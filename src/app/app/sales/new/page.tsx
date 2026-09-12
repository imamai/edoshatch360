import { redirect } from "next/navigation";

/**
 * The old form-based sale builder lived here.
 *
 * It was a second, older way to do exactly what the Counter does, and it was
 * the screen people landed on when they followed a "New sale" link — which is
 * how a rebuilt till can look like nothing changed at all. The route is kept
 * as a redirect rather than deleted so existing links and bookmarks still
 * arrive somewhere sensible.
 */
export default function NewSalePage() {
  redirect("/app/sales/counter");
}
