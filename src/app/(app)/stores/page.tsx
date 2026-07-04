import { redirect } from "next/navigation";

// The store grid moved to the Food tab; keep old links working.
export default function StoresPage() {
  redirect("/food");
}
