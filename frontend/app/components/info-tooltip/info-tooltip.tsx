'use client'

interface InfoTooltipProps {
    text: string;
}

export function InfoTooltip({ text }: InfoTooltipProps) {
    return (
        <span className="relative group inline-flex items-center">
            <span
                tabIndex={0}
                className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-muted-foreground/40 text-muted-foreground/60 cursor-help transition-colors hover:border-primary hover:text-primary focus-visible:border-primary focus-visible:text-primary outline-none text-[10px] font-bold leading-none"
            >
                i
            </span>
            <div
                role="tooltip"
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 rounded-xl glass-panel text-xs text-foreground/90 shadow-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 pointer-events-none z-50"
            >
                {text}
            </div>
        </span>
    );
}
