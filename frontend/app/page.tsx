import Image from "next/image";

export default function Home() {
  return (
    <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-black overflow-hidden relative">
      {/* Background decoration */}
      <div className="absolute top-[-20%] left-[-20%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[600px] h-[600px] bg-accent/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

      <main className="flex flex-col items-center justify-center gap-8 relative z-10 text-center p-8">

        {/* Animated Logo Container */}
        <div className="relative animate-wiggle-slow hover:scale-105 transition-transform duration-500 cursor-pointer">
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-110"></div>
          <Image
            src="/dishcision_logo.png"
            alt="Dishcision Logo"
            width={300}
            height={300}
            className="relative drop-shadow-2xl rounded-full mix-blend-multiply dark:invert dark:mix-blend-screen"
            priority
          />
        </div>

        <div className="space-y-4 max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent tracking-tighter">
            DISHCISION
          </h1>
          <p className="text-muted-foreground text-lg font-medium">
            Let the group decide your next meal.
          </p>
        </div>

        {/* <div className="animate-in fade-in zoom-in duration-500 delay-500">
          <a
            href="/create-meeting"
            className="glass-button px-8 py-4 rounded-full font-bold text-lg flex items-center gap-2 group"
          >
            Start Deciding
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </a>
        </div> */}
      </main>

      {/* Footer / Copyright */}
      <footer className="absolute bottom-4 text-xs text-muted-foreground/50">
        © {new Date().getFullYear()} Dishcision. All rights reserved.
      </footer>
    </div>
  );
}
