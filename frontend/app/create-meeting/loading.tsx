export default function CreateMeetingLoading() {
    return (
        <div className="h-[100dvh] flex items-center justify-center bg-background relative overflow-hidden">
            <div className="absolute top-[-20%] right-[-20%] w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-20%] left-[-20%] w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col items-center gap-5 relative z-10 w-72">
                <div className="relative w-14 h-14">
                    <div className="absolute inset-0 border-4 border-primary/20 rounded-full" />
                    <div className="absolute inset-0 border-4 border-transparent border-t-primary rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center text-xl">📅</div>
                </div>

                <div className="text-center space-y-1">
                    <p className="text-sm font-bold text-foreground">Setting Up...</p>
                    <p className="text-xs text-muted-foreground">Preparing your meeting form</p>
                </div>

                <div className="w-full space-y-3">
                    <div className="h-12 bg-white/5 rounded-2xl animate-pulse" />
                    <div className="h-12 bg-white/5 rounded-2xl animate-pulse" style={{ animationDelay: '100ms' }} />
                    <div className="h-12 bg-white/5 rounded-2xl animate-pulse" style={{ animationDelay: '200ms' }} />
                    <div className="h-12 bg-white/5 rounded-2xl animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
            </div>
        </div>
    );
}
