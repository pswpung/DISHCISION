export default function ResultLoading() {
    return (
        <div className="h-[100dvh] flex items-center justify-center bg-background relative overflow-hidden">
            {/* Ambient glows */}
            <div className="absolute top-[-20%] left-[-20%] w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-20%] w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col items-center gap-5 relative z-10">
                {/* Spinner */}
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-4 border-primary/20 rounded-full" />
                    <div className="absolute inset-0 border-4 border-transparent border-t-primary rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center text-2xl">🍽️</div>
                </div>

                <div className="text-center space-y-1">
                    <p className="text-sm font-bold text-foreground">Loading Results...</p>
                    <p className="text-xs text-muted-foreground">Syncing with your group</p>
                </div>

                {/* Skeleton preview */}
                <div className="w-72 space-y-3 mt-4">
                    <div className="h-3 bg-white/5 rounded-full w-1/2 mx-auto animate-pulse" />
                    <div className="h-20 bg-white/5 rounded-2xl animate-pulse" />
                    <div className="h-20 bg-white/5 rounded-2xl animate-pulse" style={{ animationDelay: '150ms' }} />
                    <div className="h-20 bg-white/5 rounded-2xl animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
            </div>
        </div>
    );
}
