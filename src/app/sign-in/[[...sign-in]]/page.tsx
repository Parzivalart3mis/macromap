import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main
      className="flex min-h-dvh items-center justify-center p-6"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 1.5rem)",
        paddingBottom: "max(env(safe-area-inset-bottom), 1.5rem)",
      }}
    >
      <SignIn />
    </main>
  );
}
